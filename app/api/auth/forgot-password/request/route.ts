import { NextRequest, NextResponse } from "next/server";
import { sendResetOtpMail } from "@/lib/mail";
import { findStaffByMaNV, updateStaffResetOtp } from "@/lib/staff-store";
import { decryptText, hashPassword, normalizeCode } from "@/lib/staff-security";

export const dynamic = "force-dynamic";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_PER_DAY = 3;

function makeOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getVietnamDayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";

  return `${year}-${month}-${day}`;
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;

  const head = name.slice(0, 2);
  const tail = name.slice(-2);

  return `${head}${"*".repeat(Math.max(3, name.length - 4))}${tail}@${domain}`;
}

function secondsLeft(expiresAt: string) {
  const exp = Number(expiresAt || 0);
  if (!exp) return 0;
  return Math.max(0, Math.ceil((exp - Date.now()) / 1000));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const maNV = normalizeCode(body.maNV);

    if (!maNV) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập mã nhân viên." },
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

    if (staff.status.toLowerCase() === "standby") {
      return NextResponse.json(
        { success: false, message: "Tài khoản chưa được duyệt sử dụng, vui lòng liên hệ Admin." },
        { status: 403 }
      );
    }

    const retryAfterSec = secondsLeft(staff.resetOtpExpires);

    if (retryAfterSec > 0) {
      return NextResponse.json(
        {
          success: false,
          retryAfterSec,
          message: `Mã OTP cũ vẫn còn hiệu lực. Vui lòng chờ ${retryAfterSec} giây để gửi lại mã mới.`,
        },
        { status: 429 }
      );
    }

    const today = getVietnamDayKey();
    const currentCount = staff.resetOtpDay === today ? Number(staff.resetOtpCount || 0) : 0;

    if (currentCount >= MAX_OTP_PER_DAY) {
      return NextResponse.json(
        {
          success: false,
          dailyLimitReached: true,
          message: "Mã nhân viên này đã gửi OTP quá 3 lần trong ngày. Vui lòng thử lại vào ngày mai hoặc liên hệ Admin.",
        },
        { status: 429 }
      );
    }

    const gmail = decryptText(staff.gmail);

    if (!gmail) {
      return NextResponse.json(
        { success: false, message: "Tài khoản chưa có Gmail bảo mật. Vui lòng liên hệ Admin." },
        { status: 400 }
      );
    }

    const otp = makeOtp();
    const expiresAt = String(Date.now() + OTP_TTL_MS);

    await updateStaffResetOtp(staff.rowNumber, {
      otpHash: hashPassword(otp),
      expiresAt,
      day: today,
      count: currentCount + 1,
    });

    await sendResetOtpMail({
      to: gmail,
      staffName: staff.staffName,
      maNV: staff.maNV,
      otp,
    });

    return NextResponse.json({
      success: true,
      retryAfterSec: Math.floor(OTP_TTL_MS / 1000),
      remainingToday: MAX_OTP_PER_DAY - (currentCount + 1),
      message: `Đã gửi mã xác thực đến Gmail ${maskEmail(gmail)}. Còn ${MAX_OTP_PER_DAY - (currentCount + 1)} lượt gửi trong hôm nay.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Không gửi được mã xác thực.",
      },
      { status: 500 }
    );
  }
}