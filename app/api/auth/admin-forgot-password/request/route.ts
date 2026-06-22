import { NextRequest, NextResponse } from "next/server";
import { findStaffByMaNV, updateStaffResetOtp } from "@/lib/staff-store";
import { decryptText, hashPassword, normalizeCode, normalizeText } from "@/lib/staff-security";
import { sendResetOtpMail } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OTP_EXPIRES_MINUTES = 10;
const OTP_MAX_PER_DAY = 3;
const ADMIN_GMAIL_MISMATCH_MESSAGE =
  "Mã nhân viên Admin và Gmail không khớp với tài khoản đã đăng ký.";
const ADMIN_INACTIVE_MESSAGE =
  "Tài khoản Admin chưa Active hoặc đã bị khóa.";
const ADMIN_PERMISSION_MESSAGE =
  "Tài khoản này không thuộc đội ngũ quản trị.";

function redirectBack(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/admin/forgot-password", req.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url, { status: 303 });
}

function hasAdminPermission(value: any) {
  const permission = String(value || "").trim().toLowerCase();
  return permission === "admin" || permission === "mod" || permission === "moderator";
}

function safeDecrypt(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return decryptText(raw) || raw;
  } catch {
    return raw;
  }
}

function normalizeEmail(value: any) {
  const email = normalizeText(value).toLowerCase().replace(/^mailto:/i, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

function createOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function parseOtpExpiresMs(value: any) {
  const raw = String(value || "").trim();
  if (!raw) return 0;

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function todayKey() {
  return new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const maNV = normalizeCode(form.get("maNV"));
    const gmailInput = normalizeEmail(form.get("gmail"));

    if (!maNV || !gmailInput) {
      return redirectBack(req, { error: "Vui lòng nhập mã nhân viên và Gmail đã đăng ký." });
    }

    const staff = await findStaffByMaNV(maNV);

    if (!staff) {
      return redirectBack(req, { maNV, error: ADMIN_GMAIL_MISMATCH_MESSAGE });
    }

    if (String(staff.status || "").trim().toLowerCase() !== "active") {
      return redirectBack(req, { maNV, error: ADMIN_INACTIVE_MESSAGE });
    }

    if (!hasAdminPermission(staff.permission)) {
      return redirectBack(req, { maNV, error: ADMIN_PERMISSION_MESSAGE });
    }

    const gmail = normalizeEmail(safeDecrypt(staff.gmail));

    if (!gmail || gmail !== gmailInput) {
      return redirectBack(req, { maNV, error: ADMIN_GMAIL_MISMATCH_MESSAGE });
    }

    const today = todayKey();
    const oldDay = String(staff.resetOtpDay || "").trim();
    const oldCount = oldDay === today ? Number(staff.resetOtpCount || 0) : 0;

    if (oldCount >= OTP_MAX_PER_DAY) {
      return redirectBack(req, { error: "Tài khoản đã gửi OTP tối đa 3 lần trong ngày." });
    }

    const oldExpires = parseOtpExpiresMs(staff.resetOtpExpires);
    if (staff.resetOtpHash && oldExpires && oldExpires > Date.now()) {
      const retryAfterSec = Math.ceil((oldExpires - Date.now()) / 1000);
      return redirectBack(req, {
        sent: "1",
        maNV: staff.maNV,
        retryAfterSec: String(retryAfterSec),
        error: "Mã OTP cũ vẫn còn hiệu lực. Vui lòng chờ đủ 10 phút rồi gửi lại.",
      });
    }

    const otp = createOtpCode();
    const expires = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000).toISOString();

    await updateStaffResetOtp(staff.rowNumber, {
      maNV: staff.maNV,
      otpHash: hashPassword(otp),
      expiresAt: expires,
      day: today,
      count: oldCount + 1,
    });

    await sendResetOtpMail({
      to: gmail,
      staffName: staff.staffName,
      maNV: staff.maNV,
      otp,
    });

    return redirectBack(req, {
      sent: "1",
      maNV: staff.maNV,
      success: "Đã gửi mã OTP đến email khôi phục. Mã có hiệu lực trong 10 phút.",
    });
  } catch (err: any) {
    console.error("ADMIN_FORGOT_OTP_ERROR:", err?.message || err);
    return redirectBack(req, { error: "Không gửi được OTP. Vui lòng thử lại sau." });
  }
}
