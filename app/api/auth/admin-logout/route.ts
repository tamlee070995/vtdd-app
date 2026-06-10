import { NextRequest, NextResponse } from "next/server";
import { clearAdminCookies } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL("/admin/login", req.url);
  const res = NextResponse.redirect(url, { status: 303 });
  clearAdminCookies(res);
  return res;
}

export async function POST(req: NextRequest) {
  return GET(req);
}
