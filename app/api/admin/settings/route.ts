import { NextRequest, NextResponse } from "next/server";
import {
  appendAdminAudit,
  DEFAULT_SYSTEM_SETTINGS,
  updateSystemSettings,
} from "@/lib/system-store";

export const dynamic = "force-dynamic";

const ALLOWED_SETTING_KEYS = new Set(
  Object.keys(DEFAULT_SYSTEM_SETTINGS).filter((key) => key !== "ADMIN_PIN_HASH")
);

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
    req.headers.get("x-client-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    forwardedFor ||
    ""
  );
}

function clean(value: any) {
  return String(value ?? "").trim();
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json(
        {
          success: false,
          message: "Chưa đăng nhập Admin hoặc phiên đăng nhập đã hết hạn.",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const input = body?.settings || {};
    const updates: Record<string, string> = {};

    Object.entries(input).forEach(([key, value]) => {
      if (ALLOWED_SETTING_KEYS.has(key)) {
        updates[key] = clean(value);
      }
    });

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Không có cấu hình hợp lệ để lưu.",
        },
        { status: 400 }
      );
    }

    await updateSystemSettings(updates, "Admin");

    try {
      await appendAdminAudit({
        admin: "Admin",
        action: "UPDATE_SETTINGS",
        target: "System_Settings",
        newValue: JSON.stringify(updates),
        ip: getClientIp(req),
        note: "Cập nhật cấu hình hệ thống.",
      });
    } catch (auditErr: any) {
      console.warn("SKIP_ADMIN_AUDIT:", auditErr?.message || auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Đã lưu cấu hình hệ thống.",
    });
  } catch (err: any) {
    console.error("ADMIN_SETTINGS_SAVE_ERROR:", err);

    return NextResponse.json(
      {
        success: false,
        message:
          err?.message ||
          "Không lưu được cấu hình. Kiểm tra quyền Service Account với Google Sheet.",
      },
      { status: 500 }
    );
  }
}