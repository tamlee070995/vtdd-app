import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { findStaffByMaNV } from "@/lib/staff-store";

export type AdminPermission = "admin" | "mod";
export type AdminModuleKey = "tcdm" | "quy-trinh-thu-cu" | "may-moi" | "may-cu" | "demo" | "tools";

export const ADMIN_COOKIE = "vtdd_admin_token";
export const ADMIN_NV_COOKIE = "vtdd_admin_nv";
export const ADMIN_NAME_COOKIE = "vtdd_admin_name";
export const ADMIN_PERMISSION_COOKIE = "vtdd_admin_permission";
export const ADMIN_MODULES_COOKIE = "vtdd_admin_modules";

const MODULES: AdminModuleKey[] = ["tcdm", "quy-trinh-thu-cu", "may-moi", "may-cu", "demo", "tools"];

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return value || "";
  }
}

function normalizePermission(value: any): AdminPermission | "" {
  const v = String(value || "").trim().toLowerCase();
  if (v === "admin") return "admin";
  if (v === "mod" || v === "moderator") return "mod";
  return "";
}

export function normalizeAdminModules(value: any): AdminModuleKey[] {
  const raw = String(value || "").trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((item) => item.trim() as AdminModuleKey)
    .filter((item, index, arr) => MODULES.includes(item) && arr.indexOf(item) === index);
}

export function adminCanAccessModule(
  admin: { permission: AdminPermission; modules?: AdminModuleKey[] } | null,
  module?: AdminModuleKey
) {
  if (!admin) return false;
  if (admin.permission === "admin") return true;
  if (!module) return false;
  return (admin.modules || []).includes(module);
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value || "";

  let permission = normalizePermission(cookieStore.get(ADMIN_PERMISSION_COOKIE)?.value || "");
  let modules = normalizeAdminModules(safeDecode(cookieStore.get(ADMIN_MODULES_COOKIE)?.value || ""));
  const maNV = safeDecode(cookieStore.get(ADMIN_NV_COOKIE)?.value || "");
  let name = safeDecode(cookieStore.get(ADMIN_NAME_COOKIE)?.value || "Admin");

  if (token !== "admin-ok" || !permission || !maNV) {
    return null;
  }

  // Lấy Google Sheet làm nguồn quyền chuẩn để tránh lỗi cookie cũ.
  // Ví dụ: tài khoản vừa được nâng lên admin nhưng cookie cũ vẫn là mod.
  try {
    const staff = await findStaffByMaNV(maNV);
    const sheetPermission = normalizePermission(staff?.permission);

    if (sheetPermission) {
      permission = sheetPermission;
      modules = normalizeAdminModules(staff?.modulePermissions || "");
      name = staff?.staffName || name || maNV;
    }
  } catch {
    // Nếu Sheet lỗi tạm thời thì dùng cookie hiện có để không chặn toàn bộ Admin.
  }

  return {
    maNV,
    name,
    permission,
    modules,
    isAdmin: permission === "admin",
    isMod: permission === "mod",
  };
}

export async function requireAdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) return null;
  return admin;
}

export async function requireAdminApi(
  req?: NextRequest,
  options?: { write?: boolean; module?: AdminModuleKey }
) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return {
      admin: null,
      response: NextResponse.json(
        { success: false, message: "Bạn chưa đăng nhập Admin." },
        { status: 401 }
      ),
    };
  }

  if (options?.write && !adminCanAccessModule(admin, options.module)) {
    return {
      admin,
      response: NextResponse.json(
        { success: false, message: "Không có quyền truy cập." },
        { status: 403 }
      ),
    };
  }

  return { admin, response: null };
}

export function setAdminCookies(
  res: NextResponse,
  data: {
    maNV: string;
    name: string;
    permission: AdminPermission;
    modules?: string;
  }
) {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 8,
  };

  const modules = normalizeAdminModules(data.modules).join(",");

  res.cookies.set(ADMIN_COOKIE, "admin-ok", base);
  res.cookies.set(ADMIN_NV_COOKIE, encodeURIComponent(data.maNV || ""), base);
  res.cookies.set(ADMIN_NAME_COOKIE, encodeURIComponent(data.name || "Admin"), base);
  res.cookies.set(ADMIN_PERMISSION_COOKIE, data.permission, base);
  res.cookies.set(ADMIN_MODULES_COOKIE, encodeURIComponent(modules), base);
}

export function clearAdminCookies(res: NextResponse) {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  res.cookies.set(ADMIN_COOKIE, "", base);
  res.cookies.set(ADMIN_NV_COOKIE, "", base);
  res.cookies.set(ADMIN_NAME_COOKIE, "", base);
  res.cookies.set(ADMIN_PERMISSION_COOKIE, "", base);
  res.cookies.set(ADMIN_MODULES_COOKIE, "", base);
}
