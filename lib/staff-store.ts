import { google } from "googleapis";
import { readSheetRange } from "@/lib/sheets";
import { deleteRows, eq, insertRows, isNull, isSupabaseConfigured, selectAllRows, selectRows, updateRows } from "@/lib/supabase-rest";

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

function normalizeSearchValue(value: any) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStaffCodeSearch(value: any) {
  return clean(value)
    .replace(/\.0$/, "")
    .replace(/^(nv|ma nv|mã nv|ma nhan vien|mã nhân viên)\s*/i, "")
    .replace(/\D/g, "");
}

export type StaffPermission = "admin" | "mod" | "";
export type StaffAdminModuleKey = "tcdm" | "quy-trinh-thu-cu" | "may-moi" | "may-cu" | "demo" | "tools" | "people";
export const STAFF_TOOL_CHECKIN_PERMISSION = "tool:checkin";
const STAFF_TOOL_PERMISSION_KEYS = new Set([STAFF_TOOL_CHECKIN_PERMISSION]);

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

function mapDbStaffRow(row: any, index: number): StaffRow {
  const sourceRow = Number(clean(row.source_row));

  return {
    rowNumber: Number.isFinite(sourceRow) && sourceRow > 0 ? sourceRow : index + 2,
    maNV: cleanCode(row.ma_nv),
    staffName: clean(row.staff_name),
    maST: cleanCode(row.ma_st),
    storeName: clean(row.store_name),
    department: clean(row.department),
    password: clean(row.password_hash),
    securityQuestion: clean(row.security_question),
    securityAnswer: clean(row.security_answer),
    gmail: clean(row.gmail),
    status: clean(row.status),
    resetOtpHash: clean(row.reset_otp_hash),
    resetOtpExpires: clean(row.reset_otp_expires),
    resetOtpDay: clean(row.reset_otp_day),
    resetOtpCount: clean(row.reset_otp_count),
    needSetup: clean(row.need_setup),
    permission: normalizePermission(row.permission),
    modulePermissions: clean(row.module_permissions),
  };
}

async function updateDbStaffByRowNumber(rowNumber: number, patch: Record<string, unknown>, maNV?: string) {
  if (!isSupabaseConfigured()) return false;

  try {
    let rows: any[] = [];

    if (cleanCode(maNV)) {
      rows = await updateRows<any>(
        "staff",
        { ma_nv: eq(cleanCode(maNV)) },
        patch
      );
    }

    if ((!Array.isArray(rows) || rows.length === 0) && Number.isFinite(rowNumber) && rowNumber > 0) {
      rows = await updateRows<any>(
        "staff",
        { source_row: eq(String(rowNumber)) },
        patch
      );
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Không tìm thấy nhân viên trong Database để cập nhật.");
    }

    return true;
  } catch (err: any) {
    console.warn("SUPABASE_STAFF_UPDATE_ERROR:", err?.message || err);
    throw err;
  }
}

export async function ensureStaffAdminHeaders() {
  if (isSupabaseConfigured()) return;

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
  if (isSupabaseConfigured()) {
    try {
      let rows: any[] = [];

      try {
        rows = await selectAllRows<any>("staff", { order: "ma_nv.asc" });
      } catch (orderErr: any) {
        console.warn("SUPABASE_STAFF_ORDER_FALLBACK:", orderErr?.message || orderErr);
        rows = await selectAllRows<any>("staff");
      }

      return rows
        .map(mapDbStaffRow)
        .filter((row) => row.maNV || row.staffName);
    } catch (err: any) {
      console.warn("SUPABASE_STAFF_ROWS_ERROR:", err?.message || err);
      throw err;
    }
  }

  const rows = await readSheetRange(`${SHEET_NAME}!A2:Q`);
  return rows.map((row: any[], index: number) => mapStaffRow(row, index));
}

export async function findStaffByMaNV(maNV: string) {
  const target = cleanCode(maNV);
  if (!target) return null;

  if (isSupabaseConfigured()) {
    try {
      const rows = await selectRows<any>("staff", {
        filters: { ma_nv: eq(target) },
        limit: 1,
      });
      return rows[0] ? mapDbStaffRow(rows[0], 0) : null;
    } catch (err: any) {
      console.warn("SUPABASE_FIND_STAFF_ERROR:", err?.message || err);
      throw err;
    }
  }

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
  const q = normalizeSearchValue(params.q);
  const qCode = normalizeStaffCodeSearch(params.q);
  const status = clean(params.status || "ALL");

  const rows = await getStaffRows();

  let total = 0;
  let active = 0;
  let standby = 0;
  let needSetup = 0;

  const filtered: AdminStaffPageItem[] = [];

  rows.forEach((item) => {
    if (!item.maNV && !item.staffName) return;

    total += 1;

    const normalizedStatus = item.status || "Standby";
    if (normalizedStatus.toLowerCase() === "active") active += 1;
    if (normalizedStatus.toLowerCase() === "standby") standby += 1;
    if (item.needSetup === "1") needSetup += 1;

    if (status !== "ALL" && normalizedStatus !== status) return;

    if (q) {
      if (qCode && normalizeStaffCodeSearch(item.maNV).includes(qCode)) {
        // Mã nhân viên khớp, bỏ qua kiểm tra text bên dưới.
      } else {
        const permissionLabel =
          item.permission === "admin"
            ? "admin quyen admin user admin quan tri quan tri vien full quyen"
            : item.permission === "mod"
              ? "mod quyen mod user mod moderator quan tri vien phan quyen"
              : "user quyen user user thuong nguoi dung nhan vien";

        const haystack = [
          item.maNV,
          `NV ${item.maNV}`,
          item.staffName,
          item.maST,
          `ST ${item.maST}`,
          item.storeName,
          item.department,
          normalizedStatus,
          item.permission,
          item.modulePermissions,
          permissionLabel,
        ]
          .join(" ")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "d")
          .toLowerCase();

        const tokens = q.split(/\s+/).filter(Boolean);
        if (tokens.length > 0 && !tokens.every((token) => haystack.includes(token))) return;
      }
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
    maNV?: string;
    passwordHash: string;
    encryptedQuestion: string;
    answerHash: string;
    encryptedGmail: string;
    needSetup?: "0" | "1";
  }
) {
  if (await updateDbStaffByRowNumber(rowNumber, {
    password_hash: data.passwordHash,
    security_question: data.encryptedQuestion,
    security_answer: data.answerHash,
    gmail: data.encryptedGmail,
    ...(data.needSetup === "0" || data.needSetup === "1" ? { need_setup: data.needSetup } : {}),
  }, data.maNV)) {
    return;
  }

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
  needSetup?: "0" | "1";
}) {
  const needSetup = data.needSetup === "1" ? "1" : "0";

  if (isSupabaseConfigured()) {
    try {
      await insertRows(
        "staff",
        [
          {
            ma_nv: cleanCode(data.maNV),
            staff_name: clean(data.staffName),
            ma_st: cleanCode(data.maST),
            store_name: "",
            department: "",
            password_hash: data.passwordHash,
            security_question: data.encryptedQuestion,
            security_answer: data.answerHash,
            gmail: data.encryptedGmail,
            status: "Standby",
            reset_otp_hash: "",
            reset_otp_expires: "",
            reset_otp_day: "",
            reset_otp_count: "0",
            need_setup: needSetup,
            permission: "",
            module_permissions: "",
            source_row: String(Date.now()),
          },
        ],
        { returning: "minimal" }
      );
      return;
    } catch (err: any) {
      console.warn("SUPABASE_CREATE_STAFF_ERROR:", err?.message || err);
      throw err;
    }
  }

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
          needSetup,
          "",
          "",
        ]],
      },
    });
  });
}

export async function updateStaffResetOtp(
  rowNumber: number,
  data: { maNV?: string; otpHash: string; expiresAt: string; day: string; count: number }
) {
  if (await updateDbStaffByRowNumber(rowNumber, {
    reset_otp_hash: data.otpHash,
    reset_otp_expires: data.expiresAt,
    reset_otp_day: data.day,
    reset_otp_count: String(data.count),
  }, data.maNV)) {
    return;
  }

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

export async function resetStaffPasswordByOtp(rowNumber: number, data: { maNV?: string; passwordHash: string }) {
  if (await updateDbStaffByRowNumber(rowNumber, {
    password_hash: data.passwordHash,
    reset_otp_hash: "",
    reset_otp_expires: "",
  }, data.maNV)) {
    return;
  }

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

export async function updateStaffNeedSetup(rowNumber: number, needSetup: "0" | "1", maNV?: string) {
  if (await updateDbStaffByRowNumber(rowNumber, { need_setup: needSetup }, maNV)) {
    return;
  }

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

export async function updateStaffStatus(rowNumber: number, status: "Active" | "Standby", maNV?: string) {
  if (await updateDbStaffByRowNumber(rowNumber, { status }, maNV)) {
    return;
  }

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

export async function bulkStandbyStaffByPermission(roles: Array<"user" | "mod">) {
  const selectedRoles = Array.from(new Set(roles.filter((role) => role === "user" || role === "mod")));
  if (selectedRoles.length === 0) return { updated: 0 };

  if (isSupabaseConfigured()) {
    let updated = 0;

    if (selectedRoles.includes("mod")) {
      const rows = await updateRows<any>(
        "staff",
        { permission: eq("mod") },
        { status: "Standby" }
      );
      updated += Array.isArray(rows) ? rows.length : 0;
    }

    if (selectedRoles.includes("user")) {
      const blankPermissionRows = await updateRows<any>(
        "staff",
        { permission: eq("") },
        { status: "Standby" }
      );
      updated += Array.isArray(blankPermissionRows) ? blankPermissionRows.length : 0;

      const nullPermissionRows = await updateRows<any>(
        "staff",
        { permission: isNull() },
        { status: "Standby" }
      );
      updated += Array.isArray(nullPermissionRows) ? nullPermissionRows.length : 0;
    }

    return { updated };
  }

  const rows = await getStaffRows();
  const targets = rows.filter((row) => {
    if (row.permission === "admin") return false;
    if (row.permission === "mod") return selectedRoles.includes("mod");
    return selectedRoles.includes("user");
  });

  for (const row of targets) {
    await updateStaffStatus(row.rowNumber, "Standby", row.maNV);
  }

  return { updated: targets.length };
}

export async function standbyStaffByCodes(inputCodes: string[]) {
  const requested = inputCodes
    .map((code) => cleanCode(code))
    .filter(Boolean);
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const uniqueCodes: string[] = [];

  requested.forEach((code) => {
    if (seen.has(code)) {
      duplicates.push(code);
      return;
    }

    seen.add(code);
    uniqueCodes.push(code);
  });

  if (uniqueCodes.length === 0) {
    return {
      requested: requested.length,
      unique: 0,
      updated: 0,
      alreadyStandby: [] as string[],
      skippedAdmin: [] as string[],
      missing: [] as string[],
      duplicates,
    };
  }

  const rows = await getStaffRows();
  const byCode = new Map(rows.map((row) => [cleanCode(row.maNV), row]));
  const alreadyStandby: string[] = [];
  const skippedAdmin: string[] = [];
  const missing: string[] = [];
  let updated = 0;

  for (const code of uniqueCodes) {
    const row = byCode.get(code);

    if (!row) {
      missing.push(code);
      continue;
    }

    if (row.permission === "admin") {
      skippedAdmin.push(code);
      continue;
    }

    if (String(row.status || "").trim().toLowerCase() === "standby") {
      alreadyStandby.push(code);
      continue;
    }

    await updateStaffStatus(row.rowNumber, "Standby", row.maNV);
    updated += 1;
  }

  return {
    requested: requested.length,
    unique: uniqueCodes.length,
    updated,
    alreadyStandby,
    skippedAdmin,
    missing,
    duplicates,
  };
}

export async function deleteStaffAccount(rowNumber: number, maNV: string) {
  const staffCode = cleanCode(maNV);

  if (isSupabaseConfigured()) {
    try {
      const rows = await deleteRows<any>(
        "staff",
        { ma_nv: eq(staffCode) },
        { returning: "representation" }
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("Không tìm thấy nhân viên trong Supabase để xóa.");
      }

      return;
    } catch (err: any) {
      console.warn("SUPABASE_STAFF_DELETE_ERROR:", err?.message || err);
      throw err;
    }
  }

  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  return enqueueStaffWrite(async () => {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    const staffSheet = spreadsheet.data.sheets?.find((item) => item.properties?.title === SHEET_NAME);
    const sheetId = staffSheet?.properties?.sheetId;

    if (typeof sheetId !== "number") {
      throw new Error(`Không tìm thấy sheet ${SHEET_NAME} để xóa nhân viên.`);
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: Math.max(1, rowNumber - 1),
                endIndex: Math.max(2, rowNumber),
              },
            },
          },
        ],
      },
    });
  });
}

export async function updateStaffPermission(rowNumber: number, permission: "admin" | "mod" | "", maNV?: string) {
  await ensureStaffAdminHeaders();
  if (await updateDbStaffByRowNumber(rowNumber, { permission: normalizePermission(permission) }, maNV)) {
    return;
  }

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


function parsePermissionTokens(value: any) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item, index, arr) => Boolean(item) && arr.indexOf(item) === index);
}

function normalizeStaffToolPermissionTokens(value: any) {
  return parsePermissionTokens(value).filter((item) => STAFF_TOOL_PERMISSION_KEYS.has(item));
}

function mergePermissionTokens(...groups: string[]) {
  return groups
    .flatMap((group) => parsePermissionTokens(group))
    .filter((item, index, arr) => Boolean(item) && arr.indexOf(item) === index)
    .join(",");
}

export function staffHasCheckinToolAccess(staff: Pick<StaffRow, "permission" | "modulePermissions"> | null | undefined) {
  if (!staff) return false;
  if (normalizePermission(staff.permission) === "admin") return true;

  const tokens = new Set(parsePermissionTokens(staff.modulePermissions));
  return tokens.has(STAFF_TOOL_CHECKIN_PERMISSION) || tokens.has("action:tools-checkin");
}

function normalizeModulePermissions(value: any) {
  const allowed = new Set([
    "tcdm",
    "quy-trinh-thu-cu",
    "may-moi",
    "may-cu",
    "demo",
    "tools",
    "people",
    "action:staff-manage",
    "action:staff-delete",
    "action:staff-security",
    "action:settings-write",
    "action:reload-data",
    "action:dashboard-view",
    "action:tools-pmh",
    "action:tools-coming",
    "action:tools-report",
    "action:tools-telegram",
    "action:tools-checkin",
  ]);

  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item, index, arr) => allowed.has(item) && arr.indexOf(item) === index)
    .join(",");
}

export async function updateStaffAdminAccess(
  rowNumber: number,
  data: { maNV?: string; permission: "admin" | "mod" | ""; modules?: string }
) {
  await ensureStaffAdminHeaders();
  const permission = normalizePermission(data.permission);
  const current = data.maNV ? await findStaffByMaNV(data.maNV) : null;
  const staffToolModules = normalizeStaffToolPermissionTokens(current?.modulePermissions || "").join(",");
  const adminModules = permission === "mod" ? normalizeModulePermissions(data.modules) : "";
  const modules = mergePermissionTokens(adminModules, staffToolModules);

  if (await updateDbStaffByRowNumber(rowNumber, {
    permission,
    module_permissions: modules,
  }, data.maNV)) {
    return;
  }

  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  return enqueueStaffWrite(async () => {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!P${rowNumber}:Q${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[permission, modules]] },
    });
  });
}

export async function updateStaffCheckinToolAccess(
  rowNumber: number,
  data: { maNV?: string; enabled: boolean }
) {
  await ensureStaffAdminHeaders();

  const current = data.maNV ? await findStaffByMaNV(data.maNV) : null;
  const tokens = parsePermissionTokens(current?.modulePermissions || "");
  const nextTokens = data.enabled
    ? [...tokens, STAFF_TOOL_CHECKIN_PERMISSION]
    : tokens.filter((item) => item !== STAFF_TOOL_CHECKIN_PERMISSION);
  const modules = nextTokens.filter((item, index, arr) => Boolean(item) && arr.indexOf(item) === index).join(",");

  if (await updateDbStaffByRowNumber(rowNumber, { module_permissions: modules }, data.maNV)) {
    return;
  }

  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  return enqueueStaffWrite(async () => {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!Q${rowNumber}:Q${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[modules]] },
    });
  });
}

export async function adminResetStaffSecurity(rowNumber: number, data: { maNV?: string; passwordHash: string }) {
  if (await updateDbStaffByRowNumber(rowNumber, {
    password_hash: data.passwordHash,
    security_question: "",
    security_answer: "",
    gmail: "",
    reset_otp_hash: "",
    reset_otp_expires: "",
    reset_otp_day: "",
    reset_otp_count: "0",
    need_setup: "1",
  }, data.maNV)) {
    return;
  }

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

export async function adminResetStaffOtpCount(rowNumber: number, maNV?: string) {
  if (await updateDbStaffByRowNumber(rowNumber, { reset_otp_count: "0" }, maNV)) {
    return;
  }

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
