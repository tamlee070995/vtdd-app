import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { exportSyncTarget } from "@/lib/data-sync-store";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BACKUP_HOUR_VN = 23;
const BACKUP_MINUTE_VN = 0;
const BACKUP_DIR = process.env.VTDD_BACKUP_DIR || path.join(process.cwd(), "storage", "backups");
const BACKUP_FILE_NAME = "vtdd-backup.json";
const BACKUP_META_FILE_NAME = "vtdd-backup.meta.json";

type AutoBackupRuntime = {
  started: boolean;
  timer?: ReturnType<typeof setTimeout>;
  nextRunAt?: string;
  lastError?: string;
  running?: Promise<AutoBackupResult> | null;
};

type AutoBackupResult = {
  success: boolean;
  fileName: string;
  backupPath: string;
  createdAt: string;
  createdAtVN: string;
  bytes: number;
  trigger: "schedule" | "manual";
};

declare global {
  var __vtddAutoBackupRuntime: AutoBackupRuntime | undefined;
}

function getRuntime() {
  if (!globalThis.__vtddAutoBackupRuntime) {
    globalThis.__vtddAutoBackupRuntime = {
      started: false,
      running: null,
    };
  }

  return globalThis.__vtddAutoBackupRuntime;
}

function backupPath() {
  return path.join(BACKUP_DIR, BACKUP_FILE_NAME);
}

function backupMetaPath() {
  return path.join(BACKUP_DIR, BACKUP_META_FILE_NAME);
}

function formatVN(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function msUntilNextBackup(now = new Date()) {
  const nowMs = now.getTime();
  const nowVN = new Date(nowMs + VN_OFFSET_MS);
  let targetMs = Date.UTC(
    nowVN.getUTCFullYear(),
    nowVN.getUTCMonth(),
    nowVN.getUTCDate(),
    BACKUP_HOUR_VN,
    BACKUP_MINUTE_VN,
    0,
    0
  ) - VN_OFFSET_MS;

  if (targetMs <= nowMs) targetMs += DAY_MS;
  return targetMs - nowMs;
}

async function replaceFileAtomic(targetPath: string, body: string) {
  await mkdir(path.dirname(targetPath), { recursive: true });

  const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, body, "utf8");

  try {
    await rename(tmpPath, targetPath);
  } catch (err: any) {
    if (err?.code !== "EEXIST" && err?.code !== "EPERM") throw err;

    await unlink(targetPath).catch(() => undefined);
    await rename(tmpPath, targetPath);
  }
}

export async function createAutoBackup(trigger: "schedule" | "manual" = "manual") {
  const runtime = getRuntime();
  if (runtime.running) return runtime.running;

  runtime.running = (async () => {
    const exported = await exportSyncTarget("backup");
    const body = exported.body;
    const createdAt = new Date();
    const result: AutoBackupResult = {
      success: true,
      fileName: BACKUP_FILE_NAME,
      backupPath: backupPath(),
      createdAt: createdAt.toISOString(),
      createdAtVN: formatVN(createdAt),
      bytes: Buffer.byteLength(body, "utf8"),
      trigger,
    };

    await replaceFileAtomic(backupPath(), body);
    await replaceFileAtomic(backupMetaPath(), JSON.stringify(result, null, 2));

    runtime.lastError = "";
    return result;
  })().finally(() => {
    runtime.running = null;
  });

  return runtime.running;
}

function scheduleNextBackup() {
  const runtime = getRuntime();
  const delay = msUntilNextBackup();
  const nextRunAt = new Date(Date.now() + delay);

  runtime.nextRunAt = nextRunAt.toISOString();
  runtime.timer = setTimeout(async () => {
    try {
      await createAutoBackup("schedule");
    } catch (err: any) {
      runtime.lastError = err?.message || "Không tạo được file backup tự động.";
      console.error("AUTO_BACKUP_ERROR:", err?.message || err);
    } finally {
      scheduleNextBackup();
    }
  }, delay);

  runtime.timer.unref?.();
}

export function ensureAutoBackupScheduler() {
  const runtime = getRuntime();
  if (runtime.started) return;

  runtime.started = true;
  scheduleNextBackup();
}

export async function getAutoBackupStatus() {
  ensureAutoBackupScheduler();

  const runtime = getRuntime();
  const filePath = backupPath();
  const metaPath = backupMetaPath();
  const nextRunAt = runtime.nextRunAt ? new Date(runtime.nextRunAt) : new Date(Date.now() + msUntilNextBackup());

  let fileStat: Awaited<ReturnType<typeof stat>> | null = null;
  let meta: Partial<AutoBackupResult> = {};

  try {
    fileStat = await stat(filePath);
  } catch {
    fileStat = null;
  }

  try {
    meta = JSON.parse(await readFile(metaPath, "utf8"));
  } catch {
    meta = {};
  }

  return {
    enabled: true,
    schedule: "23:00 mỗi ngày",
    fileName: BACKUP_FILE_NAME,
    backupPath: filePath,
    exists: Boolean(fileStat),
    bytes: fileStat?.size || Number(meta.bytes || 0),
    updatedAt: meta.createdAt || (fileStat ? fileStat.mtime.toISOString() : ""),
    updatedAtVN: meta.createdAtVN || (fileStat ? formatVN(fileStat.mtime) : ""),
    nextRunAt: nextRunAt.toISOString(),
    nextRunAtVN: formatVN(nextRunAt),
    lastError: runtime.lastError || "",
  };
}
