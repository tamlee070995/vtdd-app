import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { exportSyncTarget } from "@/lib/data-sync-store";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BACKUP_SCHEDULE_HOURS_VN = [6, 9, 12, 15, 18, 21, 23];
const FINAL_BACKUP_HOUR_VN = 23;
const BACKUP_MINUTE_VN = 0;
const BACKUP_DIR = getBackupDir();
const BACKUP_FILE_NAME = "vtdd-backup.json";
const BACKUP_META_FILE_NAME = "vtdd-backup.meta.json";
const BACKUP_HISTORY_FILE_NAME = "vtdd-backup.history.json";
const BACKUP_HISTORY_DAYS = 7;
const BACKUP_SCHEDULE_LABEL = "06:00, 09:00, 12:00, 15:00, 18:00, 21:00 và chốt 23:00 mỗi ngày";

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

  return path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "backups");
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

function vnHour(date: Date) {
  return new Date(date.getTime() + VN_OFFSET_MS).getUTCHours();
}

function isFinalBackupRun(date: Date, trigger: AutoBackupResult["trigger"]) {
  return trigger === "schedule" && vnHour(date) === FINAL_BACKUP_HOUR_VN;
}

function slotBackupFileName(date: Date) {
  const hour = String(vnHour(date)).padStart(2, "0");
  return `vtdd-backup-${toVnDateKey(date)}-${hour}00.json`;
}

function archiveBackupFileName(date: Date, trigger: AutoBackupResult["trigger"]) {
  if (isFinalBackupRun(date, trigger)) return dailyBackupFileName(date);
  if (trigger === "schedule") return slotBackupFileName(date);

  const vn = new Date(date.getTime() + VN_OFFSET_MS);
  const hour = String(vn.getUTCHours()).padStart(2, "0");
  const minute = String(vn.getUTCMinutes()).padStart(2, "0");
  const second = String(vn.getUTCSeconds()).padStart(2, "0");
  return `vtdd-backup-${toVnDateKey(date)}-manual-${hour}${minute}${second}.json`;
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
  const todayTargets = BACKUP_SCHEDULE_HOURS_VN
    .map((hour) =>
      Date.UTC(
        nowVN.getUTCFullYear(),
        nowVN.getUTCMonth(),
        nowVN.getUTCDate(),
        hour,
        BACKUP_MINUTE_VN,
        0,
        0
      ) - VN_OFFSET_MS
    )
    .filter((targetMs) => targetMs > nowMs);

  const targetMs = todayTargets[0] ?? (
    Date.UTC(
      nowVN.getUTCFullYear(),
      nowVN.getUTCMonth(),
      nowVN.getUTCDate() + 1,
      BACKUP_SCHEDULE_HOURS_VN[0],
      BACKUP_MINUTE_VN,
      0,
      0
    ) - VN_OFFSET_MS
  );

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

function isBackupArchiveFileName(name: string) {
  return /^vtdd-backup-\d{4}-\d{2}-\d{2}(?:-\d{4}|-manual-\d{6})?\.json$/i.test(name);
}

function isIntradayBackupFileName(name: string, dateKey?: string) {
  const escapedDateKey = dateKey ? dateKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "\\d{4}-\\d{2}-\\d{2}";
  return new RegExp(`^vtdd-backup-${escapedDateKey}-\\d{4}\\.json$`, "i").test(name);
}

async function deleteIntradayBackupsForDate(date: Date) {
  const dateKey = toVnDateKey(date);
  const files = await readdir(BACKUP_DIR).catch(() => []);

  await Promise.all(
    files
      .filter((name) => isIntradayBackupFileName(name, dateKey))
      .map((name) => unlink(path.join(BACKUP_DIR, name)).catch(() => undefined))
  );
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

  const resultDateKey = toVnDateKey(new Date(result.createdAt));
  const finalRun = result.trigger === "schedule" && result.dailyFileName === dailyBackupFileName(new Date(result.createdAt));

  const merged = [
    result,
    ...history.filter((item) => {
      const itemFile = item.dailyFileName || item.fileName || "";
      if (itemFile === result.dailyFileName || item.fileName === result.dailyFileName) return false;
      if (finalRun && isIntradayBackupFileName(itemFile, resultDateKey)) return false;
      return true;
    }),
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
      .filter((name) => isBackupArchiveFileName(name) && !keepFiles.has(name))
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
    const dailyFileName = archiveBackupFileName(createdAt, trigger);
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
    if (isFinalBackupRun(createdAt, trigger)) {
      await deleteIntradayBackupsForDate(createdAt);
    }
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
    schedule: BACKUP_SCHEDULE_LABEL,
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

  if (cleanName !== BACKUP_FILE_NAME && !isBackupArchiveFileName(cleanName)) {
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
