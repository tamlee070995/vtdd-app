import { NextRequest, NextResponse } from "next/server";
import { adminCanUsePmhTool, adminHasAction, requireAdminApi } from "@/lib/admin-auth";
import { appendAdminAudit, updateSystemSettings } from "@/lib/system-store";

export const dynamic = "force-dynamic";

const ALLOWED_TOOL_SETTING_KEYS = new Set([
  "TOOL_PMH_ENABLED",
  "TOOL_PMH_SCHEDULE_ENABLED",
  "TOOL_PMH_START_AT",
  "TOOL_PMH_END_AT",
  "TOOL_PMH_LOCK_REASON",
  "TOOL_CHECKIN_ENABLED",
  "TOOL_CHECKIN_SCHEDULE_ENABLED",
  "TOOL_CHECKIN_START_AT",
  "TOOL_CHECKIN_END_AT",
  "TOOL_CHECKIN_LOCK_REASON",
  "TELEGRAM_CHIENGIA_ENABLED",
  "TELEGRAM_CHIENGIA_BOT_TOKEN",
  "TELEGRAM_CHIENGIA_CHAT_ID",
  "TELEGRAM_NGOAIDS_ENABLED",
  "TELEGRAM_NGOAIDS_BOT_TOKEN",
  "TELEGRAM_NGOAIDS_CHAT_ID",
]);

const PMH_SETTING_KEYS = new Set([
  "TOOL_PMH_ENABLED",
  "TOOL_PMH_SCHEDULE_ENABLED",
  "TOOL_PMH_START_AT",
  "TOOL_PMH_END_AT",
  "TOOL_PMH_LOCK_REASON",
]);

const TELEGRAM_SETTING_KEYS = new Set([
  "TELEGRAM_CHIENGIA_ENABLED",
  "TELEGRAM_CHIENGIA_BOT_TOKEN",
  "TELEGRAM_CHIENGIA_CHAT_ID",
  "TELEGRAM_NGOAIDS_ENABLED",
  "TELEGRAM_NGOAIDS_BOT_TOKEN",
  "TELEGRAM_NGOAIDS_CHAT_ID",
]);

const CHECKIN_SETTING_KEYS = new Set([
  "TOOL_CHECKIN_ENABLED",
  "TOOL_CHECKIN_SCHEDULE_ENABLED",
  "TOOL_CHECKIN_START_AT",
  "TOOL_CHECKIN_END_AT",
  "TOOL_CHECKIN_LOCK_REASON",
]);

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function redactSensitiveSettings(settings: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [
      key,
      /(TOKEN|SECRET|HASH|PASSWORD|PASS|PIN)/i.test(key) ? "[REDACTED]" : value,
    ])
  );
}

function omitSensitiveSettings(settings: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => !/(TOKEN|SECRET|HASH|PASSWORD|PASS|PIN)/i.test(key))
  );
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
    forwardedFor ||
    ""
  );
}

export async function POST(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req);
  if (response) return response;

  try {
    const body = await req.json().catch(() => null);
    const input = body?.settings || {};
    const updates: Record<string, string> = {};

    Object.entries(input).forEach(([key, value]) => {
      if (!ALLOWED_TOOL_SETTING_KEYS.has(key)) return;
      updates[key] = clean(value);
    });

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, message: "Không có cấu hình tool hợp lệ để lưu." }, { status: 400 });
    }

    const updateKeys = Object.keys(updates);
    const needsPmhPermission = updateKeys.some((key) => PMH_SETTING_KEYS.has(key));
    const needsTelegramPermission = updateKeys.some((key) => TELEGRAM_SETTING_KEYS.has(key));
    const needsCheckinPermission = updateKeys.some((key) => CHECKIN_SETTING_KEYS.has(key));

    if (needsPmhPermission && !adminCanUsePmhTool(admin)) {
      return NextResponse.json({ success: false, message: "Không có quyền cấu hình PMH/Pincode." }, { status: 403 });
    }

    if (needsTelegramPermission && !adminHasAction(admin, "tools-telegram")) {
      return NextResponse.json({ success: false, message: "Không có quyền cấu hình Telegram." }, { status: 403 });
    }

    if (needsCheckinPermission && !adminHasAction(admin, "tools-checkin")) {
      return NextResponse.json({ success: false, message: "Không có quyền cấu hình Check-in." }, { status: 403 });
    }

    ["TOOL_PMH_START_AT", "TOOL_PMH_END_AT", "TOOL_CHECKIN_START_AT", "TOOL_CHECKIN_END_AT"].forEach((key) => {
      const value = clean(updates[key]);
      if (value && !value.startsWith("'")) updates[key] = `'${value}`;
    });

    const adminName = admin?.name || admin?.maNV || "Admin";
    await updateSystemSettings(updates, adminName);

    try {
      await appendAdminAudit({
        admin: adminName,
        action: "UPDATE_TOOL_SETTINGS",
        target: "Module_05_Tools",
        newValue: JSON.stringify(redactSensitiveSettings(updates)),
        ip: getClientIp(req),
        note: "Cập nhật bật/tắt và lịch hoạt động công cụ hỗ trợ.",
      });
    } catch (auditErr: any) {
      console.warn("SKIP_TOOL_ADMIN_AUDIT:", auditErr?.message || auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Đã lưu cấu hình công cụ.",
      settings: omitSensitiveSettings(updates),
    });
  } catch (err: any) {
    console.error("ADMIN_TOOL_SETTINGS_ERROR:", err?.message || err);
    return NextResponse.json(
      { success: false, message: "Không lưu được cấu hình công cụ." },
      { status: 500 }
    );
  }
}
