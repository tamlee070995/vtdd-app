import { getSystemText, settingEnabled, type SystemSettingsRecord } from "@/lib/system-lock";
import type { PincodeFlow, PincodeRequest } from "@/lib/pincode-store";

export type TelegramToolKey = PincodeFlow;

type TelegramConfig = {
  enabled: boolean;
  botToken: string;
  chatId: string;
};

const TELEGRAM_TOOL_META: Record<TelegramToolKey, { prefix: string; label: string }> = {
  ChienGia: {
    prefix: "TELEGRAM_CHIENGIA",
    label: "Tổng giá TCDM thấp hơn đối thủ",
  },
  NgoaiDS: {
    prefix: "TELEGRAM_NGOAIDS",
    label: "Máy ngoài danh sách",
  },
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function escapeHtml(value: unknown) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeBotToken(value: unknown) {
  return clean(value).replace(/^bot/i, "");
}

function getAppUrl() {
  return clean(process.env.NEXT_PUBLIC_APP_URL).replace(/\/+$/, "");
}

export function getTelegramToolMeta(tool: TelegramToolKey) {
  return TELEGRAM_TOOL_META[tool];
}

export function getTelegramConfig(settings: SystemSettingsRecord, tool: TelegramToolKey): TelegramConfig {
  const meta = getTelegramToolMeta(tool);

  return {
    enabled: settingEnabled(settings, `${meta.prefix}_ENABLED`),
    botToken: normalizeBotToken(getSystemText(settings, `${meta.prefix}_BOT_TOKEN`)),
    chatId: getSystemText(settings, `${meta.prefix}_CHAT_ID`),
  };
}

export async function sendTelegramMessage(config: TelegramConfig, text: string) {
  if (!config.enabled) {
    return { skipped: true, message: "Telegram chưa bật." };
  }

  if (!config.botToken || !config.chatId) {
    throw new Error("Thiếu Token/ID Bot hoặc ID nhóm Telegram.");
  }

  const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok) {
    throw new Error(data?.description || `Telegram gửi lỗi: ${res.status}`);
  }

  return { skipped: false, messageId: data.result?.message_id };
}

export async function sendTelegramTest(settings: SystemSettingsRecord, tool: TelegramToolKey) {
  const meta = getTelegramToolMeta(tool);
  const config = getTelegramConfig(settings, tool);
  const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  return sendTelegramMessage(
    { ...config, enabled: true },
    [
      "✅ <b>Test bot Telegram thành công</b>",
      `Công cụ: <b>${escapeHtml(meta.label)}</b>`,
      `Thời gian: <b>${escapeHtml(now)}</b>`,
      "Hệ thống VTDD đã kết nối được tới nhóm Telegram này.",
    ].join("\n")
  );
}

export async function notifyPincodeRequestTelegram(
  settings: SystemSettingsRecord,
  request: PincodeRequest
) {
  const meta = getTelegramToolMeta(request.flow);
  const config = getTelegramConfig(settings, request.flow);

  if (!config.enabled) {
    return { skipped: true, message: "Telegram chưa bật cho tool này." };
  }

  const appUrl = getAppUrl();
  const reviewUrl = appUrl
    ? `${appUrl}/admin/tools/pincode/${encodeURIComponent(request.requestId)}`
    : "";

  const message = [
    "🟡 <b>Hồ sơ PMH mới chờ duyệt</b>",
    `Công cụ: <b>${escapeHtml(meta.label)}</b>`,
    `Mã hồ sơ: <code>${escapeHtml(request.requestId)}</code>`,
    `Thời gian: <b>${escapeHtml(request.createdAt)}</b>`,
    `ST/NV: <b>${escapeHtml(request.maST)}</b> / <b>${escapeHtml(request.maNV)}</b>`,
    `IMEI/SN: <code>${escapeHtml(request.imei)}</code>`,
    `Máy cũ: <b>${escapeHtml(request.modelCu)}</b>`,
    `Máy mới: <b>${escapeHtml(request.modelMoi)}</b>`,
    reviewUrl ? `Kiểm duyệt: ${escapeHtml(reviewUrl)}` : "",
  ].filter(Boolean).join("\n");

  return sendTelegramMessage(config, message);
}
