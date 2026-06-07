import { NextRequest, NextResponse } from "next/server";
import { getSystemSettings } from "@/lib/system-store";
import { verifyPassword } from "@/lib/staff-security";

const ADMIN_COOKIE = "vtdd_admin_token";

export const dynamic = "force-dynamic";

function redirectLogin(req: NextRequest, message: string) {
  const url = new URL("/admin/login", req.url);
  url.searchParams.set("error", message);

  const res = NextResponse.redirect(url, { status: 303 });

  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  res.cookies.set("vtdd_admin_name", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}

async function verifyAdminPin(input: string) {
  const settings = await getSystemSettings();
  const pinHash = String(settings.ADMIN_PIN_HASH || "").trim();

  if (pinHash) {
    return verifyPassword(input, pinHash);
  }

  const envPassword = String(process.env.ADMIN_PASSWORD || "").trim();

  if (!envPassword) {
    throw new Error("Thiếu ADMIN_PASSWORD trong .env.local hoặc ADMIN_PIN_HASH trong System_Settings.");
  }

  return input === envPassword;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let password = "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      password = String(body.password || "").trim();
    } else {
      const form = await req.formData();
      password = String(form.get("password") || "").trim();
    }

    if (!password) {
      return redirectLogin(req, "Vui lòng nhập PIN hoặc mật khẩu quản trị.");
    }

    const ok = await verifyAdminPin(password);

    if (!ok) {
      return redirectLogin(req, "Sai PIN hoặc mật khẩu quản trị.");
    }

    const url = new URL("/admin", req.url);
    const res = NextResponse.redirect(url, { status: 303 });

    res.cookies.set(ADMIN_COOKIE, "admin-ok", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 6,
    });

    res.cookies.set("vtdd_admin_name", encodeURIComponent("Admin"), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 6,
    });

    return res;
  } catch (err: any) {
    return redirectLogin(req, "Lỗi hệ thống: " + (err?.message || "Không đăng nhập được."));
  }
}
