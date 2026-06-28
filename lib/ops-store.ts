import { NextRequest } from "next/server";
import { getAutoBackupStatus } from "@/lib/auto-backup";
import { getDataQualityReport, getSyncSummary } from "@/lib/data-sync-store";
import { countRows, isSupabaseConfigured, selectAllRows } from "@/lib/supabase-rest";
import { appendAdminAudit, getSystemSettings } from "@/lib/system-store";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

type BehaviorBucket = {
  count: number;
  resetAt: number;
  lockedUntil?: number;
};

type OpsGlobal = {
  buckets: Map<string, BehaviorBucket>;
  lastSlaNotify: Map<string, number>;
};

const globalForOps = globalThis as typeof globalThis & {
  __VTDD_OPS_STORE__?: OpsGlobal;
};

function getStore() {
  if (!globalForOps.__VTDD_OPS_STORE__) {
    globalForOps.__VTDD_OPS_STORE__ = {
      buckets: new Map(),
      lastSlaNotify: new Map(),
    };
  }

  return globalForOps.__VTDD_OPS_STORE__;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function getClientIpFromRequest(req?: NextRequest | Request | null) {
  if (!req) return "";

  const headers = req.headers;
  const forwarded = headers.get("forwarded") || "";
  const forwardedFor = forwarded.match(/for="?([^;,"]+)/i)?.[1] || "";

  return (
    headers.get("cf-connecting-ip") ||
    headers.get("true-client-ip") ||
    headers.get("x-real-ip") ||
    headers.get("x-client-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    forwardedFor ||
    ""
  );
}

export async function appendErrorLog(data: {
  actor?: string;
  page?: string;
  module?: string;
  message?: string;
  stack?: string;
  ip?: string;
  userAgent?: string;
  severity?: "info" | "warn" | "error";
}) {
  const message = clean(data.message || "Unknown error").slice(0, 1000);
  const moduleName = clean(data.module || "system").slice(0, 120);
  const page = clean(data.page || "").slice(0, 180);

  try {
    await appendAdminAudit({
      admin: clean(data.actor || "system"),
      action: "ERROR_LOG",
      target: moduleName,
      oldValue: page,
      newValue: message,
      ip: clean(data.ip),
      note: JSON.stringify({
        severity: data.severity || "error",
        userAgent: clean(data.userAgent).slice(0, 300),
        stack: clean(data.stack).slice(0, 1800),
      }),
    });
  } catch (err: any) {
    console.warn("APPEND_ERROR_LOG_FAILED:", err?.message || err);
  }
}

function parseAuditNote(note: unknown) {
  try {
    const parsed = JSON.parse(clean(note));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseAuditTimeMs(value: unknown) {
  const raw = clean(value);
  if (!raw) return 0;

  const isoMs = Date.parse(raw);
  if (Number.isFinite(isoMs)) return isoMs;

  const vnMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,|\s)+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (vnMatch) {
    const [, day, month, year, hour, minute, second = "0"] = vnMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ).getTime();
  }

  return 0;
}

function mapErrorAudit(row: any) {
  const note = parseAuditNote(row.note);

  return {
    id: clean(row.id || row.source_row || row.time_text || Math.random()),
    time: clean(row.time_text || row.time || row.created_at),
    actor: clean(row.admin),
    page: clean(row.old_value),
    module: clean(row.target),
    message: clean(row.new_value),
    ip: clean(row.ip),
    severity: clean(note.severity || "error"),
    userAgent: clean(note.userAgent),
  };
}

export async function getErrorLogs(options: {
  module?: string;
  from?: string;
  to?: string;
  limit?: number;
} = {}) {
  if (!isSupabaseConfigured()) return [];

  const limit = Math.max(1, Math.min(500, Number(options.limit || 120)));
  const moduleFilter = clean(options.module).toLowerCase();
  const fromMs = options.from ? new Date(options.from).getTime() : 0;
  const toMs = options.to ? new Date(options.to).getTime() + 24 * 60 * 60 * 1000 : 0;

  const rows = await selectAllRows<any>("admin_audit", { order: "id.desc" });

  return rows
    .filter((row) => clean(row.action) === "ERROR_LOG")
    .map(mapErrorAudit)
    .filter((item) => {
      if (moduleFilter && !item.module.toLowerCase().includes(moduleFilter)) return false;
      const t = parseAuditTimeMs(item.time);
      if (fromMs && t && t < fromMs) return false;
      if (toMs && t && t > toMs) return false;
      return true;
    })
    .slice(0, limit);
}

export async function getSystemHealth() {
  const startedAt = Date.now();
  const health = {
    generatedAt: new Date().toISOString(),
    supabase: { ok: false, message: "", latencyMs: 0 },
    mail: { ok: false, message: "" },
    telegram: { ok: false, message: "" },
    backup: await getAutoBackupStatus().catch((err: any) => ({
      enabled: true,
      exists: false,
      lastError: err?.message || "Backup status error",
      history: [],
    })),
    sync: null as any,
    quality: null as any,
    recentErrors: [] as any[],
  };

  try {
    await countRows("system_settings");
    health.supabase = {
      ok: true,
      message: "Supabase connected",
      latencyMs: Date.now() - startedAt,
    };
  } catch (err: any) {
    health.supabase = {
      ok: false,
      message: err?.message || "Supabase error",
      latencyMs: Date.now() - startedAt,
    };
  }

  health.mail = {
    ok: Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS),
    message: process.env.MAIL_HOST ? `${process.env.MAIL_HOST}:${process.env.MAIL_PORT || "465"}` : "Mail not configured",
  };

  try {
    const settings = await getSystemSettings();
    const telegramEnabled = ["TELEGRAM_CHIENGIA", "TELEGRAM_NGOAIDS"].some(
      (prefix) => clean(settings[`${prefix}_ENABLED`]) === "1" && clean(settings[`${prefix}_BOT_TOKEN`]) && clean(settings[`${prefix}_CHAT_ID`])
    );
    health.telegram = {
      ok: telegramEnabled,
      message: telegramEnabled ? "Telegram bot configured" : "Telegram bot not fully configured",
    };
  } catch (err: any) {
    health.telegram = { ok: false, message: err?.message || "Telegram settings error" };
  }

  try {
    health.sync = await getSyncSummary();
  } catch (err: any) {
    health.sync = { error: err?.message || "Sync summary error" };
  }

  try {
    health.quality = await getDataQualityReport();
  } catch (err: any) {
    health.quality = { error: err?.message || "Quality report error" };
  }

  try {
    health.recentErrors = await getErrorLogs({ limit: 20 });
  } catch {
    health.recentErrors = [];
  }

  return health;
}

export function consumeBehaviorRateLimit(params: {
  scope: string;
  limit: number;
  lockMs: number;
  keys: Array<string | undefined | null>;
}) {
  const store = getStore();
  const now = Date.now();
  const keys = params.keys.map(clean).filter(Boolean);
  let highestCount = 0;

  for (const keyPart of keys) {
    const key = `${params.scope}:${keyPart.toLowerCase()}`;
    const current = store.buckets.get(key);

    if (current?.lockedUntil && current.lockedUntil > now) {
      return {
        allowed: false,
        key,
        count: current.count || 0,
        limit: params.limit,
        retryAfterMs: current.lockedUntil - now,
        message: "Thao tac qua nhieu lan. Vui long thu lai sau it phut.",
      };
    }
  }

  for (const keyPart of keys) {
    const key = `${params.scope}:${keyPart.toLowerCase()}`;
    const current = store.buckets.get(key);
    const bucket =
      current && current.resetAt > now
        ? current
        : {
            count: 0,
            resetAt: now + RATE_LIMIT_WINDOW_MS,
          };

    bucket.count += 1;
    highestCount = Math.max(highestCount, bucket.count);

    if (bucket.count > params.limit) {
      bucket.lockedUntil = now + params.lockMs;
      store.buckets.set(key, bucket);
      return {
        allowed: false,
        key,
        count: bucket.count,
        limit: params.limit,
        retryAfterMs: params.lockMs,
        message: "He thong dang khoa tam do thao tac qua nhieu lan.",
      };
    }

    store.buckets.set(key, bucket);
  }

  return {
    allowed: true,
    count: highestCount,
    limit: params.limit,
    retryAfterMs: 0,
    message: "",
  };
}

export function shouldSendSlaNotice(requestId: string, minGapMs = 5 * 60 * 1000) {
  const store = getStore();
  const id = clean(requestId);
  if (!id) return false;

  const now = Date.now();
  const last = store.lastSlaNotify.get(id) || 0;
  if (now - last < minGapMs) return false;

  store.lastSlaNotify.set(id, now);
  return true;
}
