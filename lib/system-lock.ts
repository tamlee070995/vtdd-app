export type SystemSettingsRecord = Record<string, string>;

export type ActiveSystemLock = {
  active: boolean;
  scheduled: boolean;
  message: string;
  detail: string;
};

const DEFAULT_LOCK_MESSAGE = "HỆ THỐNG ĐANG CẬP NHẬT KHẨN.";
const DEFAULT_SCHEDULE_MESSAGE = "Hệ thống tạm khóa theo lịch bảo trì đã cài đặt.";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function settingEnabled(settings: SystemSettingsRecord, key: string) {
  const value = clean(settings?.[key]).toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function getSystemText(settings: SystemSettingsRecord, key: string) {
  return clean(settings?.[key]);
}

function parseLocalDateTime(value: unknown) {
  const raw = clean(value).replace(/^'/, "");
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (isoMatch) {
    return new Date(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3]),
      Number(isoMatch[4]),
      Number(isoMatch[5])
    );
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})/);
  if (slashMatch) {
    const a = Number(slashMatch[1]);
    const b = Number(slashMatch[2]);
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;

    return new Date(
      Number(slashMatch[3]),
      month - 1,
      day,
      Number(slashMatch[4]),
      Number(slashMatch[5])
    );
  }

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatLockDate(value: string) {
  const parsed = parseLocalDateTime(value);
  if (!parsed) return clean(value).replace("T", " ");

  return parsed.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getActiveSystemLock(
  settings: SystemSettingsRecord,
  now: Date = new Date()
): ActiveSystemLock {
  const manualMessage = getSystemText(settings, "SYSTEM_LOCK_MESSAGE") || DEFAULT_LOCK_MESSAGE;

  if (settingEnabled(settings, "SYSTEM_LOCK_ENABLED")) {
    return {
      active: true,
      scheduled: false,
      message: manualMessage,
      detail: "",
    };
  }

  if (!settingEnabled(settings, "SYSTEM_LOCK_SCHEDULE_ENABLED")) {
    return {
      active: false,
      scheduled: false,
      message: manualMessage,
      detail: "",
    };
  }

  const startRaw = getSystemText(settings, "SYSTEM_LOCK_START_AT");
  const endRaw = getSystemText(settings, "SYSTEM_LOCK_END_AT");

  if (!startRaw && !endRaw) {
    return {
      active: false,
      scheduled: false,
      message: manualMessage,
      detail: "",
    };
  }

  const start = parseLocalDateTime(startRaw);
  const end = parseLocalDateTime(endRaw);
  const startOk = !startRaw || Boolean(start);
  const endOk = !endRaw || Boolean(end);

  if (!startOk || !endOk) {
    return {
      active: false,
      scheduled: false,
      message: manualMessage,
      detail: "",
    };
  }

  const inStart = !start || now.getTime() >= start.getTime();
  const inEnd = !end || now.getTime() <= end.getTime();
  const active = inStart && inEnd;
  const scheduleMessage =
    getSystemText(settings, "SYSTEM_LOCK_REASON") || DEFAULT_SCHEDULE_MESSAGE;
  const detail =
    startRaw && endRaw
      ? `Thời gian khóa: ${formatLockDate(startRaw)} - ${formatLockDate(endRaw)}.`
      : startRaw
        ? `Bắt đầu khóa từ: ${formatLockDate(startRaw)}.`
        : `Khóa đến: ${formatLockDate(endRaw)}.`;

  return {
    active,
    scheduled: active,
    message: active ? scheduleMessage : manualMessage,
    detail: active ? detail : "",
  };
}
