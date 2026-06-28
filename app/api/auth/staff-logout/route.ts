import { NextRequest, NextResponse } from "next/server";
import { clearStaffSessionCookies } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

function getSafeLogoutPath(req: NextRequest, raw?: string | null) {
  const value = String(raw || new URL(req.url).searchParams.get("next") || "").trim();
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/tradein-price";
  }

  try {
    const target = new URL(value, req.url);
    const current = new URL(req.url);
    if (target.origin !== current.origin) {
      return "/tradein-price";
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/tradein-price";
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(getSafeLogoutPath(req), req.url);
  const res = NextResponse.redirect(url, { status: 303 });

  clearStaffSessionCookies(res);

  return res;
}

export async function POST(req: NextRequest) {
  let next: string | null = null;
  try {
    const form = await req.formData();
    next = String(form.get("next") || "");
  } catch {
    next = null;
  }

  const url = new URL(getSafeLogoutPath(req, next), req.url);
  const res = NextResponse.redirect(url, { status: 303 });

  clearStaffSessionCookies(res);

  return res;
}
