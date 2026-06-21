import { NextRequest, NextResponse } from "next/server";
import { findStaffByMaNV, updateStaffResetOtp } from "@/lib/staff-store";
import { decryptText, hashPassword, normalizeCode } from "@/lib/staff-security";
import { sendResetOtpMail } from "@/lib/mail";

export const dynamic = "force-dynamic";

const OTP_EXPIRES_MINUTES = 10;
const OTP_MAX_PER_DAY = 3;
const GENERIC_ADMIN_OTP_MESSAGE =
  "Nếu tài khoản quản trị hợp lệ và đã cấu hình Gmail khôi phục, hệ thống sẽ gửi OTP trong ít phút.";

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

function createOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function todayKey() {
  return new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const maNV = normalizeCode(form.get("maNV"));

    if (!maNV) {
      return redirectBack(req, { error: "Vui lòng nhập mã nhân viên." });
    }

    const staff = await findStaffByMaNV(maNV);

    if (!staff) {
      return redirectBack(req, { sent: "1", maNV, success: GENERIC_ADMIN_OTP_MESSAGE });
    }

    if (String(staff.status || "").trim().toLowerCase() !== "active") {
      return redirectBack(req, { sent: "1", maNV, success: GENERIC_ADMIN_OTP_MESSAGE });
    }

    if (!hasAdminPermission(staff.permission)) {
      return redirectBack(req, { sent: "1", maNV, success: GENERIC_ADMIN_OTP_MESSAGE });
    }

    const gmail = safeDecrypt(staff.gmail);

    if (!gmail) {
      return redirectBack(req, { sent: "1", maNV, success: GENERIC_ADMIN_OTP_MESSAGE });
    }

    const today = todayKey();
    const oldDay = String(staff.resetOtpDay || "").trim();
    const oldCount = oldDay === today ? Number(staff.resetOtpCount || 0) : 0;

    if (oldCount >= OTP_MAX_PER_DAY) {
      return redirectBack(req, { error: "Tài khoản đã gửi OTP tối đa 3 lần trong ngày." });
    }

    const oldExpires = staff.resetOtpExpires ? new Date(staff.resetOtpExpires).getTime() : 0;
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
