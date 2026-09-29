"use server";

import fs from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentAccess } from "@/lib/authz";
import { Role } from "@prisma/client";

export type ZohoEmployee = {
  id: string;
  code: string;
  name: string;
  email: string;
  joiningDate?: string;
  existsInDb: boolean;
};

let cachedToken: { accessToken: string; expiresAt: number } | null = null;
const ENV_PATH = path.join(process.cwd(), ".env");

// 1. Check if Zoho credentials are in .env
export async function getZohoConfig() {
  const clientId = process.env.ZOHO_CLIENT_ID || "";
  const clientSecret = process.env.ZOHO_CLIENT_SECRET || "";
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN || "";

  return {
    configured: Boolean(clientId && clientSecret && refreshToken),
    clientId: clientId || "",
  };
}

// 2. Connect and save credentials to .env
export async function connectZoho({
  clientId,
  clientSecret,
  code,
}: {
  clientId: string;
  clientSecret: string;
  code: string;
}) {
  const access = await getCurrentAccess();
  if (!access?.perms.has("employees.edit")) {
    return { success: false, message: "Permission denied." };
  }

  const cleanCode = code.replace(/^(Zoho-oauthtoken|Bearer)\s+/i, "").trim();

  try {
    const res = await fetch("https://accounts.zoho.com/oauth/v2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        code: cleanCode,
      }),
    });

    const data = await res.json();
    if (data.error) {
      return { success: false, message: `Zoho error: ${data.error_description || data.error}` };
    }

    if (!data.refresh_token) {
      return { success: false, message: "No refresh token returned. Please ensure your Authorization Code is valid and fresh." };
    }

    // Update in memory
    process.env.ZOHO_CLIENT_ID = clientId.trim();
    process.env.ZOHO_CLIENT_SECRET = clientSecret.trim();
    process.env.ZOHO_REFRESH_TOKEN = data.refresh_token;

    cachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };

    // Append / Update in .env file
    try {
      let envContent = await fs.readFile(ENV_PATH, "utf-8");
      if (envContent.includes("ZOHO_CLIENT_ID=")) {
        envContent = envContent
          .replace(/ZOHO_CLIENT_ID=.*/g, `ZOHO_CLIENT_ID="${clientId.trim()}"`)
          .replace(/ZOHO_CLIENT_SECRET=.*/g, `ZOHO_CLIENT_SECRET="${clientSecret.trim()}"`)
          .replace(/ZOHO_REFRESH_TOKEN=.*/g, `ZOHO_REFRESH_TOKEN="${data.refresh_token}"`);
      } else {
        envContent += `\n# Zoho People Integration\nZOHO_CLIENT_ID="${clientId.trim()}"\nZOHO_CLIENT_SECRET="${clientSecret.trim()}"\nZOHO_REFRESH_TOKEN="${data.refresh_token}"\n`;
      }
      await fs.writeFile(ENV_PATH, envContent, "utf-8");
    } catch (e) {
      console.error("Could not write to .env:", e);
    }

    return { success: true, message: "Connected & saved to .env successfully!" };
  } catch (err: any) {
    return { success: false, message: err?.message || "Connection failed." };
  }
}

// 3. Get valid access token using Refresh Token from .env
async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 180000) {
    return cachedToken.accessToken;
  }

  try {
    const res = await fetch("https://accounts.zoho.com/oauth/v2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        refresh_token: refreshToken.trim(),
      }),
    });

    const data = await res.json();
    if (!data.access_token) {
      console.error("Zoho Token Refresh Error:", data);
      return null;
    }

    cachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };

    return cachedToken.accessToken;
  } catch (err) {
    console.error("Failed to fetch access token:", err);
    return null;
  }
}

// 4. Fetch employees from Zoho People API
export async function fetchZohoEmployees(): Promise<{
  success: boolean;
  employees: ZohoEmployee[];
  message?: string;
}> {
  const access = await getCurrentAccess();
  if (!access?.perms.has("employees.view")) {
    return { success: false, employees: [], message: "Unauthorized." };
  }

  const token = await getAccessToken();
  if (!token) {
    return {
      success: false,
      employees: [],
      message: "Zoho is not connected. Please enter your credentials and connect first.",
    };
  }

  try {
    const res = await fetch("https://people.zoho.com/api/forms/employee/getRecords", {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });

    const data = await res.json();
    const rawList: any[] = [];

    if (data.response?.result && Array.isArray(data.response.result)) {
      for (const item of data.response.result) {
        for (const [key, val] of Object.entries(item)) {
          if (Array.isArray(val)) {
            val.forEach((row) => rawList.push({ ...row, recordId: key }));
          } else {
            rawList.push({ ...(val as any), recordId: key });
          }
        }
      }
    }

    const existing = await prisma.user.findMany({ select: { email: true, employeeCode: true } });
    const existingEmails = new Set(existing.map((u) => u.email.toLowerCase()));
    const existingCodes = new Set(existing.map((u) => u.employeeCode.toUpperCase()));

    const employees: ZohoEmployee[] = [];
    for (const r of rawList) {
      const email = (r["EmailID"] || r["Email"] || r["email"] || "").trim();
      const code = (r["EmployeeID"] || r["Emp ID"] || r["Employee_ID"] || r["recordId"] || "").trim();
      const firstName = r["First Name"] || r["FirstName"] || "";
      const lastName = r["Last Name"] || r["LastName"] || "";
      const name = (r["Full Name"] || r["Employee_Name"] || `${firstName} ${lastName}`).trim() || email.split("@")[0];
      const joiningDate = (
        r["Dateofjoining"] ||
        ""
      ).trim();

      if (!email || !code) continue;

      employees.push({
        id: r.recordId || code,
        code,
        name,
        email,
        joiningDate: joiningDate || undefined,
        existsInDb: existingEmails.has(email.toLowerCase()) || existingCodes.has(code.toUpperCase()),
      });
    }

    return { success: true, employees, message: `Loaded ${employees.length} employees from Zoho People.` };
  } catch (err: any) {
    return { success: false, employees: [], message: err?.message || "Failed to fetch employees." };
  }
}

function parseZohoJoiningDate(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined;
  
  // Try standard parse
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;

  // Handle dd-MMM-yyyy (e.g. 15-Jul-2022) or dd-MM-yyyy (e.g. 15-07-2022)
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    const parsed = new Date(`${parts[1]} ${parts[0]}, ${parts[2]}`);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
}

// 5. Sync selected employees into DB
export async function syncEmployeesToDb(employees: ZohoEmployee[]) {
  const access = await getCurrentAccess();
  if (!access?.perms.has("employees.edit")) {
    return { success: false, message: "Permission denied." };
  }

  const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? "12", 10);
  const defaultPassword = await bcrypt.hash("Ptex@123", BCRYPT_ROUNDS);
  let count = 0;

  for (const emp of employees) {
    const doj = parseZohoJoiningDate(emp.joiningDate);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: emp.email }, { employeeCode: emp.code }] },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: emp.name,
          employeeCode: emp.code,
          isActive: true,
          ...(doj ? { createdAt: doj } : {}),
        },
      });
    } else {
      await prisma.user.create({
        data: {
          name: emp.name,
          email: emp.email,
          employeeCode: emp.code,
          password: defaultPassword,
          role: Role.EMPLOYEE,
          isActive: true,
          ...(doj ? { createdAt: doj } : {}),
        },
      });
    }
    count++;
  }

  return { success: true, message: `Successfully imported / updated ${count} employees in database.` };
}
