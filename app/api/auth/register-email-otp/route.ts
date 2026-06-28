import { NextRequest, NextResponse } from "next/server";
import { verifyCaptchaAnswer } from "@/lib/captcha";
import { getPublicMailError, sendRegisterEmailOtpMail } from "@/lib/mail";
import {
  checkRegisterEmailOtpRateLimit,
  createRegisterEmailOtpToken,
  generateRegisterEmailOtp,
  getRegisterEmailOtpCooldown,
  setRegisterEmailOtpCookie,
} from "@/lib/register-email-otp";
import { getRegisterClientIp } from "@/lib/register-guard";
import { findStaffByMaNV, getStaffRows } from "@/lib/staff-store";
import { decryptText, normalizeCode, normalizeText } from "@/lib/staff-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

function checkGmailRule(gmail: string) {
  const value = String(gmail || "").trim().toLowerCase();
  if (!value) return "Vui lòng nhập Gmail xác thực.";
  if (value.includes(" ")) return "Gmail không được có khoảng trắng.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Gmail chưa đúng định dạng.";
  if (!value.endsWith("@gmail.com")) return "Gmail xác thực phải là địa chỉ @gmail.com.";
  return "";
}

function safeDecryptGmail(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const decrypted = decryptText(raw);
    if (decrypted) return decrypted;
    return raw.startsWith("enc:v1:") ? "" : raw;
  } catch {
    return raw.startsWith("enc:v1:") ? "" : raw;
  }
}

async function isGmailAlreadyUsed(gmail: string) {
  const targetGmail = String(gmail || "").trim().toLowerCase();
  const rows = await getStaffRows();

  return rows.some((staff) => {
    const staffGmail = String(safeDecryptGmail(staff.gmail)).trim().toLowerCase();
    return staffGmail === targetGmail;
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const maNV = normalizeCode(body.maNV || body.user);
    const maST = normalizeCode(body.maST);
    const staffName = normalizeText(body.staffName);
    const gmail = normalizeText(body.gmail).toLowerCase();
    const captchaToken = normalizeText(body.captchaToken);
    const captchaAnswer = normalizeText(body.captchaAnswer);
    const clientIp = getRegisterClientIp(req);

    if (!maNV || !/^\d+$/.test(maNV)) {
      return jsonError("Vui lòng nhập mã nhân viên bằng số trước khi gửi OTP.");
    }

    if (!maST || !/^\d+$/.test(maST)) {
      return jsonError("Vui lòng nhập mã siêu thị bằng số trước khi gửi OTP.");
    }

    const gmailRuleError = checkGmailRule(gmail);
    if (gmailRuleError) return jsonError(gmailRuleError);

    if (!captchaToken || !captchaAnswer) {
      return jsonError("Vui lòng nhập kết quả captcha trước khi gửi OTP.");
    }

    if (!verifyCaptchaAnswer(captchaToken, captchaAnswer)) {
      return jsonError("Captcha không đúng hoặc đã hết hạn. Vui lòng tải lại captcha và thử lại.");
    }

    if (await findStaffByMaNV(maNV)) {
      return jsonError("Mã nhân viên này đã tồn tại trên hệ thống.");
    }

    if (await isGmailAlreadyUsed(gmail)) {
      return jsonError("Gmail này đã được dùng để tạo tài khoản khác. Vui lòng sử dụng Gmail khác.");
    }

    const cooldown = getRegisterEmailOtpCooldown(req, { email: gmail, maNV, maST });
    if (cooldown > 0) {
      return jsonError(`Vui lòng chờ ${cooldown} giây trước khi gửi lại OTP.`, 429);
    }

    const rateLimitError = checkRegisterEmailOtpRateLimit({
      ip: clientIp,
      maNV,
      email: gmail,
    });

    if (rateLimitError) {
      return jsonError(rateLimitError, 429);
    }

    const otp = generateRegisterEmailOtp();
    await sendRegisterEmailOtpMail({
      to: gmail,
      maNV,
      maST,
      staffName,
      otp,
    });

    const response = NextResponse.json({
      success: true,
      message: `Đã gửi OTP đến Gmail ${gmail}. Mã có hiệu lực trong 10 phút.`,
    });

    setRegisterEmailOtpCookie(
      response,
      createRegisterEmailOtpToken({ email: gmail, maNV, maST, otp })
    );

    return response;
  } catch (err: any) {
    console.error("REGISTER_EMAIL_OTP_ERROR:", err?.message || err);
    return jsonError(`Không gửi được OTP Gmail. ${getPublicMailError(err)}`, 500);
  }
}
