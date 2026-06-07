import { NextRequest, NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/staff-security";
import { appendAdminAudit, getSystemSettings, updateSystemSettings } from "@/lib/system-store";

export const dynamic = "force-dynamic";

function isAdmin(req: NextRequest) {
  return req.cookies.get("vtdd_admin_token")?.value === "admin-ok";
}

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("forwarded") || "";
  const forwardedFor = forwarded.match(/for="?([^;,"]+)/i)?.[1] || "";

  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("true-client-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    forwardedFor ||
    ""
  );
}

async function verifyOldPin(oldPin: string) {
  const settings = await getSystemSettings();
  const currentHash = String(settings.ADMIN_PIN_HASH || "").trim();

  if (currentHash) {
    return verifyPassword(oldPin, currentHash);
  }

  const envPassword = String(process.env.ADMIN_PASSWORD || "").trim();

  if (!envPassword) {
    throw new Error("Thiếu ADMIN_PASSWORD trong .env.local hoặc ADMIN_PIN_HASH trong System_Settings.");
  }

  return oldPin === envPassword;
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

    const oldPin = String(body.oldPin || "").trim();
    const newPin = String(body.newPin || "").trim();
    const confirmPin = String(body.confirmPin || "").trim();

    if (!oldPin || !newPin || !confirmPin) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập đầy đủ PIN hiện tại, PIN mới và xác nhận PIN mới." },
        { status: 400 }
      );
    }

    if (newPin.length < 6) {
      return NextResponse.json(
        { success: false, message: "PIN mới phải có ít nhất 6 ký tự." },
        { status: 400 }
      );
    }

    if (newPin !== confirmPin) {
      return NextResponse.json(
        { success: false, message: "Xác nhận PIN mới chưa khớp." },
        { status: 400 }
      );
    }

    const oldPinOK = await verifyOldPin(oldPin);

    if (!oldPinOK) {
      return NextResponse.json(
        { success: false, message: "PIN hiện tại không đúng." },
        { status: 401 }
      );
    }

    await updateSystemSettings(
      {
        ADMIN_PIN_HASH: hashPassword(newPin),
      },
      "Admin"
    );

    await appendAdminAudit({
      admin: "Admin",
      action: "CHANGE_ADMIN_PIN",
      target: "ADMIN_PIN_HASH",
      newValue: "UPDATED",
      ip: getClientIp(req),
      note: "Đổi PIN truy cập trang Admin.",
    });

    return NextResponse.json({
      success: true,
      message: "Đã đổi PIN truy cập Admin.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Không đổi được PIN.",
      },
      { status: 500 }
    );
  }
}
