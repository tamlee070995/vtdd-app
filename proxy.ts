import { NextResponse, type NextRequest } from "next/server";

const LEGACY_COOKIE_NAMES = [
  "vtdd_admin_nv",
  "vtdd_admin_name",
  "vtdd_admin_permission",
  "vtdd_admin_modules",
  "vtdd_staff_nv",
  "vtdd_staff_st",
  "vtdd_staff_name",
  "vtdd_staff_store_name",
  "vtdd_staff_department",
  "vtdd_staff_gmail",
  "vtdd_staff_force_setup",
];

const ENCRYPTED_SESSION_COOKIE_NAMES = ["vtdd_admin_token", "vtdd_staff_session"];

function expireCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function proxy(req: NextRequest) {
  const res = NextResponse.next();

  LEGACY_COOKIE_NAMES.forEach((name) => {
    if (req.cookies.has(name)) expireCookie(res, name);
  });

  ENCRYPTED_SESSION_COOKIE_NAMES.forEach((name) => {
    const value = req.cookies.get(name)?.value || "";
    if (value.startsWith("v1.")) expireCookie(res, name);
  });

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
