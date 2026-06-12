import { NextRequest, NextResponse } from "next/server";
import {
  appendAdminAudit,
  DEFAULT_SYSTEM_SETTINGS,
  updateSystemSettings,
} from "@/lib/system-store";
import { adminHasAction, requireAdminApi } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const ALLOWED_SETTING_KEYS = new Set(
  Object.keys(DEFAULT_SYSTEM_SETTINGS).filter((key) => key !== "ADMIN_PIN_HASH")
);

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
    const { admin, response } = await requireAdminApi(req, { module: "tcdm" });
    if (response) return response;

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

    const updateKeys = Object.keys(updates);
    const isReloadOnly = updateKeys.length === 1 && updateKeys[0] === "DATA_VERSION";
    const canSaveSettings = adminHasAction(admin, "settings-write", "tcdm");
    const canReloadData = isReloadOnly && adminHasAction(admin, "reload-data", "tcdm");

    if (!canSaveSettings && !canReloadData) {
      return NextResponse.json(
        {
          success: false,
          message: isReloadOnly
            ? "Không có quyền reload dữ liệu bảng giá."
            : "Không có quyền lưu cấu hình hệ thống.",
        },
        { status: 403 }
      );
    }

    if (!isReloadOnly) {
      updates.DATA_VERSION = String(Date.now());
    }

    await updateSystemSettings(updates, admin?.name || admin?.maNV || "Admin");

    try {
      await appendAdminAudit({
        admin: admin?.name || admin?.maNV || "Admin",
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
      settings: updates,
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
