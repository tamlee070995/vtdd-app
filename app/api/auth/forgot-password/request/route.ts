import { NextRequest, NextResponse } from "next/server";
import { sendResetOtpMail } from "@/lib/mail";
import { findStaffByMaNV, updateStaffResetOtp } from "@/lib/staff-store";
import { decryptText, hashPassword, normalizeCode, normalizeText } from "@/lib/staff-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_PER_DAY = 3;
const GENERIC_OTP_SENT_MESSAGE =
  "Nếu mã nhân viên hợp lệ và đã cấu hình Gmail bảo mật, hệ thống sẽ gửi OTP trong ít phút.";

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

function normalizeEmail(value: any) {
  const email = normalizeText(value).toLowerCase().replace(/^mailto:/i, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

function safeDecrypt(value: any) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    return decryptText(raw) || raw;
  } catch {
    return raw;
  }
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
    const gmailInput = normalizeEmail(body.gmail);

    if (!maNV || !gmailInput) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập mã nhân viên và Gmail đã đăng ký." },
        { status: 400 }
      );
    }

    const staff = await findStaffByMaNV(maNV);

    if (!staff) {
      return NextResponse.json({ success: true, message: GENERIC_OTP_SENT_MESSAGE });
    }

    if (staff.status.toLowerCase() === "standby") {
      return NextResponse.json({ success: true, message: GENERIC_OTP_SENT_MESSAGE });
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

    const gmail = normalizeEmail(safeDecrypt(staff.gmail));

    if (!gmail || gmail !== gmailInput) {
      return NextResponse.json({ success: true, message: GENERIC_OTP_SENT_MESSAGE });
    }

    const otp = makeOtp();
    const expiresAt = String(Date.now() + OTP_TTL_MS);

    await updateStaffResetOtp(staff.rowNumber, {
      maNV: staff.maNV,
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
    console.error("STAFF_FORGOT_OTP_ERROR:", err?.message || err);
    return NextResponse.json(
      {
        success: false,
        message: "Không gửi được mã xác thực.",
      },
      { status: 500 }
    );
  }
}
