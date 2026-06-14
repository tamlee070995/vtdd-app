import { getSystemText, settingEnabled, type SystemSettingsRecord } from "@/lib/system-lock";

export type ToolAvailability = {
  key: "pmh";
  enabled: boolean;
  manualEnabled: boolean;
  scheduled: boolean;
  reason: string;
  startAt: string;
  endAt: string;
};

const DEFAULT_PMH_REASON = "Công cụ PMH/Pincode đang tạm đóng theo cài đặt Admin.";
const DEFAULT_PMH_WINDOW_REASON = "Công cụ PMH/Pincode chưa đến thời gian chạy.";

function clean(value: unknown) {
  return String(value ?? "").trim();
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

export function getPmhToolAvailability(
  settings: SystemSettingsRecord,
  now: Date = new Date()
): ToolAvailability {
  const legacyManualEnabled = settingEnabled(settings, "TOOL_PMH_ENABLED");
  const scheduleEnabled = settingEnabled(settings, "TOOL_PMH_SCHEDULE_ENABLED");
  const startAt = getSystemText(settings, "TOOL_PMH_START_AT");
  const endAt = getSystemText(settings, "TOOL_PMH_END_AT");
  const reason = getSystemText(settings, "TOOL_PMH_LOCK_REASON") || DEFAULT_PMH_REASON;
  const hasWindowInput = Boolean(clean(startAt) || clean(endAt));
  const scheduleApplies = scheduleEnabled || hasWindowInput;

  let activeInWindow = true;
  let hasValidWindow = false;

  if (scheduleApplies && hasWindowInput) {
    const start = parseLocalDateTime(startAt);
    const end = parseLocalDateTime(endAt);
    const startOk = !startAt || Boolean(start);
    const endOk = !endAt || Boolean(end);

    if (startOk && endOk) {
      const afterStart = !start || now.getTime() >= start.getTime();
      const beforeEnd = !end || now.getTime() <= end.getTime();
      hasValidWindow = true;
      activeInWindow = afterStart && beforeEnd;
    }
  }

  const enabled = scheduleApplies ? activeInWindow : legacyManualEnabled;
  const scheduled = scheduleApplies && hasValidWindow && !activeInWindow;

  return {
    key: "pmh",
    enabled,
    manualEnabled: true,
    scheduled,
    reason: enabled ? "" : reason || DEFAULT_PMH_WINDOW_REASON,
    startAt,
    endAt,
  };
}
