import { NextRequest, NextResponse } from "next/server";
import { findStaffByMaNV, resetStaffPasswordByOtp } from "@/lib/staff-store";
import { getPasswordRuleError, hashPassword, normalizeCode, normalizeText, verifyPassword } from "@/lib/staff-security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const maNV = normalizeCode(body.maNV);
    const otp = normalizeCode(body.otp);
    const newPassword = normalizeText(body.newPassword);
    const confirmPassword = normalizeText(body.confirmPassword);

    if (!maNV || !otp || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập đầy đủ mã nhân viên, OTP và mật khẩu mới." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu xác nhận không khớp." },
        { status: 400 }
      );
    }

    const passwordRuleError = getPasswordRuleError(newPassword);

    if (passwordRuleError) {
      return NextResponse.json(
        { success: false, message: passwordRuleError },
        { status: 400 }
      );
    }

    if (newPassword === (process.env.DEFAULT_STAFF_PASSWORD || "123123")) {
      return NextResponse.json(
        { success: false, message: "Không được sử dụng mật khẩu mặc định 123123." },
        { status: 400 }
      );
    }

    const staff = await findStaffByMaNV(maNV);

    if (!staff) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy tài khoản nhân viên." },
        { status: 404 }
      );
    }

    if (!staff.resetOtpHash || !staff.resetOtpExpires) {
      return NextResponse.json(
        { success: false, message: "Chưa có mã OTP hoặc mã đã được sử dụng." },
        { status: 400 }
      );
    }

    const expiresAt = Number(staff.resetOtpExpires || 0);

    if (!expiresAt || Date.now() > expiresAt) {
      return NextResponse.json(
        { success: false, message: "Mã OTP đã hết hạn. Vui lòng gửi lại mã mới." },
        { status: 400 }
      );
    }

    const otpOK = verifyPassword(otp, staff.resetOtpHash);

    if (!otpOK) {
      return NextResponse.json(
        { success: false, message: "Mã OTP không đúng." },
        { status: 401 }
      );
    }

    await resetStaffPasswordByOtp(staff.rowNumber, {
      passwordHash: hashPassword(newPassword),
    });

    return NextResponse.json({
      success: true,
      message: "Đã đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Không đặt lại được mật khẩu.",
      },
      { status: 500 }
    );
  }
}
