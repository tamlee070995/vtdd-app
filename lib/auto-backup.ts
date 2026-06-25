import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { exportSyncTarget } from "@/lib/data-sync-store";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BACKUP_HOUR_VN = 23;
const BACKUP_MINUTE_VN = 0;
const BACKUP_DIR = getBackupDir();
const BACKUP_FILE_NAME = "vtdd-backup.json";
const BACKUP_META_FILE_NAME = "vtdd-backup.meta.json";
const BACKUP_HISTORY_FILE_NAME = "vtdd-backup.history.json";
const BACKUP_HISTORY_DAYS = 7;

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
  dailyFileName?: string;
  dailyBackupPath?: string;
  createdAt: string;
  createdAtVN: string;
  bytes: number;
  trigger: "schedule" | "manual";
};

declare global {
  var __vtddAutoBackupRuntime: AutoBackupRuntime | undefined;
}

function getBackupDir() {
  const configuredDir = String(process.env.VTDD_BACKUP_DIR || "").trim();
  if (configuredDir) return configuredDir;

  const isServerless =
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.NOW_REGION) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.LAMBDA_TASK_ROOT);

  if (isServerless) {
    return path.join(tmpdir(), "vtdd-backups");
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), "storage", "backups");
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

function backupHistoryPath() {
  return path.join(BACKUP_DIR, BACKUP_HISTORY_FILE_NAME);
}

function toVnDateKey(date: Date) {
  const vn = new Date(date.getTime() + VN_OFFSET_MS);
  return [
    vn.getUTCFullYear(),
    String(vn.getUTCMonth() + 1).padStart(2, "0"),
    String(vn.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function dailyBackupFileName(date: Date) {
  return `vtdd-backup-${toVnDateKey(date)}.json`;
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

async function updateBackupHistory(result: AutoBackupResult) {
  await mkdir(BACKUP_DIR, { recursive: true });

  let history: AutoBackupResult[] = [];
  try {
    const parsed = JSON.parse(await readFile(backupHistoryPath(), "utf8"));
    history = Array.isArray(parsed) ? parsed : [];
  } catch {
    history = [];
  }

  const merged = [
    result,
    ...history.filter((item) => item.dailyFileName !== result.dailyFileName && item.fileName !== result.dailyFileName),
  ]
    .filter((item) => item && item.createdAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, BACKUP_HISTORY_DAYS);

  await replaceFileAtomic(backupHistoryPath(), JSON.stringify(merged, null, 2));

  const keepFiles = new Set([
    BACKUP_FILE_NAME,
    BACKUP_META_FILE_NAME,
    BACKUP_HISTORY_FILE_NAME,
    ...merged.map((item) => item.dailyFileName || item.fileName).filter(Boolean),
  ]);

  const files = await readdir(BACKUP_DIR).catch(() => []);
  await Promise.all(
    files
      .filter((name) => /^vtdd-backup-\d{4}-\d{2}-\d{2}\.json$/i.test(name) && !keepFiles.has(name))
      .map((name) => unlink(path.join(BACKUP_DIR, name)).catch(() => undefined))
  );

  return merged;
}

export async function createAutoBackup(trigger: "schedule" | "manual" = "manual") {
  const runtime = getRuntime();
  if (runtime.running) return runtime.running;

  runtime.running = (async () => {
    const exported = await exportSyncTarget("backup");
    const body = exported.body;
    const createdAt = new Date();
    const dailyFileName = dailyBackupFileName(createdAt);
    const dailyPath = path.join(BACKUP_DIR, dailyFileName);
    const result: AutoBackupResult = {
      success: true,
      fileName: BACKUP_FILE_NAME,
      backupPath: backupPath(),
      dailyFileName,
      dailyBackupPath: dailyPath,
      createdAt: createdAt.toISOString(),
      createdAtVN: formatVN(createdAt),
      bytes: Buffer.byteLength(body, "utf8"),
      trigger,
    };

    await replaceFileAtomic(backupPath(), body);
    await replaceFileAtomic(dailyPath, body);
    await replaceFileAtomic(backupMetaPath(), JSON.stringify(result, null, 2));
    await updateBackupHistory(result);

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
  let history: AutoBackupResult[] = [];

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

  try {
    const parsed = JSON.parse(await readFile(backupHistoryPath(), "utf8"));
    history = Array.isArray(parsed) ? parsed.slice(0, BACKUP_HISTORY_DAYS) : [];
  } catch {
    history = [];
  }

  return {
    enabled: true,
    schedule: "23:00 mỗi ngày",
    fileName: BACKUP_FILE_NAME,
    backupPath: filePath,
    dailyFileName: meta.dailyFileName || "",
    dailyBackupPath: meta.dailyBackupPath || "",
    exists: Boolean(fileStat),
    bytes: fileStat?.size || Number(meta.bytes || 0),
    updatedAt: meta.createdAt || (fileStat ? fileStat.mtime.toISOString() : ""),
    updatedAtVN: meta.createdAtVN || (fileStat ? formatVN(fileStat.mtime) : ""),
    nextRunAt: nextRunAt.toISOString(),
    nextRunAtVN: formatVN(nextRunAt),
    lastError: runtime.lastError || "",
    history,
  };
}

function normalizeBackupFileName(fileName?: string | null) {
  const requested = String(fileName || BACKUP_FILE_NAME).trim() || BACKUP_FILE_NAME;
  const cleanName = path.basename(requested);

  if (cleanName !== requested) {
    throw new Error("Tên file backup không hợp lệ.");
  }

  if (cleanName !== BACKUP_FILE_NAME && !/^vtdd-backup-\d{4}-\d{2}-\d{2}\.json$/i.test(cleanName)) {
    throw new Error("Tên file backup không hợp lệ.");
  }

  return cleanName;
}

export async function getAutoBackupDownload(fileName?: string | null) {
  const safeName = normalizeBackupFileName(fileName);
  const backupDir = path.resolve(BACKUP_DIR);
  const filePath = path.resolve(backupDir, safeName);
  const relativePath = path.relative(backupDir, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Tên file backup không hợp lệ.");
  }

  try {
    const [body, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);

    return {
      fileName: safeName,
      backupPath: filePath,
      body,
      bytes: fileStat.size,
      updatedAt: fileStat.mtime.toISOString(),
      updatedAtVN: formatVN(fileStat.mtime),
    };
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      throw new Error("Chưa có file backup này để tải xuống.");
    }

    throw err;
  }
}
