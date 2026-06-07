import { NextRequest, NextResponse } from "next/server";

const STAFF_COOKIES = [
  "vtdd_staff_nv",
  "vtdd_staff_st",
  "vtdd_staff_name",
  "vtdd_staff_store_name",
  "vtdd_staff_department",
  "vtdd_staff_gmail",
];

export async function GET(req: NextRequest) {
  const url = new URL("/", req.url);
  const res = NextResponse.redirect(url, { status: 303 });

  STAFF_COOKIES.forEach((name) => {
    res.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  });

  return res;
}