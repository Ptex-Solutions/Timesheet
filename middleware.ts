import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isStaffRole } from "@/lib/permissions";

const PUBLIC_PATHS = ["/login", "/api/auth", "/_next", "/favicon", "/assets"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  });

  // Not logged in
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  const role = (token as any).role as string | undefined;

  // Staff-only zones (the /admin portal and staff APIs)
  const staffOnly =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/sandbox") ||
    pathname.startsWith("/api/mis") ||
    pathname.startsWith("/api/users") ||
    pathname.startsWith("/api/tasks") ||
    pathname.startsWith("/api/access");

  if (staffOnly && !isStaffRole(role)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/employee/dashboard";
    return NextResponse.redirect(url);
  }

  // Employee zone reachable to both, but staff default to the admin portal dashboard
  if (pathname === "/" ) {
    const url = req.nextUrl.clone();
    url.pathname = isStaffRole(role) ? "/admin/dashboard" : "/employee/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/employee/:path*",
    "/admin/:path*",
    "/api/timesheets/:path*",
    "/api/sandbox/:path*",
    "/api/mis/:path*",
    "/api/users/:path*",
    "/api/masters/:path*",
    "/api/activities/:path*",
    "/api/tasks/:path*",
    "/api/access/:path*",
  ],
};
