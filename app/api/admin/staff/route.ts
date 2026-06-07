import { NextRequest, NextResponse } from "next/server";
import {
  adminResetStaffOtpCount,
  adminResetStaffSecurity,
  findStaffByMaNV,
  getAdminStaffPage,
  updateStaffNeedSetup,
  updateStaffStatus,
} from "@/lib/staff-store";
import { decryptText, hashPassword } from "@/lib/staff-security";
import { appendAdminAudit } from "@/lib/system-store";
import { sendStaffActivatedMail } from "@/lib/mail";

export const dynamic = "force-dynamic";

function isAdmin(req: NextRequest) {
  return req.cookies.get("vtdd_admin_token")?.value === "admin-ok";
}

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("forwarded") || "";
  const forwardedFor = forwarded.match(/for="?([^;,\"]+)/i)?.[1] || "";

  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("true-client-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    forwardedFor ||
    ""
  );
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

function getLoginUrl(req: NextRequest) {
  const envUrl = String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").trim();
  const origin = envUrl || new URL(req.url).origin;
  return `${origin.replace(/\/$/, "")}/login`;
}

async function safeAudit(data: Parameters<typeof appendAdminAudit>[0]) {
  try {
    await appendAdminAudit(data);
  } catch (err: any) {
    console.warn("SKIP_ADMIN_AUDIT:", err?.message || err);
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập Admin." },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 50);
    const q = String(url.searchParams.get("q") || "").trim();
    const status = String(url.searchParams.get("status") || "ALL").trim();

    const data = await getAdminStaffPage({ page, pageSize, q, status });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Không tải được danh sách nhân viên.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập Admin." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const action = String(body.action || "").trim().toUpperCase();
    const maNV = String(body.maNV || "").trim().replace(/\.0$/, "");

    if (!maNV) {
      return NextResponse.json(
        { success: false, message: "Thiếu mã nhân viên." },
        { status: 400 }
      );
    }

    const staff = await findStaffByMaNV(maNV);

    if (!staff) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy nhân viên." },
        { status: 404 }
      );
    }

    if (action === "ACTIVE") {
      await updateStaffStatus(staff.rowNumber, "Active");
      await updateStaffNeedSetup(staff.rowNumber, "0");

      let mailNote = "";
      const gmail = safeDecrypt(staff.gmail);

      if (gmail) {
        try {
          await sendStaffActivatedMail({
            to: gmail,
            staffName: staff.staffName || "Nhân viên",
            maNV: staff.maNV,
            loginUrl: getLoginUrl(req),
          });
          mailNote = " Đã gửi Gmail thông báo cho nhân viên.";
        } catch (mailErr: any) {
          mailNote = " Tuy nhiên chưa gửi được Gmail thông báo cho nhân viên.";
          console.warn("SEND_ACTIVE_MAIL_FAILED:", mailErr?.message || mailErr);
        }
      } else {
        mailNote = " Tài khoản chưa có Gmail nên không gửi được mail thông báo.";
      }

      await safeAudit({
        admin: "Admin",
        action: "ACTIVE_STAFF",
        target: maNV,
        oldValue: `STATUS=${staff.status || ""}; NEED_SETUP=${staff.needSetup || ""}`,
        newValue: "STATUS=Active; NEED_SETUP=0",
        ip: getClientIp(req),
        note: `Duyệt tài khoản nhân viên.${mailNote}`,
      });

      return NextResponse.json({
        success: true,
        message: `Đã Active tài khoản ${maNV}.${mailNote}`,
      });
    }

    if (action === "STANDBY") {
      await updateStaffStatus(staff.rowNumber, "Standby");

      await safeAudit({
        admin: "Admin",
        action: "STANDBY_STAFF",
        target: maNV,
        oldValue: staff.status,
        newValue: "Standby",
        ip: getClientIp(req),
        note: "Chuyển tài khoản về trạng thái chờ duyệt.",
      });

      return NextResponse.json({
        success: true,
        message: `Đã chuyển ${maNV} về Standby.`,
      });
    }

    if (action === "RESET_SECURITY") {
      const defaultPassword = process.env.DEFAULT_STAFF_PASSWORD || "123123";

      await adminResetStaffSecurity(staff.rowNumber, {
        passwordHash: hashPassword(defaultPassword),
      });

      await safeAudit({
        admin: "Admin",
        action: "RESET_SECURITY",
        target: maNV,
        oldValue: "F:I, K:O",
        newValue: "Password=123123, Security/Gmail cleared, NEED_SETUP=1, OTP_COUNT=0",
        ip: getClientIp(req),
        note: "Reset mật khẩu, bảo mật và OTP count.",
      });

      return NextResponse.json({
        success: true,
        message: `Đã reset bảo mật cho ${maNV}. Mật khẩu mặc định: ${defaultPassword}.`,
      });
    }

    if (action === "RESET_OTP_COUNT") {
      await adminResetStaffOtpCount(staff.rowNumber);

      await safeAudit({
        admin: "Admin",
        action: "RESET_OTP_COUNT",
        target: maNV,
        oldValue: staff.resetOtpCount || "0",
        newValue: "0",
        ip: getClientIp(req),
        note: "Reset số lượt gửi OTP trong ngày.",
      });

      return NextResponse.json({
        success: true,
        message: `Đã reset OTP count cho ${maNV}.`,
      });
    }

    return NextResponse.json(
      { success: false, message: "Action không hợp lệ." },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Không xử lý được thao tác Admin.",
      },
      { status: 500 }
    );
  }
}
