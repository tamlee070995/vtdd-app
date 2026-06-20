import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createSignedSessionToken, verifySignedSessionToken } from "@/lib/auth-session";
import { findStaffByMaNV } from "@/lib/staff-store";

export type AdminPermission = "admin" | "mod";
export type AdminModuleKey = "tcdm" | "quy-trinh-thu-cu" | "may-moi" | "may-cu" | "demo" | "tools";
export type AdminActionKey =
  | "staff-manage"
  | "staff-security"
  | "settings-write"
  | "reload-data"
  | "dashboard-view"
  | "tools-pmh"
  | "tools-coming"
  | "tools-report"
  | "tools-telegram";

export const ADMIN_COOKIE = "vtdd_admin_token";
export const ADMIN_NV_COOKIE = "vtdd_admin_nv";
export const ADMIN_NAME_COOKIE = "vtdd_admin_name";
export const ADMIN_PERMISSION_COOKIE = "vtdd_admin_permission";
export const ADMIN_MODULES_COOKIE = "vtdd_admin_modules";

const MODULES: AdminModuleKey[] = ["tcdm", "quy-trinh-thu-cu", "may-moi", "may-cu", "demo", "tools"];
const ACTIONS: AdminActionKey[] = [
  "staff-manage",
  "staff-security",
  "settings-write",
  "reload-data",
  "dashboard-view",
  "tools-pmh",
  "tools-coming",
  "tools-report",
  "tools-telegram",
];
const ACTION_PREFIX = "action:";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

type AdminSessionData = {
  name?: string;
  permission?: AdminPermission;
  modules?: string;
};

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
  return normalizeAdminAccessTokens(value).filter((item): item is AdminModuleKey =>
    MODULES.includes(item as AdminModuleKey)
  );
}

function clearLegacyAdminCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}


export function normalizeAdminActions(value: any): AdminActionKey[] {
  return normalizeAdminAccessTokens(value)
    .filter((item) => item.startsWith(ACTION_PREFIX))
    .map((item) => item.slice(ACTION_PREFIX.length) as AdminActionKey)
    .filter((item, index, arr) => ACTIONS.includes(item) && arr.indexOf(item) === index);
}

export function normalizeAdminAccess(value: any) {
  return normalizeAdminAccessTokens(value).join(",");
}

function normalizeAdminAccessTokens(value: any) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .map((item) => {
      if (MODULES.includes(item as AdminModuleKey)) return item;
      if (!item.startsWith(ACTION_PREFIX)) return "";

      const action = item.slice(ACTION_PREFIX.length) as AdminActionKey;
      return ACTIONS.includes(action) ? `${ACTION_PREFIX}${action}` : "";
    })
    .filter((item, index, arr) => Boolean(item) && arr.indexOf(item) === index);
}

function parseAdminAccess(value: any) {
  const tokens = normalizeAdminAccessTokens(value);

  return {
    modules: tokens.filter((item): item is AdminModuleKey => MODULES.includes(item as AdminModuleKey)),
    actions: tokens
      .filter((item) => item.startsWith(ACTION_PREFIX))
      .map((item) => item.slice(ACTION_PREFIX.length) as AdminActionKey),
    hasExplicitActions: tokens.some((item) => item.startsWith(ACTION_PREFIX)),
  };
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

export function adminHasAction(
  admin:
    | {
        permission: AdminPermission;
        modules?: AdminModuleKey[];
        actions?: AdminActionKey[];
        hasExplicitActions?: boolean;
      }
    | null,
  action: AdminActionKey,
  legacyModule?: AdminModuleKey
) {
  if (!admin) return false;
  if (admin.permission === "admin") return true;
  if ((admin.actions || []).includes(action)) return true;
  if (admin.hasExplicitActions) return false;
  return legacyModule ? adminCanAccessModule(admin, legacyModule) : false;
}

export function adminCanUsePmhTool(
  admin:
    | {
        permission: AdminPermission;
        modules?: AdminModuleKey[];
        actions?: AdminActionKey[];
      }
    | null
) {
  if (!admin) return false;
  if (admin.permission === "admin") return true;
  const actions = admin.actions || [];
  if (actions.includes("tools-pmh")) return true;
  const hasToolActions = actions.some((action) => String(action).startsWith("tools-"));
  return !hasToolActions && (admin.modules || []).includes("tools");
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value || "";
  const session = verifySignedSessionToken<AdminSessionData>(token, "admin");

  if (!session) {
    return null;
  }

  const maNV = session.sub;
  let permission = normalizePermission(session.data?.permission || "");
  let access = parseAdminAccess(session.data?.modules || "");
  let name = String(session.data?.name || "").trim() || safeDecode(cookieStore.get(ADMIN_NAME_COOKIE)?.value || "Admin");

  if (!permission || !maNV) {
    return null;
  }

  // Lấy Google Sheet làm nguồn quyền chuẩn để tránh lỗi cookie cũ.
  // Nếu Sheet lỗi tạm thời thì fallback về payload đã ký, không tin cookie quyền rời rạc.
  try {
    const staff = await findStaffByMaNV(maNV);
    const sheetPermission = normalizePermission(staff?.permission);

    if (!staff || String(staff.status || "").trim().toLowerCase() !== "active") {
      return null;
    }

    if (sheetPermission) {
      permission = sheetPermission;
      access = parseAdminAccess(staff?.modulePermissions || "");
      name = staff?.staffName || name || maNV;
    }
  } catch {
    // Giữ session đã ký để tránh chặn toàn bộ Admin khi Google Sheet lỗi ngắn hạn.
  }

  return {
    maNV,
    name,
    permission,
    modules: access.modules,
    actions: access.actions,
    hasExplicitActions: access.hasExplicitActions,
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
  options?: { write?: boolean; module?: AdminModuleKey; action?: AdminActionKey }
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

  if (options?.module && !adminCanAccessModule(admin, options.module)) {
    return {
      admin,
      response: NextResponse.json(
        { success: false, message: "Không có quyền truy cập." },
        { status: 403 }
      ),
    };
  }

  if (options?.action && !adminHasAction(admin, options.action, options.module)) {
    return {
      admin,
      response: NextResponse.json(
        { success: false, message: "Không có quyền thực hiện thao tác này." },
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

  const modules = normalizeAdminAccess(data.modules);
  const sessionToken = createSignedSessionToken<AdminSessionData>(
    "admin",
    data.maNV,
    ADMIN_SESSION_MAX_AGE,
    {
      name: data.name || "Admin",
      permission: data.permission,
      modules,
    }
  );

  res.cookies.set(ADMIN_COOKIE, sessionToken, base);
  [ADMIN_NV_COOKIE, ADMIN_NAME_COOKIE, ADMIN_PERMISSION_COOKIE, ADMIN_MODULES_COOKIE].forEach((name) =>
    clearLegacyAdminCookie(res, name)
  );
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
