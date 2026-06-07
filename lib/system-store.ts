import { google } from "googleapis";
import { readSheetRange } from "@/lib/sheets";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const SETTINGS_SHEET = "System_Settings";
const AUDIT_SHEET = "Admin_Audit";
const LOG_SHEET = "Log_search";

const SETTINGS_HEADERS = ["KEY", "VALUE", "TYPE", "UPDATED_AT", "UPDATED_BY"];
const AUDIT_HEADERS = ["TIME", "ADMIN", "ACTION", "TARGET", "OLD_VALUE", "NEW_VALUE", "IP", "NOTE"];

export const DEFAULT_SYSTEM_SETTINGS: Record<string, string> = {
  MARQUEE_MESSAGE: "",
  FIXED_BANNER_MESSAGE: "",
  PUSH_NOTIFY_MESSAGE: "",
  PUSH_NOTIFY_VERSION: "",
  PRICE_EFFECTIVE_FROM: "",
  PRICE_EFFECTIVE_TO: "",

  SYSTEM_LOCK_ENABLED: "0",
  SYSTEM_LOCK_MESSAGE: "HỆ THỐNG ĐANG CẬP NHẬT KHẨN.",

  STAFF_PAGE_LOCKED: "0",
  CUSTOMER_PAGE_LOCKED: "0",

  STAFF_TRADEIN_LOCKED: "0",
  STAFF_BUYONLY_LOCKED: "0",

  CUSTOMER_TRADEIN_LOCKED: "0",
  CUSTOMER_BUYONLY_LOCKED: "0",

  DATA_VERSION: "1",
  ADMIN_PIN_HASH: "",
};

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
  const { ADMIN_PIN_HASH, ...publicSettings } = settings;

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

      const type =
        key.includes("LOCK") ||
        key.includes("ENABLED") ||
        key.endsWith("_LOCKED")
          ? "BOOLEAN"
          : "TEXT";

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
};

export async function getAdminDashboardStats() {
  let rows: any[][] = [];

  try {
    rows = await readSheetRange(`${LOG_SHEET}!A2:Q1001`);
  } catch {
    rows = [];
  }

  const cleanRows = rows.filter((row) => clean(row[0]) || clean(row[7]));

  const recentLogs: DashboardLogRow[] = cleanRows.slice(0, 20).map((row) => ({
    time: clean(row[0]),
    action: clean(row[1]),
    maNV: clean(row[2]),
    maST: clean(row[3]),
    staffName: clean(row[4]),
    mode: clean(row[5]),
    spMoi: clean(row[6]),
    spCu: clean(row[7]),
    memory: clean(row[8]),
    loai: clean(row[9]),
    tongTien: Number(row[13] || 0),
    ip: clean(row[15]),
  }));

  const countMap = new Map<string, number>();

  cleanRows.forEach((row) => {
    const product = clean(row[7]);
    if (!product) return;

    countMap.set(product, (countMap.get(product) || 0) + 1);
  });

  const topOldProducts = Array.from(countMap.entries())
    .map(([product, count]) => ({ product, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    topOldProducts,
    recentLogs,
    totalLogs: cleanRows.length,
  };
}

export function isEnabled(value: string) {
  return boolValue(value);
}