import { NextRequest, NextResponse } from "next/server";
import { clearStaffSessionCookies } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL("/tradein-price", req.url);
  const res = NextResponse.redirect(url, { status: 303 });

  clearStaffSessionCookies(res);

  return res;
}

export async function POST(req: NextRequest) {
  const url = new URL("/tradein-price", req.url);
  const res = NextResponse.redirect(url, { status: 303 });

  clearStaffSessionCookies(res);

  return res;
}
