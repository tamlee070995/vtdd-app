import { NextRequest, NextResponse } from "next/server";
import { findStaffByMaNV, ensureStaffAdminHeaders } from "@/lib/staff-store";
import { verifyPassword, normalizeCode } from "@/lib/staff-security";
import { setAdminCookies } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function redirectLogin(req: NextRequest, message: string) {
  const url = new URL("/admin/login", req.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, { status: 303 });
}

function normalizePermission(value: any): "admin" | "mod" | "" {
  const v = String(value || "").trim().toLowerCase();
  if (v === "admin") return "admin";
  if (v === "mod" || v === "moderator") return "mod";
  return "";
}

async function checkPassword(input: string, saved: string) {
  const raw = String(saved || "").trim();
  if (!raw) return false;

  try {
    if (verifyPassword(input, raw)) return true;
  } catch {
    // Cho phép fallback phía dưới với mật khẩu cũ dạng plain text.
  }

  return input === raw;
}

function setSharedStaffCookie(res: NextResponse, name: string, value: string) {
  res.cookies.set(name, encodeURIComponent(value || ""), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function POST(req: NextRequest) {
  try {
    await ensureStaffAdminHeaders();

    const contentType = req.headers.get("content-type") || "";
    let maNV = "";
    let password = "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      maNV = normalizeCode(body.maNV);
      password = String(body.password || "").trim();
    } else {
      const form = await req.formData();
      maNV = normalizeCode(form.get("maNV"));
      password = String(form.get("password") || "").trim();
    }

    if (!maNV || !password) {
      return redirectLogin(req, "Vui lòng nhập mã nhân viên và mật khẩu.");
    }

    const staff = await findStaffByMaNV(maNV);

    if (!staff) {
      return redirectLogin(req, "Tài khoản không tồn tại trong hệ thống.");
    }

    if (String(staff.status || "").trim().toLowerCase() !== "active") {
      return redirectLogin(req, "Tài khoản chưa Active hoặc đã bị khóa.");
    }

    const permission = normalizePermission(staff.permission);

    if (!permission) {
      return redirectLogin(req, "Tài khoản này không thuộc đội ngũ quản trị viên.");
    }

    const ok = await checkPassword(password, staff.password);

    if (!ok) {
      return redirectLogin(req, "Mật khẩu không đúng.");
    }

    const url = new URL("/admin", req.url);
    const res = NextResponse.redirect(url, { status: 303 });

    setAdminCookies(res, {
      maNV: staff.maNV,
      name: staff.staffName || staff.maNV,
      permission,
      modules: staff.modulePermissions || "",
    });

    // Dùng chung API cập nhật thông tin với trang nhân viên.
    setSharedStaffCookie(res, "vtdd_staff_nv", staff.maNV || "");
    setSharedStaffCookie(res, "vtdd_staff_st", staff.maST || "");
    setSharedStaffCookie(res, "vtdd_staff_name", staff.staffName || staff.maNV || "Admin");
    setSharedStaffCookie(res, "vtdd_staff_store_name", staff.storeName || "");
    setSharedStaffCookie(res, "vtdd_staff_department", staff.department || "");
    setSharedStaffCookie(res, "vtdd_staff_gmail", staff.gmail || "");
    setSharedStaffCookie(res, "vtdd_staff_force_setup", "0");

    return res;
  } catch (err: any) {
    return redirectLogin(req, "Lỗi đăng nhập Admin: " + (err?.message || "Không đăng nhập được."));
  }
}
