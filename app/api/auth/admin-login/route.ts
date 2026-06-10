import { NextRequest, NextResponse } from "next/server";
import { findStaffByMaNV, ensureStaffAdminHeaders } from "@/lib/staff-store";
import { verifyPassword, normalizeCode } from "@/lib/staff-security";
import { setAdminCookies } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function normalizePermission(value: any): "admin" | "mod" | "" {
  const v = String(value || "").trim().toLowerCase();
  if (v === "admin") return "admin";
  if (v === "mod" || v === "moderator") return "mod";
  return "";
}

function redirectLogin(req: NextRequest, message: string) {
  const url = new URL("/admin/login", req.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, { status: 303 });
}

function fail(req: NextRequest, message: string, jsonMode: boolean, status = 400) {
  if (jsonMode) {
    return NextResponse.json({ success: false, message }, { status });
  }

  return redirectLogin(req, message);
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
  const contentType = req.headers.get("content-type") || "";
  const jsonMode = contentType.includes("application/json");

  try {
    await ensureStaffAdminHeaders();

    let maNV = "";
    let password = "";

    if (jsonMode) {
      const body = await req.json().catch(() => null);
      maNV = normalizeCode(body?.maNV);
      password = String(body?.password || "").trim();
    } else {
      const form = await req.formData();
      maNV = normalizeCode(form.get("maNV"));
      password = String(form.get("password") || "").trim();
    }

    if (!maNV || !password) {
      return fail(req, "Vui lòng nhập mã nhân viên và mật khẩu.", jsonMode, 400);
    }

    const staff = await findStaffByMaNV(maNV);

    if (!staff) {
      return fail(req, "Tài khoản không tồn tại trong hệ thống.", jsonMode, 404);
    }

    if (String(staff.status || "").trim().toLowerCase() !== "active") {
      return fail(req, "Tài khoản chưa Active hoặc đã bị khóa.", jsonMode, 403);
    }

    const permission = normalizePermission(staff.permission);

    if (!permission) {
      return fail(req, "Tài khoản này không thuộc đội ngũ quản trị viên.", jsonMode, 403);
    }

    const ok = await checkPassword(password, staff.password);

    if (!ok) {
      return fail(req, "Mật khẩu không đúng.", jsonMode, 401);
    }

    const res = jsonMode
      ? NextResponse.json({ success: true, redirectTo: "/admin" })
      : NextResponse.redirect(new URL("/admin", req.url), { status: 303 });

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
    return fail(req, "Lỗi đăng nhập Admin: " + (err?.message || "Không đăng nhập được."), jsonMode, 500);
  }
}
