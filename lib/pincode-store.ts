import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const DEFAULT_PINCODE_SPREADSHEET_ID = "1cmuS7ipRG3Dhh1uycqgWhCKwNRnwB42wDR2ckPNULFw";

const STAFF_SHEET = "Data_Staff";
const PMH_SHEET = "PMH";
const REQUEST_SHEET = "Data_PincodeAudit";
const LEGACY_REQUEST_SHEET = "Data_Pincode";

const PMH_HEADERS = ["PINCODE", "STATUS", "MENH_GIA"];
const REQUEST_HEADERS = [
  "TIME",
  "MA_ST",
  "MA_NV",
  "IMEI",
  "IMAGE_1",
  "IMAGE_2",
  "IMAGE_3",
  "IMAGE_4",
  "IMAGE_5",
  "IMAGE_6",
  "STATUS",
  "PINCODE",
  "REASON",
  "ADMIN",
  "DONE",
  "MENH_GIA",
  "MODEL_CU",
  "MODEL_MOI",
  "FLOW",
  "NOTE",
  "STAFF_NAME",
  "STORE_NAME",
  "UPDATED_AT",
  "USER_AGENT",
];

let pincodeWriteQueue: Promise<any> = Promise.resolve();
let legacySheetCleanupAttempted = false;

function enqueuePincodeWrite<T>(job: () => Promise<T>) {
  const nextJob = pincodeWriteQueue.then(job, job);
  pincodeWriteQueue = nextJob.then(() => undefined).catch(() => undefined);
  return nextJob;
}

function getSpreadsheetId() {
  return String(process.env.PINCODE_SPREADSHEET_ID || DEFAULT_PINCODE_SPREADSHEET_ID).trim();
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

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function cleanCode(value: unknown) {
  return clean(value).replace(/\.0$/, "");
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
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName);

  return typeof sheet?.properties?.sheetId === "number" ? sheet.properties.sheetId : null;
}

async function ensureSheet(sheetName: string, headers: string[]) {
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

    sheetId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
  }

  const endCol = getColumnLetter(headers.length);
  const existing = await sheets.spreadsheets.values
    .get({ spreadsheetId, range: `${sheetName}!A1:${endCol}1` })
    .catch(() => null);
  const firstRow = existing?.data.values?.[0] || [];
  const hasHeader = firstRow.some((cell) => clean(cell));

  if (!hasHeader) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:${endCol}1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] },
    });
  }

  return sheetId;
}

async function ensureRequestSheet() {
  await ensureSheet(REQUEST_SHEET, REQUEST_HEADERS);

  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const endCol = getColumnLetter(REQUEST_HEADERS.length);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${REQUEST_SHEET}!A1:${endCol}1`,
  });
  const current = res.data.values?.[0] || [];
  const isMainRequestHeader =
    clean(current[0]).toUpperCase() === "TIME" &&
    clean(current[10]).toUpperCase() === "STATUS" &&
    clean(current[18]).toUpperCase() === "FLOW";

  if (!isMainRequestHeader) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${REQUEST_SHEET}!A1:${endCol}1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [REQUEST_HEADERS] },
    });
  }
}

async function ensurePincodeSheets() {
  await ensureSheet(PMH_SHEET, PMH_HEADERS);
  await ensureRequestSheet();
  await deleteLegacyRequestSheet();
}

async function deleteLegacyRequestSheet() {
  if (legacySheetCleanupAttempted) return;
  legacySheetCleanupAttempted = true;

  try {
    const sheetId = await getSheetIdByName(LEGACY_REQUEST_SHEET);
    if (sheetId === null) return;

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteSheet: { sheetId },
          },
        ],
      },
    });
  } catch (err: any) {
    console.warn("SKIP_DELETE_LEGACY_Data_Pincode:", err?.message || err);
  }
}

async function readValues(range: string) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });

  return res.data.values || [];
}

export type PincodeFlow = "ChienGia" | "NgoaiDS";
export type PincodeStatus = "Pending" | "Approved" | "Rejected_Soft" | "Rejected_Hard" | "Completed";

export type PincodeRequest = {
  requestId: string;
  rowNumber: number;
  createdAt: string;
  flow: PincodeFlow;
  flowLabel: string;
  maST: string;
  maNV: string;
  staffName: string;
  storeName: string;
  imei: string;
  modelCu: string;
  modelMoi: string;
  note: string;
  status: PincodeStatus;
  pinCode: string;
  menhGia: string;
  reason: string;
  admin: string;
  updatedAt: string;
  completedAt: string;
  imageUrls: string[];
};

export type PincodeStaff = {
  maNV: string;
  staffName: string;
  maST: string;
  storeName: string;
  status: string;
};

export type PmhStat = {
  menhGia: string;
  count: number;
};

export function normalizePincodeFlow(value: unknown): PincodeFlow {
  return clean(value) === "ChienGia" ? "ChienGia" : "NgoaiDS";
}

export function getPincodeFlowLabel(flow: unknown) {
  return normalizePincodeFlow(flow) === "ChienGia" ? "Chiến giá" : "Máy ngoài danh sách";
}

function getPmhFlowSuffix(flow: unknown) {
  return normalizePincodeFlow(flow) === "ChienGia" ? "All" : "TCDM";
}

function getPmhSuffixFromMenhGia(menhGia: unknown) {
  const parts = clean(menhGia).split(/\s+/);
  const last = parts[parts.length - 1]?.toUpperCase() || "";
  if (last === "ALL") return "All";
  if (last === "TCDM") return "TCDM";
  return "";
}

function isPmhMenhGiaMatchFlow(menhGia: unknown, flow: unknown) {
  return getPmhSuffixFromMenhGia(menhGia) === getPmhFlowSuffix(flow);
}

function normalizeStatus(value: unknown, done?: unknown): PincodeStatus {
  if (clean(done).toLowerCase() === "done") return "Completed";

  const status = clean(value);
  if (status === "Approved") return "Approved";
  if (status === "Rejected_Soft") return "Rejected_Soft";
  if (status === "Rejected_Hard") return "Rejected_Hard";
  if (status === "Completed") return "Completed";
  return "Pending";
}

function isValidStoredStatus(value: unknown) {
  const status = clean(value);
  return status === "Pending" || status === "Approved" || status === "Rejected_Soft" || status === "Rejected_Hard";
}

function normalizeImageList(row: any[]) {
  return row.slice(4, 10).map(clean).filter(Boolean);
}

function mapRequestRow(row: any[], index: number): PincodeRequest {
  const rowNumber = index + 2;
  const flow = normalizePincodeFlow(row[18]);
  const done = clean(row[14]);
  const status = normalizeStatus(row[10], done);

  return {
    requestId: String(rowNumber),
    rowNumber,
    createdAt: clean(row[0]),
    flow,
    flowLabel: getPincodeFlowLabel(flow),
    maST: cleanCode(row[1]),
    maNV: cleanCode(row[2]),
    staffName: clean(row[20]),
    storeName: clean(row[21]),
    imei: clean(row[3]),
    modelCu: clean(row[16]),
    modelMoi: clean(row[17]),
    note: clean(row[19]),
    status,
    pinCode: clean(row[11]),
    menhGia: clean(row[15]),
    reason: clean(row[12]),
    admin: clean(row[13]),
    updatedAt: clean(row[22]),
    completedAt: done.toLowerCase() === "done" ? clean(row[22]) || clean(row[0]) : "",
    imageUrls: normalizeImageList(row),
  };
}

function isMainRequestRow(row: any[]) {
  if (!clean(row[0]) || !clean(row[1]) || !clean(row[2]) || !clean(row[3])) return false;
  if (!isValidStoredStatus(row[10])) return false;
  if (clean(row[3]) === "ChienGia" || clean(row[3]) === "NgoaiDS") return false;
  return true;
}

function parseUpdatedRowNumber(range?: string | null) {
  const match = String(range || "").match(/![A-Z]+(\d+):/);
  const rowNumber = match ? Number(match[1]) : 0;
  return Number.isFinite(rowNumber) && rowNumber >= 2 ? rowNumber : 0;
}

async function getRow(rowNumber: number) {
  if (!rowNumber || rowNumber < 2) return null;
  await ensurePincodeSheets();
  const rows = await readValues(`${REQUEST_SHEET}!A${rowNumber}:X${rowNumber}`);
  const row = rows[0] || [];
  if (!isMainRequestRow(row)) return null;
  return mapRequestRow(row, rowNumber - 2);
}

export async function getPincodeStaffByMaNV(maNV: string) {
  const target = cleanCode(maNV);
  if (!target) return null;

  const rows = await readValues(`${STAFF_SHEET}!A2:Q`);

  for (const row of rows) {
    if (cleanCode(row[0]) !== target) continue;

    return {
      maNV: cleanCode(row[0]),
      staffName: clean(row[1]),
      maST: cleanCode(row[2]),
      storeName: clean(row[3]),
      status: clean(row[9]),
    } satisfies PincodeStaff;
  }

  return null;
}

export async function getPincodeRequests(limit = 300) {
  await ensurePincodeSheets();
  const rows = await readValues(`${REQUEST_SHEET}!A2:X`);

  return rows
    .filter(isMainRequestRow)
    .map(mapRequestRow)
    .reverse()
    .slice(0, Math.max(1, Math.min(1000, limit)));
}

export async function getPincodeRequestById(requestId: string) {
  const rowNumber = Number(clean(requestId));
  if (!Number.isFinite(rowNumber) || rowNumber < 2) return null;
  return getRow(rowNumber);
}

export async function getPmhStats(flow?: PincodeFlow) {
  await ensurePincodeSheets();
  const rows = await readValues(`${PMH_SHEET}!A2:C`);
  const stats = new Map<string, number>();

  rows.forEach((row) => {
    const pin = clean(row[0]);
    const status = clean(row[1]);
    const menhGia = clean(row[2]) || "Mặc định";

    if (!pin || status === "Used") return;
    if (flow && !isPmhMenhGiaMatchFlow(menhGia, flow)) return;
    stats.set(menhGia, (stats.get(menhGia) || 0) + 1);
  });

  return Array.from(stats.entries())
    .map(([menhGia, count]) => ({ menhGia, count }))
    .sort((a, b) => a.menhGia.localeCompare(b.menhGia, "vi", { numeric: true }));
}

export async function getPincodeAdminDashboard() {
  const [requests, allStats, chienGiaStats, ngoaiDsStats] = await Promise.all([
    getPincodeRequests(500),
    getPmhStats(),
    getPmhStats("ChienGia"),
    getPmhStats("NgoaiDS"),
  ]);

  return {
    requests,
    stats: {
      total: requests.length,
      pending: requests.filter((item) => item.status === "Pending").length,
      approved: requests.filter((item) => item.status === "Approved" || item.status === "Completed").length,
      rejected: requests.filter((item) => item.status === "Rejected_Hard" || item.status === "Rejected_Soft").length,
      availablePins: allStats.reduce((sum, item) => sum + item.count, 0),
    },
    pmh: {
      all: allStats,
      chienGia: chienGiaStats,
      ngoaiDs: ngoaiDsStats,
    },
  };
}

async function findActiveDuplicate(imei: string, flow: PincodeFlow) {
  const targetImei = clean(imei).toUpperCase();
  if (!targetImei) return null;

  const requests = await getPincodeRequests(1000);

  return (
    requests.find((item) => {
      if (item.flow !== flow) return false;
      if (item.imei.toUpperCase() !== targetImei) return false;
      if (item.status === "Rejected_Hard") return false;
      return true;
    }) || null
  );
}

export async function createPincodeRequest(data: {
  flow: PincodeFlow;
  maST: string;
  maNV: string;
  imei: string;
  modelCu: string;
  modelMoi: string;
  note?: string;
  imageUrls?: string[];
  userAgent?: string;
}) {
  await ensurePincodeSheets();

  const flow = normalizePincodeFlow(data.flow);
  const staff = await getPincodeStaffByMaNV(data.maNV);

  if (!staff) {
    throw new Error("Không tìm thấy mã nhân viên trong Data_Staff.");
  }

  if (staff.status && staff.status.toLowerCase() !== "active") {
    throw new Error("Tài khoản nhân viên chưa Active.");
  }

  const inputStore = cleanCode(data.maST);
  if (inputStore && staff.maST && inputStore !== staff.maST) {
    throw new Error(`Mã siêu thị không khớp Data_Staff. NV ${staff.maNV} thuộc ST ${staff.maST}.`);
  }

  const imei = clean(data.imei).toUpperCase();
  if (!imei || imei.length < 6) {
    throw new Error("Vui lòng nhập IMEI/SN hợp lệ.");
  }

  const imageUrls = Array.from({ length: 6 }, (_, index) => clean(data.imageUrls?.[index]));
  const timestamp = nowVN();
  const duplicate = await findActiveDuplicate(imei, flow);
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  if (duplicate) {
    if (duplicate.status === "Rejected_Soft") {
      return enqueuePincodeWrite(async () => {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${REQUEST_SHEET}!B${duplicate.rowNumber}:X${duplicate.rowNumber}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [
              [
                staff.maST || inputStore,
                staff.maNV,
                imei,
                ...imageUrls,
                "Pending",
                "",
                "",
                "",
                "",
                "",
                clean(data.modelCu),
                clean(data.modelMoi),
                flow,
                clean(data.note),
                staff.staffName,
                staff.storeName,
                timestamp,
                clean(data.userAgent),
              ],
            ],
          },
        });

        const request = await getPincodeRequestById(duplicate.requestId);

        return {
          success: true,
          recovered: false,
          request,
          message: "Đã cập nhật lại hồ sơ và chuyển về trạng thái chờ duyệt.",
        };
      });
    }

    return {
      success: true,
      recovered: true,
      request: duplicate,
      message: duplicate.status === "Pending"
        ? "Thiết bị này đang có hồ sơ chờ duyệt."
        : "Thiết bị này đã có hồ sơ được xử lý trước đó.",
    };
  }

  return enqueuePincodeWrite(async () => {
    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${REQUEST_SHEET}!A:X`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            timestamp,
            staff.maST || inputStore,
            staff.maNV,
            imei,
            ...imageUrls,
            "Pending",
            "",
            "",
            "",
            "",
            "",
            clean(data.modelCu),
            clean(data.modelMoi),
            flow,
            clean(data.note),
            staff.staffName,
            staff.storeName,
            timestamp,
            clean(data.userAgent),
          ],
        ],
      },
    });

    const rowNumber = parseUpdatedRowNumber(appendRes.data.updates?.updatedRange);
    const request = rowNumber ? await getPincodeRequestById(String(rowNumber)) : null;

    return {
      success: true,
      recovered: false,
      request,
      message: "Đã gửi hồ sơ thẩm định PMH.",
    };
  });
}

export async function importPincodes(list: Array<{ pin: string; menhGia: string }>) {
  await ensurePincodeSheets();

  return enqueuePincodeWrite(async () => {
    const rows = await readValues(`${PMH_SHEET}!A2:C`);
    const existing = new Set(rows.map((row) => clean(row[0])).filter(Boolean));
    const current = new Set<string>();
    const duplicates: string[] = [];
    const invalid: string[] = [];
    const appendRows: string[][] = [];

    list.forEach((item) => {
      const pin = clean(item.pin);
      const menhGia = clean(item.menhGia);

      if (!pin) return;
      if (!getPmhSuffixFromMenhGia(menhGia)) {
        invalid.push(`${pin} | ${menhGia || "Trống mệnh giá"}`);
        return;
      }
      if (existing.has(pin) || current.has(pin)) {
        duplicates.push(pin);
        return;
      }

      current.add(pin);
      appendRows.push([pin, "", menhGia]);
    });

    if (invalid.length > 0) {
      return {
        success: false,
        message: "Mệnh giá PMH phải có hậu tố All hoặc TCDM. Ví dụ: 300K All / 300K TCDM.",
        invalid,
      };
    }

    if (duplicates.length > 0) {
      return {
        success: false,
        message: "Có Pincode bị trùng, quá trình nạp đã hủy.",
        duplicates,
      };
    }

    if (appendRows.length > 0) {
      const sheets = await getSheetsClient();
      const spreadsheetId = getSpreadsheetId();

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${PMH_SHEET}!A:C`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: appendRows },
      });
    }

    return {
      success: true,
      imported: appendRows.length,
    };
  });
}

export async function approvePincodeRequest(data: {
  requestId: string;
  admin: string;
  menhGia?: string;
}) {
  await ensurePincodeSheets();

  return enqueuePincodeWrite(async () => {
    const request = await getPincodeRequestById(data.requestId);
    if (!request) throw new Error("Không tìm thấy hồ sơ cần duyệt.");
    if (request.status !== "Pending") throw new Error(`Hồ sơ đã được xử lý với trạng thái ${request.status}.`);

    const pmhRows = await readValues(`${PMH_SHEET}!A2:C`);
    const selectedMenhGia = clean(data.menhGia);
    let pinCode = "";
    let pinRowNumber = -1;
    let actualMenhGia = "";

    if (selectedMenhGia && !isPmhMenhGiaMatchFlow(selectedMenhGia, request.flow)) {
      throw new Error(`Mệnh giá "${selectedMenhGia}" không thuộc luồng ${request.flowLabel}.`);
    }

    for (let i = 0; i < pmhRows.length; i += 1) {
      const pin = clean(pmhRows[i][0]);
      const status = clean(pmhRows[i][1]);
      const menhGia = clean(pmhRows[i][2]);

      if (!pin || status === "Used") continue;
      if (!isPmhMenhGiaMatchFlow(menhGia, request.flow)) continue;
      if (selectedMenhGia && menhGia !== selectedMenhGia) continue;

      pinCode = pin;
      pinRowNumber = i + 2;
      actualMenhGia = menhGia;
      break;
    }

    if (!pinCode || pinRowNumber < 2) {
      throw new Error(
        selectedMenhGia
          ? `Hết PMH "${selectedMenhGia}".`
          : `Hết PMH thuộc luồng ${request.flowLabel}. Cần mã có hậu tố ${getPmhFlowSuffix(request.flow)}.`
      );
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    const timestamp = nowVN();

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: `${PMH_SHEET}!B${pinRowNumber}:B${pinRowNumber}`,
            values: [["Used"]],
          },
          {
            range: `${REQUEST_SHEET}!K${request.rowNumber}:P${request.rowNumber}`,
            values: [["Approved", pinCode, "", clean(data.admin), "", actualMenhGia]],
          },
          {
            range: `${REQUEST_SHEET}!W${request.rowNumber}:W${request.rowNumber}`,
            values: [[timestamp]],
          },
        ],
      },
    });

    return {
      success: true,
      pinCode,
      menhGia: actualMenhGia,
      message: `Đã duyệt và cấp PMH ${actualMenhGia}.`,
    };
  });
}

export async function rejectPincodeRequest(data: {
  requestId: string;
  admin: string;
  reason: string;
  soft?: boolean;
}) {
  await ensurePincodeSheets();

  return enqueuePincodeWrite(async () => {
    const request = await getPincodeRequestById(data.requestId);
    if (!request) throw new Error("Không tìm thấy hồ sơ cần từ chối.");
    if (request.status !== "Pending") throw new Error(`Hồ sơ đã được xử lý với trạng thái ${request.status}.`);

    const status: PincodeStatus = data.soft ? "Rejected_Soft" : "Rejected_Hard";
    const timestamp = nowVN();
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: `${REQUEST_SHEET}!K${request.rowNumber}:N${request.rowNumber}`,
            values: [[status, "", clean(data.reason) || "Admin từ chối hồ sơ.", clean(data.admin)]],
          },
          {
            range: `${REQUEST_SHEET}!W${request.rowNumber}:W${request.rowNumber}`,
            values: [[timestamp]],
          },
        ],
      },
    });

    return {
      success: true,
      message: data.soft ? "Đã yêu cầu nhân viên cập nhật lại hồ sơ." : "Đã từ chối cấp PMH.",
    };
  });
}

export async function markPincodeCompleted(requestId: string) {
  await ensurePincodeSheets();

  return enqueuePincodeWrite(async () => {
    const request = await getPincodeRequestById(requestId);
    if (!request) throw new Error("Không tìm thấy hồ sơ.");

    const timestamp = nowVN();
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: `${REQUEST_SHEET}!O${request.rowNumber}:O${request.rowNumber}`,
            values: [["Done"]],
          },
          {
            range: `${REQUEST_SHEET}!W${request.rowNumber}:W${request.rowNumber}`,
            values: [[timestamp]],
          },
        ],
      },
    });

    return { success: true };
  });
}
