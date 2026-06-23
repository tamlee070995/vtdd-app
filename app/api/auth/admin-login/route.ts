import { NextRequest, NextResponse } from "next/server";
import { findStaffByMaNV, ensureStaffAdminHeaders, getStaffRows } from "@/lib/staff-store";
import { verifyPassword, normalizeCode, decryptText } from "@/lib/staff-security";
import { setAdminCookies } from "@/lib/admin-auth";
import { setStaffSessionCookies } from "@/lib/staff-auth";
import { sendAdminLoginFailedAlertMail } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FAIL_WINDOW_MS = 15 * 60 * 1000;
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;

type AdminLoginFailRecord = {
  count: number;
  firstAt: number;
  lastAt: number;
  lastAlertAt: number;
};

const failRecords = new Map<string, AdminLoginFailRecord>();

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

function clean(value: any) {
  return String(value ?? "").trim();
}

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("forwarded") || "";
  const forwardedFor = forwarded.match(/for="?([^;,"]+)/i)?.[1] || "";

  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("true-client-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-client-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    forwardedFor ||
    "Không xác định"
  );
}

function getAttemptKey(maNV: string, ip: string) {
  return `${ip || "unknown"}:${maNV || "unknown"}`;
}

function normalizeEmail(value: any) {
  const email = clean(value).toLowerCase().replace(/^mailto:/i, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

function safeDecrypt(value: any) {
  const raw = clean(value);
  if (!raw) return "";

  try {
    const decrypted = decryptText(raw);
    if (decrypted) return decrypted;
    return raw.startsWith("enc:v1:") ? "" : raw;
  } catch {
    return raw.startsWith("enc:v1:") ? "" : raw;
  }
}

async function getAdminAlertRecipients() {
  const rows = await getStaffRows();
  const recipients = new Set<string>();

  rows.forEach((staff) => {
    if (normalizePermission(staff.permission) !== "admin") return;
    if (clean(staff.status).toLowerCase() !== "active") return;

    const email = normalizeEmail(safeDecrypt(staff.gmail));
    if (email) recipients.add(email);
  });

  const fallback = normalizeEmail(process.env.ADMIN_SECURITY_ALERT_EMAIL || process.env.ADMIN_NOTIFY_EMAIL);
  if (fallback) recipients.add(fallback);

  return Array.from(recipients);
}

function getAdminUrl(req: NextRequest) {
  const baseUrl = String(process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/+$/, "");
  return `${baseUrl}/admin`;
}

async function recordFailedAdminLogin(req: NextRequest, maNV: string, reason: string) {
  const ip = getClientIp(req);
  const key = getAttemptKey(maNV, ip);
  const now = Date.now();
  const oldRecord = failRecords.get(key);
  const record =
    oldRecord && now - oldRecord.firstAt <= FAIL_WINDOW_MS
      ? {
          ...oldRecord,
          count: oldRecord.count + 1,
          lastAt: now,
        }
      : {
          count: 1,
          firstAt: now,
          lastAt: now,
          lastAlertAt: 0,
        };

  failRecords.set(key, record);

  if (record.count < 3 || now - record.lastAlertAt < ALERT_COOLDOWN_MS) return;

  try {
    const recipients = await getAdminAlertRecipients();
    if (recipients.length === 0) return;

    await sendAdminLoginFailedAlertMail({
      to: recipients,
      attemptedMaNV: maNV || "Không rõ",
      reason,
      ip,
      userAgent: req.headers.get("user-agent") || "Không xác định",
      failCount: record.count,
      adminUrl: getAdminUrl(req),
    });

    record.lastAlertAt = now;
    failRecords.set(key, record);
  } catch (err: any) {
    console.error("ADMIN_LOGIN_FAIL_ALERT_ERROR:", err?.message || err);
  }
}

function clearFailedAdminLogin(req: NextRequest, maNV: string) {
  failRecords.delete(getAttemptKey(maNV, getClientIp(req)));
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
      await recordFailedAdminLogin(req, maNV, "Tài khoản không tồn tại");
      return jsonError("Tài khoản không tồn tại trong hệ thống.", 404);
    }

    if (String(staff.status || "").trim().toLowerCase() !== "active") {
      await recordFailedAdminLogin(req, maNV, "Tài khoản chưa Active hoặc đã bị khóa");
      return jsonError("Tài khoản chưa Active hoặc đã bị khóa.", 403);
    }

    const permission = normalizePermission(staff.permission);

    if (!permission) {
      await recordFailedAdminLogin(req, maNV, "Tài khoản không thuộc đội ngũ quản trị");
      return jsonError("Tài khoản này không thuộc đội ngũ quản trị viên.", 403);
    }

    const ok = await checkPassword(password, staff.password);

    if (!ok) {
      await recordFailedAdminLogin(req, maNV, "Mật khẩu Admin không đúng");
      return jsonError("Mật khẩu không đúng.", 401);
    }

    clearFailedAdminLogin(req, maNV);

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
    console.error("ADMIN_LOGIN_ERROR:", err?.message || err);
    return jsonError("Lỗi đăng nhập Admin. Vui lòng thử lại sau.", 500);
  }
}
