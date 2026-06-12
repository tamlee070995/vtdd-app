import { NextRequest, NextResponse } from "next/server";
import { findStaffByMaNV, ensureStaffAdminHeaders } from "@/lib/staff-store";
import { verifyPassword, normalizeCode } from "@/lib/staff-security";
import { setAdminCookies } from "@/lib/admin-auth";
import { setStaffSessionCookies } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

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
    // fallback mật khẩu cũ dạng plain text
  }

  return input === raw;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
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
      return jsonError("Vui lòng nhập mã nhân viên và mật khẩu.");
    }

    const staff = await findStaffByMaNV(maNV);

    if (!staff) {
      return jsonError("Tài khoản không tồn tại trong hệ thống.", 404);
    }

    if (String(staff.status || "").trim().toLowerCase() !== "active") {
      return jsonError("Tài khoản chưa Active hoặc đã bị khóa.", 403);
    }

    const permission = normalizePermission(staff.permission);

    if (!permission) {
      return jsonError("Tài khoản này không thuộc đội ngũ quản trị viên.", 403);
    }

    const ok = await checkPassword(password, staff.password);

    if (!ok) {
      return jsonError("Mật khẩu không đúng.", 401);
    }

    const res = NextResponse.json({
      success: true,
      message: "Đăng nhập Admin thành công.",
      redirectTo: "/admin",
    });

    setAdminCookies(res, {
      maNV: staff.maNV,
      name: staff.staffName || staff.maNV,
      permission,
      modules: staff.modulePermissions || "",
    });

    setStaffSessionCookies(res, {
      maNV: staff.maNV,
      maST: staff.maST || "",
      staffName: staff.staffName || "Admin",
      storeName: staff.storeName || "",
      department: staff.department || "",
      gmail: "",
      forceSetup: false,
    });

    return res;
  } catch (err: any) {
    return jsonError("Lỗi đăng nhập Admin: " + (err?.message || "Không đăng nhập được."), 500);
  }
}
