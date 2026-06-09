import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STAFF_COOKIES = [
  "vtdd_staff_nv",
  "vtdd_staff_st",
  "vtdd_staff_name",
  "vtdd_staff_store_name",
  "vtdd_staff_department",
  "vtdd_staff_gmail",
  "vtdd_staff_force_setup",
];

function clearStaffCookies(res: NextResponse) {
  for (const name of STAFF_COOKIES) {
    res.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL("/tradein-price", req.url);
  const res = NextResponse.redirect(url, { status: 303 });

  clearStaffCookies(res);

  return res;
}

export async function POST(req: NextRequest) {
  const url = new URL("/tradein-price", req.url);
  const res = NextResponse.redirect(url, { status: 303 });

  clearStaffCookies(res);

  return res;
}
