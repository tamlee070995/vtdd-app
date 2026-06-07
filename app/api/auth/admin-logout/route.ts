import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIES = ["vtdd_admin_token", "vtdd_admin_name"];

export async function GET(req: NextRequest) {
  const url = new URL("/", req.url);
  const res = NextResponse.redirect(url, { status: 303 });

  ADMIN_COOKIES.forEach((name) => {
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
