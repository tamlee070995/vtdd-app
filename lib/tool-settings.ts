import { getSystemText, settingEnabled, type SystemSettingsRecord } from "@/lib/system-lock";

export type ToolAvailability = {
  key: "pmh" | "checkin";
  enabled: boolean;
  manualEnabled: boolean;
  scheduled: boolean;
  reason: string;
  startAt: string;
  endAt: string;
};

const DEFAULT_PMH_REASON = "Công cụ PMH/Pincode đang tạm đóng theo cài đặt Admin.";
const DEFAULT_PMH_WINDOW_REASON = "Công cụ PMH/Pincode chưa đến thời gian chạy.";
const DEFAULT_CHECKIN_REASON = "Công cụ Check-in đang tạm đóng theo cài đặt Admin.";
const DEFAULT_CHECKIN_WINDOW_REASON = "Công cụ Check-in chưa đến thời gian chạy.";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function parseVietnamDateTimeMs(value: unknown) {
  const raw = clean(value).replace(/^'/, "");
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (isoMatch) {
    return Date.UTC(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3]),
      Number(isoMatch[4]) - 7,
      Number(isoMatch[5])
    );
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})/);
  if (slashMatch) {
    const a = Number(slashMatch[1]);
    const b = Number(slashMatch[2]);
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;

    return Date.UTC(
      Number(slashMatch[3]),
      month - 1,
      day,
      Number(slashMatch[4]) - 7,
      Number(slashMatch[5])
    );
  }

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function getScheduledToolAvailability(
  settings: SystemSettingsRecord,
  options: {
    key: ToolAvailability["key"];
    enabledKey: string;
    scheduleKey: string;
    startKey: string;
    endKey: string;
    reasonKey: string;
    defaultReason: string;
    defaultWindowReason: string;
  },
  now: Date = new Date()
): ToolAvailability {
  const legacyManualEnabled = settingEnabled(settings, options.enabledKey);
  const scheduleEnabled = settingEnabled(settings, options.scheduleKey);
  const startAt = getSystemText(settings, options.startKey);
  const endAt = getSystemText(settings, options.endKey);
  const reason = getSystemText(settings, options.reasonKey) || options.defaultReason;
  const hasWindowInput = Boolean(clean(startAt) || clean(endAt));
  const scheduleApplies = scheduleEnabled || hasWindowInput;

  let activeInWindow = true;
  let hasValidWindow = false;

  if (scheduleApplies && hasWindowInput) {
    const start = parseVietnamDateTimeMs(startAt);
    const end = parseVietnamDateTimeMs(endAt);
    const startOk = !startAt || Boolean(start);
    const endOk = !endAt || Boolean(end);

    if (startOk && endOk) {
      const currentTime = now.getTime();
      const afterStart = !start || currentTime >= start;
      const beforeEnd = !end || currentTime <= end;
      hasValidWindow = true;
      activeInWindow = afterStart && beforeEnd;
    }
  }

  const enabled = scheduleApplies ? activeInWindow : legacyManualEnabled;
  const scheduled = scheduleApplies && hasValidWindow && !activeInWindow;

  return {
    key: options.key,
    enabled,
    manualEnabled: true,
    scheduled,
    reason: enabled ? "" : reason || options.defaultWindowReason,
    startAt,
    endAt,
  };
}

export function getPmhToolAvailability(
  settings: SystemSettingsRecord,
  now: Date = new Date()
): ToolAvailability {
  return getScheduledToolAvailability(
    settings,
    {
      key: "pmh",
      enabledKey: "TOOL_PMH_ENABLED",
      scheduleKey: "TOOL_PMH_SCHEDULE_ENABLED",
      startKey: "TOOL_PMH_START_AT",
      endKey: "TOOL_PMH_END_AT",
      reasonKey: "TOOL_PMH_LOCK_REASON",
      defaultReason: DEFAULT_PMH_REASON,
      defaultWindowReason: DEFAULT_PMH_WINDOW_REASON,
    },
    now
  );
}

export function getCheckinToolAvailability(
  settings: SystemSettingsRecord,
  now: Date = new Date()
): ToolAvailability {
  return getScheduledToolAvailability(
    settings,
    {
      key: "checkin",
      enabledKey: "TOOL_CHECKIN_ENABLED",
      scheduleKey: "TOOL_CHECKIN_SCHEDULE_ENABLED",
      startKey: "TOOL_CHECKIN_START_AT",
      endKey: "TOOL_CHECKIN_END_AT",
      reasonKey: "TOOL_CHECKIN_LOCK_REASON",
      defaultReason: DEFAULT_CHECKIN_REASON,
      defaultWindowReason: DEFAULT_CHECKIN_WINDOW_REASON,
    },
    now
  );
}
