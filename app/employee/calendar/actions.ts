"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HolidayItem, LeaveItem, LeaveQuota, INITIAL_HOLIDAYS } from "@/components/employee/calendar/types";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getZohoAccessToken(): Promise<string | null> {
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
    console.error("Zoho Token Error:", err);
    return null;
  }
}

// Format DD-MMM-YYYY, DD-MM-YYYY, or YYYY-MM-DD to YYYY-MM-DD
function parseZohoDate(dateStr: string): string {
  if (!dateStr) return "";
  const clean = dateStr.trim();
  const parts = clean.split(/[-/]/);
  if (parts.length === 3) {
    const monthNames: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };

    let p0 = parts[0].trim();
    let p1 = parts[1].trim();
    let p2 = parts[2].trim();

    const m0 = monthNames[p0.toLowerCase().slice(0, 3)];
    const m1 = monthNames[p1.toLowerCase().slice(0, 3)];

    if (m1) p1 = m1;
    if (m0) p0 = m0;

    // If DD-MM-YYYY or DD-MMM-YYYY (e.g. 11-Sep-2026 or 11-09-2026)
    if (p2.length === 4) {
      return `${p2}-${p1.padStart(2, "0")}-${p0.padStart(2, "0")}`;
    }
    // If YYYY-MM-DD (e.g. 2026-09-11)
    if (p0.length === 4) {
      return `${p0}-${p1.padStart(2, "0")}-${p2.padStart(2, "0")}`;
    }
  }
  return clean;
}

// Generate all YYYY-MM-DD dates between fromDate and toDate
function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
  if (!startDateStr) return [];
  if (!endDateStr || startDateStr === endDateStr) return [startDateStr];

  const dates: string[] = [];
  const start = new Date(startDateStr + "T00:00:00");
  const end = new Date(endDateStr + "T00:00:00");

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [startDateStr];
  }

  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// Helper to recursively unpack Zoho response items
function unpackZohoResult(data: any): any[] {
  const rawList: any[] = [];
  const resultObj = data?.response?.result || data?.result || data?.data;

  if (Array.isArray(resultObj)) {
    for (const item of resultObj) {
      if (item && typeof item === "object") {
        for (const [key, val] of Object.entries(item)) {
          if (Array.isArray(val)) {
            val.forEach((row) => rawList.push({ ...row, recordId: key }));
          } else if (typeof val === "object" && val !== null) {
            rawList.push({ ...(val as any), recordId: key });
          } else {
            rawList.push({ ...item });
            break;
          }
        }
      }
    }
  } else if (resultObj && typeof resultObj === "object") {
    for (const [key, val] of Object.entries(resultObj)) {
      if (Array.isArray(val)) {
        val.forEach((row) => rawList.push({ ...row, recordId: key }));
      } else if (typeof val === "object" && val !== null) {
        rawList.push({ ...(val as any), recordId: key });
      }
    }
  }

  return rawList;
}

// Server Action to sync user-specific leaves dynamically from Zoho People API
export async function syncEmployeeLeaves(): Promise<{
  success: boolean;
  leaves: LeaveItem[];
  quota: LeaveQuota[];
  holidays: HolidayItem[];
  userName: string;
  employeeCode: string;
  message?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;
  const dbUser = await prisma.user.findUnique({
    where: { id: typeof userId === "number" ? userId : parseInt(String(userId), 10) },
    select: { name: true, email: true, employeeCode: true },
  });

  const userName = dbUser?.name || session.user.name || "Employee";
  const userEmail = (dbUser?.email || session.user.email || "").trim().toLowerCase();
  const employeeCode = (dbUser?.employeeCode || (session.user as any)?.employeeCode || "").trim().toUpperCase();

  const token = await getZohoAccessToken();
  if (!token) {
    return {
      success: false,
      leaves: [],
      quota: [],
      holidays: INITIAL_HOLIDAYS,
      userName,
      employeeCode,
      message: "Zoho is not connected. Please configure your Zoho API credentials in Admin Settings.",
    };
  }

  const holidayDateSet = new Set(INITIAL_HOLIDAYS.map((h) => h.date));
  const fetchedLeaves: LeaveItem[] = [];
  let dynamicPrivilegeBalance: number | null = null;
  let dynamicCompOffBalance: number | null = null;
  let rawQuotaMap: Record<string, { total?: number; taken?: number; remaining?: number }> = {};

  try {
    // 1. Fetch employee leave applications from Zoho People
    const recordsUrl = `https://people.zoho.com/people/api/forms/leave/getRecords?sIndex=1&limit=500`;
    let rawLeaves: any[] = [];
    const cleanEmpCode = employeeCode.toLowerCase().replace(/[^a-z0-9]/g, "");

    try {
      const res = await fetch(recordsUrl, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const unpacked = unpackZohoResult(data);

        if (unpacked.length > 0) {
          rawLeaves = unpacked.filter((r) => {
            const empText = [
              r["Employee_ID"],
              r["AddedBy"],
              r["ModifiedBy"],
              r["Employee_Name"],
              r["EmployeeID"],
              r["Emp ID"],
              r["TeamEmailID"],
              r["EmailID"],
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            const codeMatch = Boolean(employeeCode && empText.includes(employeeCode.toLowerCase()));
            const cleanCodeMatch = Boolean(cleanEmpCode && empText.replace(/[^a-z0-9]/g, "").includes(cleanEmpCode));
            const emailMatch = Boolean(userEmail && empText.includes(userEmail));
            const nameMatch = Boolean(userName && userName.length > 2 && empText.includes(userName.toLowerCase()));

            return codeMatch || cleanCodeMatch || emailMatch || nameMatch;
          });
        }
      }
    } catch (err) {
      console.warn("Zoho leave records fetch error:", err);
    }

    // Process leave items and calculate calendar working days (excluding weekends & holidays)
    for (let i = 0; i < rawLeaves.length; i++) {
      const r = rawLeaves[i];

      const rawFrom = r["From"] || r["Leave_From"] || r["fromDate"] || r["From_Date"] || r["Leave period"]?.split("-")?.[0] || "";
      const rawTo = r["To"] || r["Leave_To"] || r["toDate"] || r["To_Date"] || r["Leave period"]?.split("-")?.[1] || rawFrom;

      const formattedFrom = parseZohoDate(rawFrom);
      const formattedTo = parseZohoDate(rawTo) || formattedFrom;
      if (!formattedFrom) continue;

      const totalDays = parseFloat(
        r["Daystaken"] ||
        r["DaysTaken"] ||
        r["Days"] ||
        "1"
      ) || 1;

      const statusStr = String(r["ApprovalStatus"] || r["Status"] || r["status"] || "Approved").toUpperCase();
      const leaveType = (r["Leavetype"] || r["LeaveType"] || r["Leave type"] || "Privilege Leave") as any;
      const reason = r["Reasonforleave"] || r["Reason"] || r["reason"] || "Personal leave";
      const zohoId = r["Zoho_ID"] || r["recordId"] || `zoho-leave-${i}`;

      const allDates = getDatesInRange(formattedFrom, formattedTo);
      // Filter out weekends (Saturday/Sunday) and company holidays - leaves apply only to working days
      const workingLeaveDates = allDates.filter((dStr) => {
        const dObj = new Date(dStr + "T00:00:00");
        const dayOfWeek = dObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = holidayDateSet.has(dStr);
        return !isWeekend && !isHoliday;
      });

      const datesToUse = workingLeaveDates;
      const daysPerDate = totalDays <= 1 ? totalDays : 1;

      for (let d = 0; d < datesToUse.length; d++) {
        const dStr = datesToUse[d];
        fetchedLeaves.push({
          id: `${zohoId}-${dStr}`,
          date: dStr,
          leaveType,
          status: statusStr.includes("APPROV") ? "APPROVED" : statusStr.includes("PEND") ? "PENDING" : "APPROVED",
          reason,
          days: daysPerDate,
          session: daysPerDate < 1 ? "Second Half" : "Full Day",
          isPast: new Date(dStr) < new Date(),
        });
      }
    }

    // 2. Resolve Zoho User Record ID (zohoUserId) to query getLeaveTypeDetails API
    let zohoUserId: string | null = null;

    // Check if any leave record has Employee_ID.ID or ModifiedBy.ID or AddedBy.ID
    for (const r of rawLeaves) {
      const zId = r["Employee_ID.ID"] || r["ModifiedBy.ID"] || r["AddedBy.ID"];
      if (zId && typeof zId === "string" && zId.length > 5) {
        zohoUserId = zId;
        break;
      }
    }

    // If not found in leave records, fetch from employee records
    if (!zohoUserId && employeeCode) {
      try {
        const empUrl = `https://people.zoho.com/people/api/forms/employee/getRecords?searchColumn=EMPLOYEEID&searchValue=${encodeURIComponent(employeeCode)}`;
        const eRes = await fetch(empUrl, {
          headers: { Authorization: `Zoho-oauthtoken ${token}` },
        });
        if (eRes.ok) {
          const eData = await eRes.json();
          const resObj = eData?.response?.result;
          if (Array.isArray(resObj)) {
            for (const item of resObj) {
              for (const [key] of Object.entries(item)) {
                zohoUserId = key;
                break;
              }
              if (zohoUserId) break;
            }
          }
        }
      } catch (err) {
        console.warn("Could not resolve Zoho User ID from employee form:", err);
      }
    }

    // 3. Dynamically fetch user leave balance / quota from Zoho People getLeaveTypeDetails API
    if (zohoUserId) {
      try {
        const ltUrl = `https://people.zoho.com/people/api/leave/getLeaveTypeDetails?userId=${zohoUserId}`;
        const ltRes = await fetch(ltUrl, {
          headers: { Authorization: `Zoho-oauthtoken ${token}` },
        });

        if (ltRes.ok) {
          const ltData = await ltRes.json();
          const resultList = ltData?.response?.result;

          if (Array.isArray(resultList) && resultList.length > 0) {
            for (const bObj of resultList) {
              const typeName = String(bObj["Name"] || bObj["Type"] || bObj["Leavetype"] || "").toLowerCase();
              const bal = parseFloat(String(bObj["BalanceCount"] ?? bObj["Balance"] ?? "0"));
              const taken = parseFloat(String(bObj["AvailedCount"] ?? bObj["TakenCount"] ?? "0"));
              const permitted = parseFloat(String(bObj["PermittedCount"] ?? "0"));

              const validBal = !isNaN(bal) ? bal : 0;
              const validTaken = !isNaN(taken) ? taken : 0;
              const validPermitted = !isNaN(permitted) && permitted > 0 ? permitted : validBal + validTaken;

              if (typeName.includes("privilege") || typeName.includes("annual") || typeName.includes("earned") || typeName.includes("pl")) {
                dynamicPrivilegeBalance = validBal;
                rawQuotaMap["Privilege Leave"] = {
                  total: validPermitted,
                  taken: validTaken,
                  remaining: validBal,
                };
              } else if (typeName.includes("comp") || typeName.includes("compensatory") || typeName.includes("co")) {
                dynamicCompOffBalance = validBal;
                rawQuotaMap["Compensatory Off"] = {
                  total: validPermitted,
                  taken: validTaken,
                  remaining: validBal,
                };
              } else {
                const displayName = String(bObj["Name"] || bObj["Type"] || "Leave");
                rawQuotaMap[displayName] = {
                  total: validPermitted,
                  taken: validTaken,
                  remaining: validBal,
                };
              }
            }
          }
        }
      } catch (err) {
        console.warn("Zoho getLeaveTypeDetails failed:", err);
      }
    }
  } catch (err) {
    console.error("Error fetching live Zoho leaves/balance:", err);
  }

  // Calculate live totals from fetched user leave records
  const totalBookedFromRecords = fetchedLeaves
    .filter((l) => l.status === "APPROVED")
    .reduce((acc, l) => acc + l.days, 0);

  const totalPendingFromRecords = fetchedLeaves
    .filter((l) => l.status === "PENDING")
    .reduce((acc, l) => acc + l.days, 0);

  // Dynamic values with priority on live Zoho API values
  const privilegeTaken = rawQuotaMap["Privilege Leave"]?.taken ?? totalBookedFromRecords;
  const privilegeRemaining = dynamicPrivilegeBalance ?? (rawQuotaMap["Privilege Leave"]?.remaining ?? 0);
  const privilegeTotal = rawQuotaMap["Privilege Leave"]?.total ?? (privilegeTaken + privilegeRemaining);

  const compOffTaken = rawQuotaMap["Compensatory Off"]?.taken ?? 0;
  const compOffRemaining = dynamicCompOffBalance ?? (rawQuotaMap["Compensatory Off"]?.remaining ?? 0);
  const compOffTotal = rawQuotaMap["Compensatory Off"]?.total ?? (compOffTaken + compOffRemaining);

  // Quotas
  const dynamicQuota: LeaveQuota[] = [
    {
      type: "Privilege Leave",
      total: privilegeTotal,
      taken: privilegeTaken,
      pending: totalPendingFromRecords,
      remaining: privilegeRemaining,
      iconColor: "text-sky-500 bg-sky-500/10",
    },
    {
      type: "Compensatory Off",
      total: compOffTotal,
      taken: compOffTaken,
      pending: 0,
      remaining: compOffRemaining,
      iconColor: "text-lime-600 bg-lime-500/10",
    },
  ];

  return {
    success: true,
    leaves: fetchedLeaves,
    quota: dynamicQuota,
    holidays: INITIAL_HOLIDAYS,
    userName,
    employeeCode,
  };
}
