import { google } from "googleapis";
import { readSheetRange } from "@/lib/sheets";

const SHEET_NAME = "Data_Staff";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let staffWriteQueue: Promise<any> = Promise.resolve();

function enqueueStaffWrite<T>(job: () => Promise<T>) {
  const nextJob = staffWriteQueue.then(job, job);
  staffWriteQueue = nextJob.then(() => undefined).catch(() => undefined);
  return nextJob;
}

function getSpreadsheetId() {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("Thiếu SPREADSHEET_ID trong .env.local");
  return spreadsheetId;
}

function getGoogleAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Thiếu GOOGLE_CLIENT_EMAIL hoặc GOOGLE_PRIVATE_KEY trong .env.local");
  }

  return new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: SCOPES,
  });
}

async function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getGoogleAuth() });
}

function clean(value: any) {
  return String(value ?? "").trim();
}

function cleanCode(value: any) {
  return clean(value).replace(/\.0$/, "");
}

export type StaffPermission = "admin" | "mod" | "";
export type StaffAdminModuleKey = "tcdm" | "quy-trinh-thu-cu" | "may-moi" | "may-cu" | "demo" | "tools";

export type StaffRow = {
  rowNumber: number;
  maNV: string;
  staffName: string;
  maST: string;
  storeName: string;
  department: string;
  password: string;
  securityQuestion: string;
  securityAnswer: string;
  gmail: string;
  status: string;
  resetOtpHash: string;
  resetOtpExpires: string;
  resetOtpDay: string;
  resetOtpCount: string;
  needSetup: string;
  permission: StaffPermission;
  modulePermissions: string;
};

export type AdminStaffPageItem = {
  rowNumber: number;
  maNV: string;
  staffName: string;
  maST: string;
  storeName: string;
  department: string;
  status: string;
  resetOtpCount: string;
  needSetup: string;
  gmail: string;
  permission: StaffPermission;
  modulePermissions: string;
};

function normalizePermission(value: any): StaffPermission {
  const v = clean(value).toLowerCase();
  if (v === "admin") return "admin";
  if (v === "mod" || v === "moderator") return "mod";
  return "";
}

function mapStaffRow(row: any[], index: number): StaffRow {
  return {
    rowNumber: index + 2,
    maNV: cleanCode(row[0]),
    staffName: clean(row[1]),
    maST: cleanCode(row[2]),
    storeName: clean(row[3]),
    department: clean(row[4]),
    password: clean(row[5]),
    securityQuestion: clean(row[6]),
    securityAnswer: clean(row[7]),
    gmail: clean(row[8]),
    status: clean(row[9]),
    resetOtpHash: clean(row[10]),
    resetOtpExpires: clean(row[11]),
    resetOtpDay: clean(row[12]),
    resetOtpCount: clean(row[13]),
    needSetup: clean(row[14]),
    permission: normalizePermission(row[15]),
    modulePermissions: clean(row[16]),
  };
}

export async function ensureStaffAdminHeaders() {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  return enqueueStaffWrite(async () => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!P1:Q1`,
    });

    const currentP = clean(res.data.values?.[0]?.[0]);
    const currentQ = clean(res.data.values?.[0]?.[1]);
    if (currentP.toUpperCase() === "PERMISSION" && currentQ.toUpperCase() === "ADMIN_MODULES") return;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!P1:Q1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["PERMISSION", "ADMIN_MODULES"]] },
    });
  });
}

export async function ensureStaffPermissionHeader() {
  return ensureStaffAdminHeaders();
}

export async function getStaffRows(): Promise<StaffRow[]> {
  const rows = await readSheetRange(`${SHEET_NAME}!A2:Q`);
  return rows.map((row: any[], index: number) => mapStaffRow(row, index));
}

export async function findStaffByMaNV(maNV: string) {
  const target = cleanCode(maNV);
  if (!target) return null;

  const rows = await getStaffRows();
  return rows.find((r) => r.maNV === target) || null;
}

export async function getAdminStaffPage(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: "ALL" | "Active" | "Standby" | string;
}) {
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(params.pageSize || 50)));
  const q = clean(params.q).toLowerCase();
  const status = clean(params.status || "ALL");

  const rows = await readSheetRange(`${SHEET_NAME}!A2:Q`);

  let total = 0;
  let active = 0;
  let standby = 0;
  let needSetup = 0;

  const filtered: AdminStaffPageItem[] = [];

  rows.forEach((row: any[], index: number) => {
    const item = mapStaffRow(row, index);
    if (!item.maNV && !item.staffName) return;

    total += 1;

    const normalizedStatus = item.status || "Standby";
    if (normalizedStatus.toLowerCase() === "active") active += 1;
    if (normalizedStatus.toLowerCase() === "standby") standby += 1;
    if (item.needSetup === "1") needSetup += 1;

    if (status !== "ALL" && normalizedStatus !== status) return;

    if (q) {
      const haystack = [
        item.maNV,
        item.staffName,
        item.maST,
        item.storeName,
        item.department,
        normalizedStatus,
        item.permission,
        item.modulePermissions,
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(q)) return;
    }

    filtered.push({
      rowNumber: item.rowNumber,
      maNV: item.maNV,
      staffName: item.staffName,
      maST: item.maST,
      storeName: item.storeName,
      department: item.department,
      status: normalizedStatus,
      resetOtpCount: item.resetOtpCount || "0",
      needSetup: item.needSetup || "0",
      gmail: item.gmail ? "Đã cấu hình" : "",
      permission: item.permission,
      modulePermissions: item.modulePermissions || "",
    });
  });

  filtered.sort((a, b) => {
    if (a.status === "Standby" && b.status !== "Standby") return -1;
    if (a.status !== "Standby" && b.status === "Standby") return 1;
    return a.maNV.localeCompare(b.maNV, "vi");
  });

  const totalFiltered = filtered.length;
  const pages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * pageSize;
  const staff = filtered.slice(start, start + pageSize);

  return {
    staff,
    meta: {
      page: safePage,
      pageSize,
      total: totalFiltered,
      pages,
      summary: { total, active, standby, needSetup },
    },
  };
}

export async function updateStaffSecurity(
  rowNumber: number,
  data: {
    passwordHash: string;
    encryptedQuestion: string;
    answerHash: string;
    encryptedGmail: string;
    needSetup?: "0" | "1";
  }
) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  return enqueueStaffWrite(async () => {
    const batchData: Array<{ range: string; values: any[][] }> = [
      {
        range: `${SHEET_NAME}!F${rowNumber}:I${rowNumber}`,
        values: [[
          data.passwordHash,
          data.encryptedQuestion,
          data.answerHash,
          data.encryptedGmail,
        ]],
      },
    ];

    if (data.needSetup === "0" || data.needSetup === "1") {
      batchData.push({
        range: `${SHEET_NAME}!O${rowNumber}:O${rowNumber}`,
        values: [[data.needSetup]],
      });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: batchData,
      },
    });
  });
}

export async function createStandbyAccount(data: {
  maNV: string;
  staffName: string;
  maST?: string;
  passwordHash: string;
  encryptedQuestion: string;
  answerHash: string;
  encryptedGmail: string;
}) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  return enqueueStaffWrite(async () => {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAME}!A:Q`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          data.maNV,
          data.staffName,
          data.maST || "",
          "",
          "",
          data.passwordHash,
          data.encryptedQuestion,
          data.answerHash,
          data.encryptedGmail,
          "Standby",
          "",
          "",
          "",
          "",
          "1",
          "",
          "",
        ]],
      },
    });
  });
}

export async function updateStaffResetOtp(
  rowNumber: number,
  data: { otpHash: string; expiresAt: string; day: string; count: number }
) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  return enqueueStaffWrite(async () => {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!K${rowNumber}:N${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[data.otpHash, data.expiresAt, data.day, data.count]] },
    });
  });
}

export async function resetStaffPasswordByOtp(rowNumber: number, data: { passwordHash: string }) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  return enqueueStaffWrite(async () => {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: `${SHEET_NAME}!F${rowNumber}:F${rowNumber}`, values: [[data.passwordHash]] },
          { range: `${SHEET_NAME}!K${rowNumber}:L${rowNumber}`, values: [["", ""]] },
        ],
      },
    });
  });
}

export async function updateStaffNeedSetup(rowNumber: number, needSetup: "0" | "1") {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  return enqueueStaffWrite(async () => {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!O${rowNumber}:O${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[needSetup]] },
    });
  });
}

export async function updateStaffStatus(rowNumber: number, status: "Active" | "Standby") {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  return enqueueStaffWrite(async () => {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!J${rowNumber}:J${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[status]] },
    });
  });
}

export async function updateStaffPermission(rowNumber: number, permission: "admin" | "mod" | "") {
  await ensureStaffAdminHeaders();
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  return enqueueStaffWrite(async () => {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!P${rowNumber}:P${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[permission]] },
    });
  });
}


function normalizeModulePermissions(value: any) {
  const allowed = new Set(["tcdm", "quy-trinh-thu-cu", "may-moi", "may-cu", "demo", "tools"]);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item, index, arr) => allowed.has(item) && arr.indexOf(item) === index)
    .join(",");
}

export async function updateStaffAdminAccess(
  rowNumber: number,
  data: { permission: "admin" | "mod" | ""; modules?: string }
) {
  await ensureStaffAdminHeaders();
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const permission = normalizePermission(data.permission);
  const modules = permission === "mod" ? normalizeModulePermissions(data.modules) : "";

  return enqueueStaffWrite(async () => {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!P${rowNumber}:Q${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[permission, modules]] },
    });
  });
}

export async function adminResetStaffSecurity(rowNumber: number, data: { passwordHash: string }) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  return enqueueStaffWrite(async () => {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: `${SHEET_NAME}!F${rowNumber}:I${rowNumber}`, values: [[data.passwordHash, "", "", ""]] },
          { range: `${SHEET_NAME}!K${rowNumber}:O${rowNumber}`, values: [["", "", "", "0", "1"]] },
        ],
      },
    });
  });
}

export async function adminResetStaffOtpCount(rowNumber: number) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  return enqueueStaffWrite(async () => {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!N${rowNumber}:N${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["0"]] },
    });
  });
}
