import { google } from "googleapis";
import { readSheetRange } from "@/lib/sheets";
import { getQuoteLogs } from "@/lib/quote-log-store";
import { insertRows, isSupabaseConfigured, selectAllRows } from "@/lib/supabase-rest";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const SETTINGS_SHEET = "System_Settings";
const AUDIT_SHEET = "Admin_Audit";
const SETTINGS_HEADERS = ["KEY", "VALUE", "TYPE", "UPDATED_AT", "UPDATED_BY"];
const AUDIT_HEADERS = ["TIME", "ADMIN", "ACTION", "TARGET", "OLD_VALUE", "NEW_VALUE", "IP", "NOTE"];

export const DEFAULT_SYSTEM_SETTINGS: Record<string, string> = {
  MARQUEE_MESSAGE: "",
  FIXED_BANNER_MESSAGE: "",
  PUSH_NOTIFY_MESSAGE: "",
  PUSH_NOTIFY_VERSION: "",
  STAFF_POPUP_TRADEIN_ENABLED: "0",
  STAFF_POPUP_TRADEIN_MESSAGE: "",
  STAFF_POPUP_TRADEIN_SECONDS: "10",
  STAFF_POPUP_TRADEIN_VERSION: "",
  STAFF_POPUP_BUYONLY_ENABLED: "0",
  STAFF_POPUP_BUYONLY_MESSAGE: "",
  STAFF_POPUP_BUYONLY_SECONDS: "10",
  STAFF_POPUP_BUYONLY_VERSION: "",
  PRICE_EFFECTIVE_FROM: "",
  PRICE_EFFECTIVE_TO: "",

  SYSTEM_LOCK_ENABLED: "0",
  SYSTEM_LOCK_MESSAGE: "HỆ THỐNG ĐANG CẬP NHẬT KHẨN.",
  SYSTEM_LOCK_SCHEDULE_ENABLED: "0",
  SYSTEM_LOCK_START_AT: "",
  SYSTEM_LOCK_END_AT: "",
  SYSTEM_LOCK_REASON: "Hệ thống tạm khóa theo lịch bảo trì đã cài đặt.",

  STAFF_PAGE_LOCKED: "0",
  CUSTOMER_PAGE_LOCKED: "0",

  STAFF_TRADEIN_LOCKED: "0",
  STAFF_BUYONLY_LOCKED: "0",

  CUSTOMER_TRADEIN_LOCKED: "0",
  CUSTOMER_BUYONLY_LOCKED: "0",

  FIREWALL_BLACKLIST: "",
  FIREWALL_WHITELIST: "",
  FIREWALL_MESSAGE: "IP của bạn không được phép truy cập hệ thống tra giá.",

  DATA_VERSION: "1",
  ADMIN_PIN_HASH: "",

  TOOL_PMH_ENABLED: "1",
  TOOL_PMH_SCHEDULE_ENABLED: "0",
  TOOL_PMH_START_AT: "",
  TOOL_PMH_END_AT: "",
  TOOL_PMH_LOCK_REASON: "Công cụ PMH/Pincode đang tạm đóng.",

  TELEGRAM_CHIENGIA_ENABLED: "0",
  TELEGRAM_CHIENGIA_BOT_TOKEN: "",
  TELEGRAM_CHIENGIA_CHAT_ID: "",
  TELEGRAM_NGOAIDS_ENABLED: "0",
  TELEGRAM_NGOAIDS_BOT_TOKEN: "",
  TELEGRAM_NGOAIDS_CHAT_ID: "",
};

const PUBLIC_SYSTEM_SETTING_KEYS = [
  "MARQUEE_MESSAGE",
  "FIXED_BANNER_MESSAGE",
  "PUSH_NOTIFY_MESSAGE",
  "PUSH_NOTIFY_VERSION",
  "STAFF_POPUP_TRADEIN_ENABLED",
  "STAFF_POPUP_TRADEIN_MESSAGE",
  "STAFF_POPUP_TRADEIN_SECONDS",
  "STAFF_POPUP_TRADEIN_VERSION",
  "STAFF_POPUP_BUYONLY_ENABLED",
  "STAFF_POPUP_BUYONLY_MESSAGE",
  "STAFF_POPUP_BUYONLY_SECONDS",
  "STAFF_POPUP_BUYONLY_VERSION",
  "PRICE_EFFECTIVE_FROM",
  "PRICE_EFFECTIVE_TO",
  "SYSTEM_LOCK_ENABLED",
  "SYSTEM_LOCK_MESSAGE",
  "SYSTEM_LOCK_SCHEDULE_ENABLED",
  "SYSTEM_LOCK_START_AT",
  "SYSTEM_LOCK_END_AT",
  "SYSTEM_LOCK_REASON",
  "STAFF_PAGE_LOCKED",
  "CUSTOMER_PAGE_LOCKED",
  "STAFF_TRADEIN_LOCKED",
  "STAFF_BUYONLY_LOCKED",
  "CUSTOMER_TRADEIN_LOCKED",
  "CUSTOMER_BUYONLY_LOCKED",
  "DATA_VERSION",
  "TOOL_PMH_ENABLED",
  "TOOL_PMH_SCHEDULE_ENABLED",
  "TOOL_PMH_START_AT",
  "TOOL_PMH_END_AT",
  "TOOL_PMH_LOCK_REASON",
];

let settingsWriteQueue: Promise<any> = Promise.resolve();

function enqueueSettingsWrite<T>(job: () => Promise<T>) {
  const nextJob = settingsWriteQueue.then(job, job);

  settingsWriteQueue = nextJob
    .then(() => undefined)
    .catch(() => undefined);

  return nextJob;
}

function getSpreadsheetId() {
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("Thiếu SPREADSHEET_ID trong .env.local");
  }

  return spreadsheetId;
}

function getGoogleAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Thiếu GOOGLE_CLIENT_EMAIL hoặc GOOGLE_PRIVATE_KEY trong .env.local");
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: SCOPES,
  });
}

async function getSheetsClient() {
  return google.sheets({
    version: "v4",
    auth: getGoogleAuth(),
  });
}

function nowVN() {
  return new Date().toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function clean(value: any) {
  return String(value ?? "").trim();
}

function settingType(key: string) {
  return key.includes("LOCK") ||
    key.includes("ENABLED") ||
    key.endsWith("_LOCKED")
    ? "BOOLEAN"
    : "TEXT";
}

function boolValue(value: string) {
  const v = clean(value).toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function getColumnLetter(columnNumber: number) {
  let temp = columnNumber;
  let letter = "";

  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }

  return letter;
}

async function getSheetIdByName(sheetName: string) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName);

  return typeof sheet?.properties?.sheetId === "number"
    ? sheet.properties.sheetId
    : null;
}

export async function ensureSheet(sheetName: string, headers: string[]) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  let sheetId = await getSheetIdByName(sheetName);

  if (sheetId === null) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
                gridProperties: {
                  rowCount: 1000,
                  columnCount: Math.max(12, headers.length),
                },
              },
            },
          },
        ],
      },
    });

    sheetId =
      addRes.data.replies?.[0]?.addSheet?.properties?.sheetId ??
      (await getSheetIdByName(sheetName));
  }

  const endCol = getColumnLetter(headers.length);

  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:${endCol}1`,
    });

    const row = existing.data.values?.[0] || [];
    const hasHeader = row.some((cell) => clean(cell));

    if (!hasHeader) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:${endCol}1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [headers],
        },
      });
    }
  } catch (err: any) {
    console.warn(`SKIP_WRITE_HEADER_${sheetName}:`, err?.message || err);
  }

  return sheetId;
}

export async function getSystemSettings() {
  if (isSupabaseConfigured()) {
    try {
      const rows = await selectAllRows<{
        key: string;
        value: string;
      }>("system_settings", { order: "key.asc" });
      const settings: Record<string, string> = { ...DEFAULT_SYSTEM_SETTINGS };

      rows.forEach((row) => {
        const key = clean(row.key);
        if (key) settings[key] = clean(row.value);
      });

      return settings;
    } catch (err: any) {
      console.warn("SUPABASE_SETTINGS_ERROR:", err?.message || err);
      throw err;
    }
  }

  await ensureSheet(SETTINGS_SHEET, SETTINGS_HEADERS);

  let rows: any[][] = [];

  try {
    rows = await readSheetRange(`${SETTINGS_SHEET}!A2:E`);
  } catch {
    rows = [];
  }

  const settings: Record<string, string> = { ...DEFAULT_SYSTEM_SETTINGS };

  rows.forEach((row) => {
    const key = clean(row[0]);
    const value = clean(row[1]);

    if (key) {
      settings[key] = value;
    }
  });

  return settings;
}

export async function getPublicSystemSettings() {
  const settings = await getSystemSettings();
  const publicSettings: Record<string, string> = {};

  PUBLIC_SYSTEM_SETTING_KEYS.forEach((key) => {
    publicSettings[key] = clean(settings[key] ?? DEFAULT_SYSTEM_SETTINGS[key] ?? "");
  });

  const from = clean(publicSettings.PRICE_EFFECTIVE_FROM);
  const to = clean(publicSettings.PRICE_EFFECTIVE_TO);

  if (!from || !to) {
    const d = new Date();
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);

    const format = (date: Date) =>
      date.toLocaleDateString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

    if (!from) publicSettings.PRICE_EFFECTIVE_FROM = format(first);
    if (!to) publicSettings.PRICE_EFFECTIVE_TO = format(last);
  }

  return publicSettings;
}

export async function updateSystemSettings(
  updates: Record<string, string>,
  updatedBy: string
) {
  if (isSupabaseConfigured()) {
    try {
      const timestamp = nowVN();
      const rows = Object.entries(updates)
        .map(([rawKey, rawValue]) => {
          const key = clean(rawKey);
          if (!key) return null;

          return {
            key,
            value: clean(rawValue),
            type: settingType(key),
            updated_at_text: timestamp,
            updated_by: updatedBy || "Admin",
          };
        })
        .filter(Boolean) as Array<Record<string, string>>;

      await insertRows("system_settings", rows, { onConflict: "key", returning: "minimal" });
      return;
    } catch (err: any) {
      console.warn("SUPABASE_UPDATE_SETTINGS_ERROR:", err?.message || err);
      throw err;
    }
  }

  await ensureSheet(SETTINGS_SHEET, SETTINGS_HEADERS);

  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  return enqueueSettingsWrite(async () => {
    let rows: any[][] = [];

    try {
      rows = await readSheetRange(`${SETTINGS_SHEET}!A2:E`);
    } catch {
      rows = [];
    }

    const existingRowByKey = new Map<string, number>();

    rows.forEach((row, index) => {
      const key = clean(row[0]);

      if (key) {
        existingRowByKey.set(key, index + 2);
      }
    });

    const batchData: any[] = [];
    const appendRows: any[] = [];
    const timestamp = nowVN();

    Object.entries(updates).forEach(([rawKey, rawValue]) => {
      const key = clean(rawKey);

      if (!key) return;

      const value = clean(rawValue);
      const rowNumber = existingRowByKey.get(key);

      const type = settingType(key);

      const values = [[key, value, type, timestamp, updatedBy || "Admin"]];

      if (rowNumber) {
        batchData.push({
          range: `${SETTINGS_SHEET}!A${rowNumber}:E${rowNumber}`,
          values,
        });
      } else {
        appendRows.push(values[0]);
      }
    });

    if (batchData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: batchData,
        },
      });
    }

    if (appendRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SETTINGS_SHEET}!A:E`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: appendRows,
        },
      });
    }
  });
}

export async function appendAdminAudit(data: {
  admin: string;
  action: string;
  target?: string;
  oldValue?: string;
  newValue?: string;
  ip?: string;
  note?: string;
}) {
  if (isSupabaseConfigured()) {
    try {
      await insertRows(
        "admin_audit",
        [
          {
            time_text: nowVN(),
            admin: clean(data.admin || "Admin"),
            action: clean(data.action),
            target: clean(data.target),
            old_value: clean(data.oldValue),
            new_value: clean(data.newValue),
            ip: clean(data.ip),
            note: clean(data.note),
          },
        ],
        { returning: "minimal" }
      );
      return;
    } catch (err: any) {
      console.warn("SUPABASE_AUDIT_ERROR:", err?.message || err);
      throw err;
    }
  }

  await ensureSheet(AUDIT_SHEET, AUDIT_HEADERS);

  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  return enqueueSettingsWrite(async () => {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${AUDIT_SHEET}!A:H`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            nowVN(),
            clean(data.admin || "Admin"),
            clean(data.action),
            clean(data.target),
            clean(data.oldValue),
            clean(data.newValue),
            clean(data.ip),
            clean(data.note),
          ],
        ],
      },
    });
  });
}

export type DashboardLogRow = {
  source: "staff" | "customer";
  time: string;
  action: string;
  maNV: string;
  maST: string;
  staffName: string;
  mode: string;
  spMoi: string;
  spCu: string;
  memory: string;
  loai: string;
  tongTien: number;
  ip: string;
  deviceLabel: string;
  networkType: string;
};

export async function getAdminDashboardStats(source: "staff" | "customer" = "staff") {
  const allRows = await getQuoteLogs(2000);
  const cleanRows = allRows.filter((row) => row.source === source);

  const recentLogs: DashboardLogRow[] = cleanRows.slice(0, 20).map((row) => ({
    source: row.source,
    time: row.time,
    action: row.action,
    maNV: row.maNV,
    maST: row.maST,
    staffName: row.staffName,
    mode: row.mode,
    spMoi: row.spMoi,
    spCu: row.spCu,
    memory: row.memory,
    loai: row.loai,
    tongTien: row.tongTien,
    ip: row.ip,
    deviceLabel: row.deviceLabel,
    networkType: row.networkType,
  }));

  const countMap = new Map<string, number>();
  const staffMap = new Map<string, { maNV: string; staffName: string; count: number; totalValue: number }>();
  const storeMap = new Map<string, { maST: string; count: number; totalValue: number }>();
  const deviceMap = new Map<string, { label: string; count: number; totalValue: number }>();
  const ipMap = new Map<string, { ip: string; count: number; totalValue: number }>();
  const dayMap = new Map<string, number>();
  const actionMap = new Map<string, number>();
  let totalValue = 0;

  cleanRows.forEach((row) => {
    const product = clean(row.spCu);
    if (!product) return;

    countMap.set(product, (countMap.get(product) || 0) + 1);

    const staffKey = row.maNV || "unknown";
    const currentStaff = staffMap.get(staffKey) || {
      maNV: row.maNV || "Không rõ",
      staffName: row.staffName || "",
      count: 0,
      totalValue: 0,
    };
    currentStaff.count += 1;
    currentStaff.totalValue += row.tongTien;
    staffMap.set(staffKey, currentStaff);

    const storeKey = row.maST || "unknown";
    const currentStore = storeMap.get(storeKey) || {
      maST: row.maST || "Không rõ",
      count: 0,
      totalValue: 0,
    };
    currentStore.count += 1;
    currentStore.totalValue += row.tongTien;
    storeMap.set(storeKey, currentStore);

    const deviceKey = clean(row.deviceLabel) || "Không rõ thiết bị";
    const currentDevice = deviceMap.get(deviceKey) || {
      label: deviceKey,
      count: 0,
      totalValue: 0,
    };
    currentDevice.count += 1;
    currentDevice.totalValue += row.tongTien;
    deviceMap.set(deviceKey, currentDevice);

    const ipKey = clean(row.ip) || "Không rõ IP";
    const currentIp = ipMap.get(ipKey) || {
      ip: ipKey,
      count: 0,
      totalValue: 0,
    };
    currentIp.count += 1;
    currentIp.totalValue += row.tongTien;
    ipMap.set(ipKey, currentIp);

    const dayKey = clean(row.time).slice(0, 10) || "Không rõ";
    dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + 1);

    const action = clean(row.action) || "Không rõ";
    actionMap.set(action, (actionMap.get(action) || 0) + 1);
    totalValue += row.tongTien;
  });

  const topOldProducts = Array.from(countMap.entries())
    .map(([product, count]) => ({ product, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topStaff = Array.from(staffMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topStores = Array.from(storeMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topDevices = Array.from(deviceMap.values())
    .sort((a, b) => b.count - a.count || b.totalValue - a.totalValue)
    .slice(0, 10);

  const topIps = Array.from(ipMap.values())
    .sort((a, b) => b.count - a.count || b.totalValue - a.totalValue)
    .slice(0, 10);

  const dailyLogs = Array.from(dayMap.entries())
    .map(([day, count]) => ({ day, count }))
    .slice(0, 14);

  const actionCounts = Array.from(actionMap.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);

  return {
    topOldProducts,
    topStaff,
    topStores,
    topDevices,
    topIps,
    dailyLogs,
    actionCounts,
    recentLogs,
    totalLogs: cleanRows.length,
    totalValue,
  };
}

export function isEnabled(value: string) {
  return boolValue(value);
}
