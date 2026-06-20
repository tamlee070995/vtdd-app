import { NextRequest, NextResponse } from "next/server";
import { findStaffByMaNV, resetStaffPasswordByOtp } from "@/lib/staff-store";
import { hashPassword, normalizeCode, verifyPassword } from "@/lib/staff-security";

export const dynamic = "force-dynamic";

function redirectForgot(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/admin/forgot-password", req.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url, { status: 303 });
}

function redirectLogin(req: NextRequest, message: string) {
  const url = new URL("/admin/login", req.url);
  url.searchParams.set("success", message);
  return NextResponse.redirect(url, { status: 303 });
}

function checkPasswordRule(password: string) {
  if (password.length < 6) return "Mật khẩu phải có ít nhất 6 ký tự.";
  if (!/[A-Z]/.test(password)) return "Mật khẩu phải có ít nhất 1 chữ HOA.";
  if (!/[a-z]/.test(password)) return "Mật khẩu phải có ít nhất 1 chữ thường.";
  if (!/[0-9]/.test(password)) return "Mật khẩu phải có ít nhất 1 số.";
  if (!/[!@#]/.test(password)) return "Mật khẩu phải có ký tự đặc biệt ! @ #.";
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const maNV = normalizeCode(form.get("maNV"));
    const otp = String(form.get("otp") || "").trim();
    const password = String(form.get("password") || "").trim();
    const confirmPassword = String(form.get("confirmPassword") || "").trim();

    if (!maNV || !otp || !password || !confirmPassword) {
      return redirectForgot(req, { sent: "1", maNV, error: "Vui lòng nhập đầy đủ OTP và mật khẩu mới." });
    }

    const rule = checkPasswordRule(password);
    if (rule) return redirectForgot(req, { sent: "1", maNV, error: rule });

    if (password !== confirmPassword) {
      return redirectForgot(req, { sent: "1", maNV, error: "Mật khẩu xác nhận chưa khớp." });
    }

    const staff = await findStaffByMaNV(maNV);
    if (!staff || !staff.resetOtpHash) {
      return redirectForgot(req, { sent: "1", maNV, error: "Không tìm thấy OTP hợp lệ." });
    }

    if (staff.resetOtpExpires && Date.now() > new Date(staff.resetOtpExpires).getTime()) {
      return redirectForgot(req, { sent: "1", maNV, error: "OTP đã hết hạn. Vui lòng gửi lại mã mới." });
    }

    const ok = verifyPassword(otp, staff.resetOtpHash);
    if (!ok) {
      return redirectForgot(req, { sent: "1", maNV, error: "OTP không đúng." });
    }

    await resetStaffPasswordByOtp(staff.rowNumber, { passwordHash: hashPassword(password) });

    return redirectLogin(req, "Đã đặt lại mật khẩu. Vui lòng đăng nhập lại.");
  } catch (err: any) {
    console.error("ADMIN_FORGOT_RESET_ERROR:", err?.message || err);
    return redirectForgot(req, { error: "Không đặt lại được mật khẩu. Vui lòng thử lại sau." });
  }
}
