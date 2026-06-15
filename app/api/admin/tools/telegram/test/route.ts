import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { getSystemSettings, updateSystemSettings, appendAdminAudit } from "@/lib/system-store";
import { sendTelegramTest, type TelegramToolKey } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOOL_KEYS: TelegramToolKey[] = ["ChienGia", "NgoaiDS"];

const ALLOWED_SETTING_KEYS = new Set([
  "TELEGRAM_CHIENGIA_ENABLED",
  "TELEGRAM_CHIENGIA_BOT_TOKEN",
  "TELEGRAM_CHIENGIA_CHAT_ID",
  "TELEGRAM_NGOAIDS_ENABLED",
  "TELEGRAM_NGOAIDS_BOT_TOKEN",
  "TELEGRAM_NGOAIDS_CHAT_ID",
]);

function clean(value: unknown) {
  return String(value ?? "").trim();
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
  const { admin, response } = await requireAdminApi(req, { module: "tools" });
  if (response) return response;

  try {
    const body = await req.json().catch(() => null);
    const tool = clean(body?.tool) as TelegramToolKey;

    if (!TOOL_KEYS.includes(tool)) {
      return NextResponse.json({ success: false, message: "Tool Telegram không hợp lệ." }, { status: 400 });
    }

    const settingsInput = body?.settings || {};
    const updates: Record<string, string> = {};

    Object.entries(settingsInput).forEach(([key, value]) => {
      if (!ALLOWED_SETTING_KEYS.has(key)) return;
      updates[key] = clean(value);
    });

    const adminName = admin?.name || admin?.maNV || "Admin";

    if (Object.keys(updates).length > 0) {
      await updateSystemSettings(updates, adminName);
    }

    const settings = {
      ...(await getSystemSettings()),
      ...updates,
    };

    await sendTelegramTest(settings, tool);

    try {
      await appendAdminAudit({
        admin: adminName,
        action: "TEST_TELEGRAM_BOT",
        target: `Telegram_${tool}`,
        newValue: JSON.stringify({ tool }),
        ip: getClientIp(req),
        note: "Test bot Telegram cho công cụ hỗ trợ.",
      });
    } catch (auditErr: any) {
      console.warn("SKIP_TELEGRAM_TEST_AUDIT:", auditErr?.message || auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Đã gửi tin test Telegram thành công.",
      settings: updates,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không test được Telegram bot." },
      { status: 500 }
    );
  }
}
