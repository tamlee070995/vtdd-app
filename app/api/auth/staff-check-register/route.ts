import { NextRequest, NextResponse } from "next/server";
import { createStandbyAccount, findStaffByMaNV, getStaffRows } from "@/lib/staff-store";
import {
  decryptText,
  encryptText,
  hashPassword,
  normalizeCode,
  normalizeText,
} from "@/lib/staff-security";
import { verifyCaptchaAnswer } from "@/lib/captcha";
import { getPublicMailError, sendNewStaffAccountMail } from "@/lib/mail";
import {
  clearRegisterEmailOtpCookie,
  verifyRegisterEmailOtp,
} from "@/lib/register-email-otp";
import {
  checkRegisterRateLimit,
  checkRegisterTrap,
  getRegisterClientIp,
  recordRegisterIpSuccess,
  verifyRegisterTurnstile,
} from "@/lib/register-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeStaffUser(value: any) {
  const user = normalizeCode(value);
  return /^\d+$/.test(user) ? user : "";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

function checkPasswordRule(password: string) {
  if (password.length < 6) return "Mật khẩu phải có ít nhất 6 ký tự.";
  if (!/[A-Z]/.test(password)) return "Mật khẩu phải có ít nhất 1 ký tự viết HOA.";
  if (!/[a-z]/.test(password)) return "Mật khẩu phải có ít nhất 1 ký tự viết thường.";
  if (!/[0-9]/.test(password)) return "Mật khẩu phải có ít nhất 1 số.";
  if (!/[!@#]/.test(password)) return "Mật khẩu phải có ít nhất 1 ký tự đặc biệt: !, @ hoặc #.";
  return "";
}

function checkGmailRule(gmail: string) {
  const value = String(gmail || "").trim().toLowerCase();
  if (!value) return "Vui lòng nhập Gmail xác thực.";
  if (value.includes(" ")) return "Gmail không được có khoảng trắng.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Gmail chưa đúng định dạng.";
  if (!value.endsWith("@gmail.com")) return "Gmail xác thực phải là địa chỉ @gmail.com.";
  return "";
}

function titleCaseVietnameseName(value: string) {
  const clean = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi-VN");

  if (!clean) return "";

  return clean.replace(/(^|[\s'-])(\p{L})/gu, (_match, prefix: string, char: string) => {
    return prefix + char.toLocaleUpperCase("vi-VN");
  });
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

    const maNV = normalizeStaffUser(body.maNV || body.user);
    const maST = normalizeStaffUser(body.maST);
    const staffName = titleCaseVietnameseName(normalizeText(body.staffName));
    const password = normalizeText(body.password);
    const confirmPassword = normalizeText(body.confirmPassword);
    const questionType = normalizeText(body.questionType);
    const customQuestion = normalizeText(body.customQuestion);
    const answer = normalizeText(body.answer);
    const gmail = normalizeText(body.gmail).toLowerCase();
    const emailOtp = normalizeText(body.emailOtp);
    const captchaToken = normalizeText(body.captchaToken);
    const captchaAnswer = normalizeText(body.captchaAnswer);
    const formStartedAt = normalizeText(body.formStartedAt);
    const honeypot = normalizeText(body.companyWebsite);
    const turnstileToken = normalizeText(body.turnstileToken);
    const clientIp = getRegisterClientIp(req);

    const trapError = checkRegisterTrap({ honeypot, formStartedAt });
    if (trapError) return jsonError(trapError);

    const rateLimitError = checkRegisterRateLimit({ ip: clientIp, maNV, gmail });
    if (rateLimitError) return jsonError(rateLimitError, 429);

    const turnstile = await verifyRegisterTurnstile(turnstileToken, clientIp);
    if (!turnstile.ok) {
      return jsonError(turnstile.message || "Không xác thực được chống spam. Vui lòng thử lại.");
    }

    if (!verifyCaptchaAnswer(captchaToken, captchaAnswer)) {
      return jsonError("Captcha không đúng hoặc đã hết hạn. Vui lòng thử lại.");
    }

    const question = questionType === "custom" ? customQuestion : questionType;

    if (!maNV) {
      return jsonError("Mã nhân viên chỉ được nhập số.");
    }

    if (!maST || !staffName || !password || !confirmPassword || !question || !answer || !gmail || !emailOtp) {
      return jsonError("Vui lòng nhập đầy đủ thông tin tạo tài khoản.");
    }

    const passwordRuleError = checkPasswordRule(password);
    if (passwordRuleError) return jsonError(passwordRuleError);

    if (password !== confirmPassword) {
      return jsonError("Mật khẩu xác nhận chưa khớp.");
    }

    const gmailRuleError = checkGmailRule(gmail);
    if (gmailRuleError) return jsonError(gmailRuleError);

    if (!/^\d{6}$/.test(emailOtp)) {
      return jsonError("Vui lòng nhập đúng mã OTP Gmail gồm 6 số.");
    }

    if (!verifyRegisterEmailOtp(req, { email: gmail, maNV, maST, otp: emailOtp })) {
      return jsonError("OTP Gmail không đúng, đã hết hạn hoặc không khớp với thông tin đăng ký.");
    }

    if (await findStaffByMaNV(maNV)) {
      return jsonError("Bạn đã có tài khoản, chờ thông tin hướng dẫn sử dụng từ admin.");
    }

    if (await isGmailAlreadyUsed(gmail)) {
      return jsonError("Gmail này đã được dùng để tạo tài khoản khác. Vui lòng sử dụng Gmail khác.");
    }

    await createStandbyAccount({
      maNV,
      maST,
      staffName,
      passwordHash: hashPassword(password),
      encryptedQuestion: encryptText(question),
      answerHash: hashPassword(answer),
      encryptedGmail: encryptText(gmail),
      needSetup: "0",
    });

    const ipStats = recordRegisterIpSuccess(clientIp, maNV);

    try {
      await sendNewStaffAccountMail({
        maNV,
        maST,
        staffName,
        gmail,
        registrationIp: clientIp,
        ipAccountCount: ipStats.count,
        ipRecentUsers: ipStats.recentUsers,
        adminUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://vienthongdidong.com"}/admin`,
      });
    } catch (mailErr) {
      console.error("STAFF_CHECK_REGISTER_MAIL_ERROR:", mailErr);
      const response = NextResponse.json({
        success: true,
        mailSent: false,
        message: `Đã tạo tài khoản. Chờ thông tin hướng dẫn sử dụng từ admin. ${getPublicMailError(mailErr)}`,
      });
      clearRegisterEmailOtpCookie(response);
      return response;
    }

    const response = NextResponse.json({
      success: true,
      mailSent: true,
      message: "Đã tạo tài khoản. Chờ thông tin hướng dẫn sử dụng từ admin.",
    });
    clearRegisterEmailOtpCookie(response);
    return response;
  } catch (err: any) {
    console.error("STAFF_CHECK_REGISTER_ERROR:", err?.message || err);
    return jsonError("Không tạo được tài khoản. Vui lòng thử lại sau.", 500);
  }
}
