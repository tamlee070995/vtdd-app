import { google } from "googleapis";
import { createHash } from "crypto";
import { eq, insertRows, isNull, isSupabaseConfigured, selectAllRows, selectRows, updateRows } from "@/lib/supabase-rest";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const DEFAULT_PINCODE_SPREADSHEET_ID = "1cmuS7ipRG3Dhh1uycqgWhCKwNRnwB42wDR2ckPNULFw";

const STAFF_SHEET = "Data_Staff";
const PMH_SHEET = "PMH";
const REQUEST_SHEET = "Data_PincodeAudit";
const LEGACY_REQUEST_SHEET = "Data_Pincode";
const NEW_MODEL_SHEET = "Data_Moi";
const OLD_MODEL_PHONE_SHEET = "Data_Cu";
const OLD_MODEL_TABLET_SHEET = "Data_Cu_Tablet";

const PMH_HEADERS = ["PINCODE", "STATUS", "MENH_GIA"];
const REQUEST_HEADERS = [
  "TIME",
  "Mã ST",
  "Mã NV",
  "IMEI",
  "Link ảnh 1",
  "Link ảnh 2",
  "Link ảnh 3",
  "Link ảnh 4",
  "Link ảnh 5",
  "Link ảnh 6",
  "Trạng thái",
  "Pincode",
  "Nội dung từ chối",
  "Admin duyệt",
  "Hoàn tất/Copy",
  "Mệnh giá",
  "Model cũ",
  "Model mới",
  "Loại hỗ trợ",
];

let pincodeWriteQueue: Promise<any> = Promise.resolve();
let legacySheetCleanupAttempted = false;
let pincodeSheetsEnsuredAt = 0;

const PINCODE_SHEETS_ENSURE_TTL_MS = 10 * 60 * 1000;
const STAFF_CACHE_TTL_MS = 5 * 60 * 1000;
const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_CACHE_TTL_MS = 5 * 1000;
const PMH_STATS_CACHE_TTL_MS = 20 * 1000;
const PMH_DUPLICATE_WINDOW_MS = 30 * 60 * 1000;
const PMH_REOPEN_WINDOW_MS = 5 * 60 * 1000;
const PMH_CLAIM_PREFIX = "[CLAIM:";

type ReadCacheEntry = {
  expiresAt: number;
  values?: any[][];
  promise?: Promise<any[][]>;
};

const readCache = new Map<string, ReadCacheEntry>();

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

function parseVietnamDateMs(value: unknown) {
  const raw = clean(value).replace(/^'/, "");
  if (!raw) return 0;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (iso) {
    return Date.UTC(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      Number(iso[4]) - 7,
      Number(iso[5]),
      Number(iso[6] || 0)
    );
  }

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (slash) {
    const first = Number(slash[1]);
    const second = Number(slash[2]);
    const day = first > 12 ? first : second;
    const month = first > 12 ? second : first;
    return Date.UTC(
      Number(slash[3]),
      month - 1,
      day,
      Number(slash[4]) - 7,
      Number(slash[5]),
      Number(slash[6] || 0)
    );
  }

  const parsed = new Date(raw.includes("T") ? raw : raw.replace(" ", "T")).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatIsoVN(ms: number) {
  if (!ms) return "";
  return new Date(ms).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function parseClaimMarker(value: unknown) {
  const raw = clean(value);
  if (!raw.startsWith(PMH_CLAIM_PREFIX)) return { admin: raw, claimedBy: "", claimedAt: "" };

  const marker = raw.match(/^\[CLAIM:([^|\]]+)(?:\|([^\]]+))?\]/);
  return {
    admin: "",
    claimedBy: clean(marker?.[1]),
    claimedAt: clean(marker?.[2]),
  };
}

function makeClaimMarker(admin: string) {
  return `${PMH_CLAIM_PREFIX}${clean(admin) || "Admin"}|${new Date().toISOString()}]`;
}

function enrichPincodeRequest(
  request: Omit<PincodeRequest, "claimedBy" | "claimedAt" | "ageMinutes" | "slaLevel" | "canReopen" | "reopenUntil">
): PincodeRequest {
  const claim = parseClaimMarker(request.admin);
  const createdMs = parseVietnamDateMs(request.createdAt);
  const now = Date.now();
  const ageMinutes = request.status === "Pending" && createdMs ? Math.max(0, Math.floor((now - createdMs) / 60000)) : 0;
  const closedMs = parseVietnamDateMs(request.updatedAt || request.completedAt || request.createdAt);
  const reopenUntilMs =
    (request.status === "Rejected_Hard" || request.status === "Rejected_Soft") && closedMs
      ? closedMs + PMH_REOPEN_WINDOW_MS
      : 0;

  return {
    ...request,
    admin: claim.admin,
    claimedBy: claim.claimedBy,
    claimedAt: claim.claimedAt ? formatIsoVN(parseVietnamDateMs(claim.claimedAt) || Date.parse(claim.claimedAt)) : "",
    ageMinutes,
    slaLevel: ageMinutes >= 10 ? "danger" : ageMinutes >= 5 ? "warn" : "ok",
    canReopen: Boolean(reopenUntilMs && reopenUntilMs >= now),
    reopenUntil: reopenUntilMs ? formatIsoVN(reopenUntilMs) : "",
  };
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
  let sheetId = await ensureSheet(REQUEST_SHEET, REQUEST_HEADERS);

  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const requestSheet = meta.data.sheets?.find((sheet) => sheet.properties?.title === REQUEST_SHEET);
  const columnCount = requestSheet?.properties?.gridProperties?.columnCount || REQUEST_HEADERS.length;
  sheetId = typeof requestSheet?.properties?.sheetId === "number" ? requestSheet.properties.sheetId : sheetId;

  if (sheetId !== null && columnCount < REQUEST_HEADERS.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: {
                  columnCount: REQUEST_HEADERS.length,
                },
              },
              fields: "gridProperties.columnCount",
            },
          },
        ],
      },
    });
  }

  const endCol = getColumnLetter(REQUEST_HEADERS.length);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${REQUEST_SHEET}!A1:${endCol}1`,
  });
  const current = res.data.values?.[0] || [];
  const isMainRequestHeader =
    clean(current[0]).toUpperCase() === "TIME" &&
    clean(current[10]).toUpperCase() === clean(REQUEST_HEADERS[10]).toUpperCase() &&
    clean(current[18]).toUpperCase() === clean(REQUEST_HEADERS[18]).toUpperCase();

  if (!isMainRequestHeader) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${REQUEST_SHEET}!A1:${endCol}1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [REQUEST_HEADERS] },
    });
  }

  if (sheetId !== null && columnCount > REQUEST_HEADERS.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "COLUMNS",
                startIndex: REQUEST_HEADERS.length,
                endIndex: columnCount,
              },
            },
          },
        ],
      },
    });
  }
}

async function ensurePincodeSheets() {
  if (Date.now() - pincodeSheetsEnsuredAt < PINCODE_SHEETS_ENSURE_TTL_MS) return;

  await ensureSheet(PMH_SHEET, PMH_HEADERS);
  await ensureRequestSheet();
  await deleteLegacyRequestSheet();
  pincodeSheetsEnsuredAt = Date.now();
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

function cloneRows(rows: any[][]) {
  return rows.map((row) => [...row]);
}

async function readValuesCached(range: string, ttlMs: number) {
  const cacheKey = `${getSpreadsheetId()}|${range}`;
  const now = Date.now();
  const cached = readCache.get(cacheKey);

  if (cached?.values && cached.expiresAt > now) {
    return cloneRows(cached.values);
  }

  if (cached?.promise) {
    return cloneRows(await cached.promise);
  }

  const promise = readValues(range)
    .then((rows) => {
      readCache.set(cacheKey, {
        expiresAt: Date.now() + ttlMs,
        values: cloneRows(rows),
      });
      return rows;
    })
    .catch((err) => {
      readCache.delete(cacheKey);
      throw err;
    });

  readCache.set(cacheKey, {
    expiresAt: now + Math.min(ttlMs, 1000),
    promise,
  });

  return cloneRows(await promise);
}

function invalidateReadCache(sheetName?: string) {
  if (!sheetName) {
    readCache.clear();
    return;
  }

  const sheetPrefix = `${sheetName}!`;
  Array.from(readCache.keys()).forEach((key) => {
    if (key.includes(sheetPrefix)) readCache.delete(key);
  });
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
  claimedBy: string;
  claimedAt: string;
  ageMinutes: number;
  slaLevel: "ok" | "warn" | "danger";
  canReopen: boolean;
  reopenUntil: string;
  doneStatus: string;
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

export type PincodeStaffLookup = {
  valid: boolean;
  message: string;
  staff: PincodeStaff | null;
  store: {
    maST: string;
    storeName: string;
  } | null;
  query: {
    maST: string;
    maNV: string;
  };
};

export type PmhStat = {
  menhGia: string;
  count: number;
};

export function normalizePincodeFlow(value: unknown): PincodeFlow {
  return clean(value) === "ChienGia" ? "ChienGia" : "NgoaiDS";
}

function normalizeComparable(value: unknown) {
  return clean(value)
    .normalize("NFC")
    .toLocaleLowerCase("vi-VN");
}

function normalizeDeviceCategory(value: unknown) {
  const normalized = normalizeComparable(value);
  if (normalized === normalizeComparable("Điện thoại")) return "Điện thoại";
  if (normalized === normalizeComparable("Máy tính bảng") || normalized === normalizeComparable("Tablet")) return "Tablet";
  return "";
}

function isAppleNewProduct(brand: unknown, modelName: unknown) {
  const text = normalizeComparable(`${clean(brand)} ${clean(modelName)}`);
  return text.includes("apple") || text.includes("iphone") || text.includes("ipad");
}

function isValidImei(value: string) {
  const digits = clean(value).replace(/\D/g, "");
  if (!/^\d{15}$/.test(digits)) return false;

  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  return sum % 10 === 0;
}

function isValidSerialNumber(value: string) {
  return /^[A-Z0-9]{11}$/.test(clean(value).toUpperCase());
}

function normalizeIdentifier(value: unknown, type?: unknown) {
  const requestedType = clean(type).toLowerCase();
  const raw = clean(value).toUpperCase();

  if (requestedType === "serial" || raw.startsWith("SN:")) {
    const serial = raw.replace(/^SN:\s*/, "");
    if (!isValidSerialNumber(serial)) {
      throw new Error("Lỗi cú pháp Serial Number, nhập lại");
    }
    return `SN:${serial}`;
  }

  const imei = raw.replace(/\D/g, "");
  if (!isValidImei(imei)) {
    throw new Error("Lỗi cú pháp IMEI, nhập lại");
  }
  return imei;
}

export function getPincodeFlowLabel(flow: unknown) {
  return normalizePincodeFlow(flow) === "ChienGia" ? "Chiến giá" : "Máy ngoài danh sách";
}

function getPmhFlowSuffix(flow: unknown) {
  return normalizePincodeFlow(flow) === "ChienGia" ? "All" : "TCDM";
}

function getPincodeRequiredFileCount(flow: unknown) {
  return normalizePincodeFlow(flow) === "ChienGia" ? 5 : 6;
}

function normalizePincodeImageSlots(slots: unknown, flow: unknown) {
  const maxSlot = getPincodeRequiredFileCount(flow);

  return Array.from(
    new Set(
      (Array.isArray(slots) ? slots : [])
        .map((item) => clean(item))
        .filter((item) => {
          const value = Number(item);
          return Number.isInteger(value) && value >= 1 && value <= maxSlot;
        })
    )
  ).sort((a, b) => Number(a) - Number(b));
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

function getPmhMenhGiaValue(menhGia: unknown) {
  const raw = clean(menhGia).toUpperCase();
  const match = raw.match(/(\d[\d.,]*)/);
  if (!match) return Number.MAX_SAFE_INTEGER;

  const numberText = match[1].replace(/[.,]/g, "");
  const value = Number(numberText);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function comparePmhMenhGia(a: unknown, b: unknown) {
  const diff = getPmhMenhGiaValue(a) - getPmhMenhGiaValue(b);
  if (diff !== 0) return diff;
  return clean(a).localeCompare(clean(b), "vi", { numeric: true });
}

function isPmhUsedStatus(value: unknown) {
  return clean(value).toLowerCase() === "used";
}

function assertPincodeClaimOwner(request: PincodeRequest, admin: unknown) {
  const claimedBy = clean(request.claimedBy);
  const currentAdmin = clean(admin);

  if (claimedBy && claimedBy !== currentAdmin) {
    throw new Error(`Hồ sơ đã được ${claimedBy} nhận xử lý.`);
  }
}

function normalizeStatus(value: unknown, done?: unknown): PincodeStatus {
  if (clean(done).toLowerCase() === "done") return "Completed";

  const status = clean(value);
  if (status === "Approved" || status === "Approve") return "Approved";
  if (status === "Rejected_Soft") return "Rejected_Soft";
  if (status === "Rejected_Hard") return "Rejected_Hard";
  if (status === "Completed") return "Completed";
  return "Pending";
}

function isValidStoredStatus(value: unknown) {
  const status = clean(value);
  return status === "Pending" || status === "Approved" || status === "Approve" || status === "Rejected_Soft" || status === "Rejected_Hard";
}

function normalizeImageList(row: any[]) {
  return row.slice(4, 10).map(clean).filter(Boolean);
}

function mapRequestRow(row: any[], index: number): PincodeRequest {
  const rowNumber = index + 2;
  const flow = normalizePincodeFlow(row[18]);
  const done = clean(row[14]);
  const status = normalizeStatus(row[10], done);

  return enrichPincodeRequest({
    requestId: String(rowNumber),
    rowNumber,
    createdAt: clean(row[0]),
    flow,
    flowLabel: getPincodeFlowLabel(flow),
    maST: cleanCode(row[1]),
    maNV: cleanCode(row[2]),
    staffName: "",
    storeName: "",
    imei: clean(row[3]),
    modelCu: clean(row[16]),
    modelMoi: clean(row[17]),
    note: "",
    status,
    pinCode: clean(row[11]),
    menhGia: clean(row[15]),
    reason: clean(row[12]),
    admin: clean(row[13]),
    doneStatus: done,
    updatedAt: "",
    completedAt: done.toLowerCase() === "done" ? clean(row[0]) : clean(row[0]),
    imageUrls: normalizeImageList(row),
  });
}

function sourceRowNumber(value: unknown, fallback = 0) {
  const n = Number(clean(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function makeRequestId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeStableRequestId(parts: unknown[]) {
  const raw = parts.map(clean).join("|");
  const hasData = raw.replace(/\|/g, "").trim();
  if (!hasData) return "";

  return `req_${createHash("sha1").update(raw).digest("hex").slice(0, 18)}`;
}

function getDbRequestPublicId(row: any) {
  const requestId = clean(row.request_id);
  if (requestId) return requestId;

  const dbId = clean(row.id);
  if (dbId) return `db:${dbId}`;

  const sourceRow = clean(row.source_row);
  if (sourceRow) return sourceRow;

  return makeStableRequestId([
    row.created_at_text,
    row.ma_st,
    row.ma_nv,
    row.imei,
    row.support_type,
    row.pincode,
    row.old_model,
    row.new_model,
  ]);
}

function mapDbStaff(row: any): PincodeStaff {
  return {
    maNV: cleanCode(row.ma_nv),
    staffName: clean(row.staff_name),
    maST: cleanCode(row.ma_st),
    storeName: clean(row.store_name),
    status: clean(row.status),
  };
}

function mapDbRequestRow(row: any): PincodeRequest {
  const requestId = getDbRequestPublicId(row);
  const rowNumber = sourceRowNumber(row.source_row, 0);
  const flow = normalizePincodeFlow(row.support_type);
  const done = clean(row.completion_status);
  const status = normalizeStatus(row.status, done);

  return enrichPincodeRequest({
    requestId,
    rowNumber,
    createdAt: clean(row.created_at_text),
    flow,
    flowLabel: getPincodeFlowLabel(flow),
    maST: cleanCode(row.ma_st),
    maNV: cleanCode(row.ma_nv),
    staffName: "",
    storeName: "",
    imei: clean(row.imei),
    modelCu: clean(row.old_model),
    modelMoi: clean(row.new_model),
    note: "",
    status,
    pinCode: clean(row.pincode),
    menhGia: clean(row.menh_gia),
    reason: clean(row.reject_reason),
    admin: clean(row.admin_reviewer),
    doneStatus: done,
    updatedAt: clean(row.updated_at || row.updated_at_text || row.created_at_text),
    completedAt: done.toLowerCase() === "done" ? clean(row.updated_at || row.created_at_text) : clean(row.updated_at || row.created_at_text),
    imageUrls: [
      row.image_link_1,
      row.image_link_2,
      row.image_link_3,
      row.image_link_4,
      row.image_link_5,
      row.image_link_6,
    ].map(clean).filter(Boolean),
  });
}

function sortDbRequests(a: PincodeRequest, b: PincodeRequest) {
  const aRow = sourceRowNumber(a.rowNumber);
  const bRow = sourceRowNumber(b.rowNumber);
  if (aRow !== bRow) return bRow - aRow;
  return clean(b.createdAt).localeCompare(clean(a.createdAt), "vi", { numeric: true });
}

function dbRequestPatchFromInput(data: {
  createdAt?: string;
  maST?: string;
  maNV?: string;
  imei?: string;
  imageUrls?: string[];
  status?: string;
  pincode?: string;
  rejectReason?: string;
  adminReviewer?: string;
  completionStatus?: string;
  menhGia?: string;
  oldModel?: string;
  newModel?: string;
  supportType?: string;
  sourceRow?: string;
}) {
  const imageUrls = data.imageUrls || [];
  return {
    ...(typeof data.createdAt !== "undefined" ? { created_at_text: clean(data.createdAt) } : {}),
    ...(typeof data.maST !== "undefined" ? { ma_st: cleanCode(data.maST) } : {}),
    ...(typeof data.maNV !== "undefined" ? { ma_nv: cleanCode(data.maNV) } : {}),
    ...(typeof data.imei !== "undefined" ? { imei: clean(data.imei) } : {}),
    ...(typeof data.imageUrls !== "undefined" ? {
      image_link_1: clean(imageUrls[0]),
      image_link_2: clean(imageUrls[1]),
      image_link_3: clean(imageUrls[2]),
      image_link_4: clean(imageUrls[3]),
      image_link_5: clean(imageUrls[4]),
      image_link_6: clean(imageUrls[5]),
    } : {}),
    ...(typeof data.status !== "undefined" ? { status: clean(data.status) } : {}),
    ...(typeof data.pincode !== "undefined" ? { pincode: clean(data.pincode) } : {}),
    ...(typeof data.rejectReason !== "undefined" ? { reject_reason: clean(data.rejectReason) } : {}),
    ...(typeof data.adminReviewer !== "undefined" ? { admin_reviewer: clean(data.adminReviewer) } : {}),
    ...(typeof data.completionStatus !== "undefined" ? { completion_status: clean(data.completionStatus) } : {}),
    ...(typeof data.menhGia !== "undefined" ? { menh_gia: clean(data.menhGia) } : {}),
    ...(typeof data.oldModel !== "undefined" ? { old_model: clean(data.oldModel) } : {}),
    ...(typeof data.newModel !== "undefined" ? { new_model: clean(data.newModel) } : {}),
    ...(typeof data.supportType !== "undefined" ? { support_type: normalizePincodeFlow(data.supportType) } : {}),
    ...(typeof data.sourceRow !== "undefined" ? { source_row: clean(data.sourceRow) } : {}),
  };
}

async function updateDbPincodeRequest(requestId: string, patch: Record<string, unknown>) {
  const id = clean(requestId);
  if (!id) throw new Error("Thiếu mã hồ sơ PMH để cập nhật.");

  const filters: Array<Record<string, string>> = [];

  if (id.startsWith("db:")) {
    const dbId = id.slice(3);
    if (dbId) filters.push({ id: eq(dbId) });
  } else {
    filters.push({ request_id: eq(id) });
    if (/^\d+$/.test(id)) filters.push({ source_row: eq(id) });
  }

  if (id.startsWith("req_")) {
    const allRows = await selectAllRows<any>("pincode_requests");
    const fallback = allRows.find((row) => getDbRequestPublicId(row) === id);

    if (fallback) {
      const dbId = clean(fallback.id);
      const fallbackRequestId = clean(fallback.request_id);
      const sourceRow = clean(fallback.source_row);

      if (dbId) filters.unshift({ id: eq(dbId) });
      if (fallbackRequestId) filters.push({ request_id: eq(fallbackRequestId) });
      if (sourceRow) filters.push({ source_row: eq(sourceRow) });
      if (!dbId && !fallbackRequestId && !sourceRow) {
        filters.push({
          created_at_text: eq(clean(fallback.created_at_text)),
          ma_st: eq(cleanCode(fallback.ma_st)),
          ma_nv: eq(cleanCode(fallback.ma_nv)),
          imei: eq(clean(fallback.imei)),
          support_type: eq(clean(fallback.support_type)),
        });
      }
    }
  }

  for (const filter of filters) {
    const rows = await updateRows<any>("pincode_requests", filter, patch);
    if (Array.isArray(rows) && rows.length > 0) return rows;
  }

  throw new Error("Không tìm thấy hồ sơ PMH trong Database để cập nhật.");
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
  const rows = await readValues(`${REQUEST_SHEET}!A${rowNumber}:S${rowNumber}`);
  const row = rows[0] || [];
  if (!isMainRequestRow(row)) return null;
  return mapRequestRow(row, rowNumber - 2);
}

export async function getPincodeStaffByMaNV(maNV: string) {
  const target = cleanCode(maNV);
  if (!target) return null;

  if (isSupabaseConfigured()) {
    try {
      const rows = await selectRows<any>("staff", {
        filters: { ma_nv: eq(target) },
        limit: 1,
      });
      return rows[0] ? mapDbStaff(rows[0]) : null;
    } catch (err: any) {
      console.warn("SUPABASE_PINCODE_STAFF_ERROR:", err?.message || err);
      throw err;
    }
  }

  const rows = await readValuesCached(`${STAFF_SHEET}!A2:Q`, STAFF_CACHE_TTL_MS);

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

export async function lookupPincodeStaff(maST: string, maNV: string): Promise<PincodeStaffLookup> {
  const targetStore = cleanCode(maST);
  const targetStaff = cleanCode(maNV);

  if (isSupabaseConfigured()) {
    try {
      const [staffRows, storeRows] = await Promise.all([
        targetStaff
          ? selectRows<any>("staff", { filters: { ma_nv: eq(targetStaff) }, limit: 1 })
          : Promise.resolve([]),
        targetStore
          ? selectRows<any>("stores", { filters: { ma_st: eq(targetStore) }, limit: 1 })
          : Promise.resolve([]),
      ]);
      const staff = staffRows[0] ? mapDbStaff(staffRows[0]) : null;
      let store = storeRows[0]
        ? { maST: cleanCode(storeRows[0].ma_st), storeName: clean(storeRows[0].store_name) }
        : null;

      if (!store && targetStore && staff?.maST === targetStore) {
        store = { maST: staff.maST, storeName: staff.storeName };
      }

      let message = "";

      if (targetStore && !store) {
        message = "Mã siêu thị không tồn tại hoặc chưa có nhân viên trong hệ thống.";
      } else if (targetStaff && !staff) {
        message = "Mã nhân viên không tồn tại trong hệ thống.";
      } else if (staff?.status && staff.status.toLowerCase() !== "active") {
        message = "Tài khoản nhân viên chưa Active.";
      } else if (targetStore && staff && staff.maST !== targetStore) {
        message = "Mã siêu thị hoặc mã nhân viên không hợp lệ/không khớp.";
      }

      return {
        valid: Boolean(!message && (!targetStore || store) && (!targetStaff || staff)),
        message,
        staff,
        store,
        query: {
          maST: targetStore,
          maNV: targetStaff,
        },
      };
    } catch (err: any) {
      console.warn("SUPABASE_PINCODE_LOOKUP_ERROR:", err?.message || err);
      throw err;
    }
  }

  const rows = await readValuesCached(`${STAFF_SHEET}!A2:Q`, STAFF_CACHE_TTL_MS);
  const staffRows = rows.map((row) => ({
    maNV: cleanCode(row[0]),
    staffName: clean(row[1]),
    maST: cleanCode(row[2]),
    storeName: clean(row[3]),
    status: clean(row[9]),
  }));
  const staff = targetStaff ? staffRows.find((row) => row.maNV === targetStaff) || null : null;
  const storeRow = targetStore ? staffRows.find((row) => row.maST === targetStore) || null : null;
  const store = storeRow ? { maST: storeRow.maST, storeName: storeRow.storeName } : null;

  let message = "";

  if (targetStore && !store) {
    message = "Mã siêu thị không tồn tại hoặc chưa có nhân viên trong hệ thống.";
  } else if (targetStaff && !staff) {
    message = "Mã nhân viên không tồn tại trong hệ thống.";
  } else if (staff?.status && staff.status.toLowerCase() !== "active") {
    message = "Tài khoản nhân viên chưa Active.";
  } else if (targetStore && staff && staff.maST !== targetStore) {
    message = "Mã siêu thị hoặc mã nhân viên không hợp lệ/không khớp.";
  }

  const valid = Boolean(!message && (!targetStore || store) && (!targetStaff || staff));

  return {
    valid,
    message,
    staff,
    store,
    query: {
      maST: targetStore,
      maNV: targetStaff,
    },
  };
}

export async function getPincodeNewModelsByCategory(category: string) {
  const normalizedCategory = normalizeDeviceCategory(category);
  if (!normalizedCategory) return [];

  if (isSupabaseConfigured()) {
    try {
      const rows = await selectAllRows<any>("products_new", { order: "source_row.asc" });
      const models = new Map<string, string>();

      rows.forEach((row) => {
        const modelName = clean(row.product_name);
        const rowCategory = normalizeDeviceCategory(row.category);
        if (!modelName || rowCategory !== normalizedCategory) return;
        if (isAppleNewProduct(row.brand, modelName)) return;

        const key = normalizeComparable(modelName);
        if (!models.has(key)) models.set(key, modelName);
      });

      return Array.from(models.values()).sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
    } catch (err: any) {
      console.warn("SUPABASE_PINCODE_NEW_MODELS_ERROR:", err?.message || err);
      throw err;
    }
  }

  const rows = await readValuesCached(`${NEW_MODEL_SHEET}!B5:F`, MODEL_CACHE_TTL_MS);
  const models = new Map<string, string>();

  rows.forEach((row) => {
    const modelName = clean(row[0]);
    const rowCategory = normalizeDeviceCategory(row[4]);
    if (!modelName || rowCategory !== normalizedCategory) return;
    if (isAppleNewProduct("", modelName)) return;

    const key = normalizeComparable(modelName);
    if (!models.has(key)) models.set(key, modelName);
  });

  return Array.from(models.values()).sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
}

export async function getPincodeOldModels() {
  if (isSupabaseConfigured()) {
    try {
      const rows = await selectAllRows<any>("products_old", { order: "source_row.asc" });
      const models = new Map<string, string>();

      rows.forEach((row) => {
        const modelName = clean(row.product_name);
        if (!modelName) return;

        const key = normalizeComparable(modelName);
        if (!models.has(key)) models.set(key, modelName);
      });

      return Array.from(models.values()).sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
    } catch (err: any) {
      console.warn("SUPABASE_PINCODE_OLD_MODELS_ERROR:", err?.message || err);
      throw err;
    }
  }

  const [phoneRows, tabletRows] = await Promise.all([
    readValuesCached(`${OLD_MODEL_PHONE_SHEET}!B5:B`, MODEL_CACHE_TTL_MS).catch(() => []),
    readValuesCached(`${OLD_MODEL_TABLET_SHEET}!B5:B`, MODEL_CACHE_TTL_MS).catch(() => []),
  ]);
  const models = new Map<string, string>();

  [...phoneRows, ...tabletRows].forEach((row) => {
    const modelName = clean(row[0]);
    if (!modelName) return;

    const key = normalizeComparable(modelName);
    if (!models.has(key)) models.set(key, modelName);
  });

  return Array.from(models.values()).sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
}

async function isValidOldModel(modelName: string) {
  const selectedModel = normalizeComparable(modelName);
  if (!selectedModel) return false;

  const models = await getPincodeOldModels();
  return models.some((item) => normalizeComparable(item) === selectedModel);
}

async function isValidNewModelForCategory(category: string, modelName: string) {
  const selectedModel = normalizeComparable(modelName);
  if (!selectedModel) return false;

  const models = await getPincodeNewModelsByCategory(category);
  return models.some((item) => normalizeComparable(item) === selectedModel);
}

export async function getPincodeRequests(limit = 300) {
  if (isSupabaseConfigured()) {
    try {
      const rows = await selectAllRows<any>("pincode_requests");
      return rows
        .map(mapDbRequestRow)
        .filter((row) => row.createdAt && row.maST && row.maNV && row.imei)
        .sort(sortDbRequests)
        .slice(0, Math.max(1, Math.min(1000, limit)));
    } catch (err: any) {
      console.warn("SUPABASE_PINCODE_REQUESTS_ERROR:", err?.message || err);
      throw err;
    }
  }

  await ensurePincodeSheets();
  const rows = await readValuesCached(`${REQUEST_SHEET}!A2:S`, REQUEST_CACHE_TTL_MS);

  return rows
    .filter(isMainRequestRow)
    .map(mapRequestRow)
    .reverse()
    .slice(0, Math.max(1, Math.min(1000, limit)));
}

export async function getPincodeRequestById(requestId: string) {
  const id = clean(requestId);

  if (isSupabaseConfigured()) {
    try {
      let rows: any[] = [];

      if (id.startsWith("db:")) {
        const dbId = id.slice(3);
        rows = dbId
          ? await selectRows<any>("pincode_requests", {
              filters: { id: eq(dbId) },
              limit: 1,
            })
          : [];
      } else {
        rows = await selectRows<any>("pincode_requests", {
          filters: { request_id: eq(id) },
          limit: 1,
        });
      }

      if (rows.length === 0 && id && !id.startsWith("db:")) {
        rows = await selectRows<any>("pincode_requests", {
          filters: { source_row: eq(id) },
          limit: 1,
        });
      }

      if (rows.length === 0 && id.startsWith("req_")) {
        const allRows = await selectAllRows<any>("pincode_requests");
        const fallback = allRows.find((row) => getDbRequestPublicId(row) === id);
        rows = fallback ? [fallback] : [];
      }

      return rows[0] ? mapDbRequestRow(rows[0]) : null;
    } catch (err: any) {
      console.warn("SUPABASE_PINCODE_REQUEST_ERROR:", err?.message || err);
      throw err;
    }
  }

  const rowNumber = Number(clean(requestId));
  if (!Number.isFinite(rowNumber) || rowNumber < 2) return null;
  return getRow(rowNumber);
}

export async function findPincodeFollowUpRequest(data: {
  maST: string;
  maNV: string;
  flow?: PincodeFlow;
}) {
  const targetStore = cleanCode(data.maST);
  const targetStaff = cleanCode(data.maNV);
  const targetFlow = data.flow ? normalizePincodeFlow(data.flow) : "";

  if (!targetStore || !targetStaff) return null;

  const requests = await getPincodeRequests(1000);

  return (
    requests.find((item) => {
      if (item.maST !== targetStore || item.maNV !== targetStaff) return false;
      if (targetFlow && item.flow !== targetFlow) return false;

      const doneStatus = item.doneStatus.toLowerCase();
      if (item.status === "Pending") return true;
      if (item.status === "Approved" && item.pinCode && doneStatus !== "done" && doneStatus !== "x") return true;

      return false;
    }) || null
  );
}

export async function getPmhStats(flow?: PincodeFlow) {
  if (isSupabaseConfigured()) {
    try {
      const rows = await selectAllRows<any>("pmh_codes", { order: "source_row.asc" });
      const stats = new Map<string, number>();

      rows.forEach((row) => {
        const pin = clean(row.pincode);
        const status = clean(row.status);
        const menhGia = clean(row.menh_gia) || "Mặc định";

        if (!pin || isPmhUsedStatus(status) || clean(row.request_id)) return;
        if (flow && !isPmhMenhGiaMatchFlow(menhGia, flow)) return;
        stats.set(menhGia, (stats.get(menhGia) || 0) + 1);
      });

      return Array.from(stats.entries())
        .map(([menhGia, count]) => ({ menhGia, count }))
        .sort((a, b) => comparePmhMenhGia(a.menhGia, b.menhGia));
    } catch (err: any) {
      console.warn("SUPABASE_PMH_STATS_ERROR:", err?.message || err);
      throw err;
    }
  }

  await ensurePincodeSheets();
  const rows = await readValuesCached(`${PMH_SHEET}!A2:C`, PMH_STATS_CACHE_TTL_MS);
  const stats = new Map<string, number>();

  rows.forEach((row) => {
    const pin = clean(row[0]);
    const status = clean(row[1]);
    const menhGia = clean(row[2]) || "Mặc định";

    if (!pin || isPmhUsedStatus(status)) return;
    if (flow && !isPmhMenhGiaMatchFlow(menhGia, flow)) return;
    stats.set(menhGia, (stats.get(menhGia) || 0) + 1);
  });

  return Array.from(stats.entries())
    .map(([menhGia, count]) => ({ menhGia, count }))
    .sort((a, b) => comparePmhMenhGia(a.menhGia, b.menhGia));
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

async function findActiveDuplicate(imei: string, flow: PincodeFlow, maST?: string, maNV?: string) {
  const targetImei = clean(imei).toUpperCase();
  const targetStore = cleanCode(maST);
  const targetStaff = cleanCode(maNV);
  if (!targetImei) return null;

  const requests = await getPincodeRequests(1000);
  const now = Date.now();

  return (
    requests.find((item) => {
      if (item.flow !== flow) return false;
      if (item.imei.toUpperCase() !== targetImei) return false;
      if (targetStore && item.maST !== targetStore) return false;
      if (targetStaff && item.maNV !== targetStaff) return false;
      if (item.status === "Rejected_Hard") return false;
      if (item.doneStatus.toLowerCase() === "x") return false;
      const createdMs = parseVietnamDateMs(item.createdAt);
      if (createdMs && now - createdMs > PMH_DUPLICATE_WINDOW_MS && item.status !== "Approved") return false;
      return true;
    }) || null
  );
}

export async function createPincodeRequest(data: {
  flow: PincodeFlow;
  maST: string;
  maNV: string;
  imei: string;
  identifierType?: string;
  modelCu: string;
  oldRamRom?: string;
  modelMoi: string;
  deviceCategory?: string;
  note?: string;
  imageUrls?: string[];
  userAgent?: string;
}) {
  if (!isSupabaseConfigured()) {
    await ensurePincodeSheets();
  }

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
    throw new Error("Mã siêu thị hoặc mã nhân viên không hợp lệ/không khớp.");
  }

  const imei = normalizeIdentifier(data.imei, data.identifierType);
  const modelCuInput = clean(data.modelCu);
  const modelCu = flow === "ChienGia"
    ? modelCuInput
    : [modelCuInput, clean(data.oldRamRom)].filter(Boolean).join(" | RAM/ROM: ");
  const modelMoi = clean(data.modelMoi);
  const deviceCategory = normalizeDeviceCategory(data.deviceCategory);

  if (flow === "ChienGia") {
    if (!modelCuInput || !(await isValidOldModel(modelCuInput))) {
      throw new Error("Vui lòng chọn máy cũ trong danh sách Data_Cu / Data_Cu_Tablet.");
    }
  } else if (!modelCuInput || !clean(data.oldRamRom)) {
    throw new Error("Vui lòng nhập model máy cũ và chọn RAM/ROM.");
  }

  if (!deviceCategory) {
    throw new Error("Vui lòng chọn ngành hàng máy cũ.");
  }

  if (!modelMoi || !(await isValidNewModelForCategory(deviceCategory, modelMoi))) {
    throw new Error("Máy mới không nằm trong danh sách Data_Moi theo ngành hàng đã chọn.");
  }

  const imageUrls = Array.from({ length: 6 }, (_, index) => clean(data.imageUrls?.[index]));
  const requiredFileCount = flow === "ChienGia" ? 5 : 6;
  if (imageUrls.slice(0, requiredFileCount).some((url) => !url)) {
    throw new Error(`Vui lòng tải đủ ${requiredFileCount} file hồ sơ theo đúng từng ô yêu cầu.`);
  }

  const timestamp = nowVN();
  const duplicate = await findActiveDuplicate(imei, flow, staff.maST || inputStore, staff.maNV);

  if (isSupabaseConfigured()) {
    try {
      return await enqueuePincodeWrite(async () => {
        if (duplicate) {
          if (duplicate.status === "Rejected_Soft") {
            await updateDbPincodeRequest(
              duplicate.requestId,
              dbRequestPatchFromInput({
                maST: staff.maST || inputStore,
                maNV: staff.maNV,
                imei,
                imageUrls,
                status: "Pending",
                pincode: "",
                rejectReason: "",
                adminReviewer: "",
                completionStatus: "",
                menhGia: "",
                oldModel: modelCu,
                newModel: modelMoi,
                supportType: flow,
              })
            );

            const request = await getPincodeRequestById(duplicate.requestId);

            return {
              success: true,
              recovered: false,
              request,
              message: "Đã cập nhật lại hồ sơ và chuyển về trạng thái chờ duyệt.",
            };
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

        const requestId = makeRequestId();
        await insertRows(
          "pincode_requests",
          [
            {
              request_id: requestId,
              ...dbRequestPatchFromInput({
                createdAt: timestamp,
                maST: staff.maST || inputStore,
                maNV: staff.maNV,
                imei,
                imageUrls,
                status: "Pending",
                pincode: "",
                rejectReason: "",
                adminReviewer: "",
                completionStatus: "",
                menhGia: "",
                oldModel: modelCu,
                newModel: modelMoi,
                supportType: flow,
                sourceRow: String(Date.now()),
              }),
            },
          ],
          { returning: "minimal" }
        );

        const request = await getPincodeRequestById(requestId);

        return {
          success: true,
          recovered: false,
          request,
          message: "Đã gửi hồ sơ thẩm định PMH.",
        };
      });
    } catch (err: any) {
      console.warn("SUPABASE_CREATE_PINCODE_ERROR:", err?.message || err);
      throw err;
    }
  }

  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  if (duplicate) {
    if (duplicate.status === "Rejected_Soft") {
      return enqueuePincodeWrite(async () => {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${REQUEST_SHEET}!B${duplicate.rowNumber}:S${duplicate.rowNumber}`,
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
                modelCu,
                modelMoi,
                flow,
              ],
            ],
          },
        });
        invalidateReadCache(REQUEST_SHEET);

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
      range: `${REQUEST_SHEET}!A:S`,
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
            modelCu,
            modelMoi,
            flow,
          ],
        ],
      },
    });
    invalidateReadCache(REQUEST_SHEET);

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
  if (isSupabaseConfigured()) {
    try {
      return await enqueuePincodeWrite(async () => {
        const rows = await selectAllRows<any>("pmh_codes");
        const existing = new Set(rows.map((row) => clean(row.pincode)).filter(Boolean));
        const current = new Set<string>();
        const duplicates: string[] = [];
        const invalid: string[] = [];
        const appendRows: Array<Record<string, string>> = [];

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
          appendRows.push({
            pincode: pin,
            status: "",
            menh_gia: menhGia,
            request_id: "",
            used_at: "",
            used_by: "",
            source_row: String(Date.now() + appendRows.length),
          });
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
          await insertRows("pmh_codes", appendRows, { returning: "minimal" });
        }

        return {
          success: true,
          imported: appendRows.length,
        };
      });
    } catch (err: any) {
      console.warn("SUPABASE_IMPORT_PINCODES_ERROR:", err?.message || err);
      throw err;
    }
  }

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
      invalidateReadCache(PMH_SHEET);
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
  if (isSupabaseConfigured()) {
    try {
      return await enqueuePincodeWrite(async () => {
        const request = await getPincodeRequestById(data.requestId);
        if (!request) throw new Error("Không tìm thấy hồ sơ cần duyệt.");
        if (request.status !== "Pending") throw new Error(`Hồ sơ đã được xử lý với trạng thái ${request.status}.`);
        assertPincodeClaimOwner(request, data.admin);

        const selectedMenhGia = clean(data.menhGia);
        if (selectedMenhGia && !isPmhMenhGiaMatchFlow(selectedMenhGia, request.flow)) {
          throw new Error(`Mệnh giá "${selectedMenhGia}" không thuộc luồng ${request.flowLabel}.`);
        }

        const pmhRows = await selectAllRows<any>("pmh_codes");
        const candidates = pmhRows
          .map((row) => ({
            pin: clean(row.pincode),
            status: clean(row.status),
            statusFilter: row.status == null ? isNull() : eq(clean(row.status)),
            requestId: clean(row.request_id),
            menhGia: clean(row.menh_gia),
            sourceRow: sourceRowNumber(row.source_row),
            value: getPmhMenhGiaValue(row.menh_gia),
          }))
          .filter((row) => {
            if (!row.pin || isPmhUsedStatus(row.status) || row.requestId) return false;
            if (!isPmhMenhGiaMatchFlow(row.menhGia, request.flow)) return false;
            if (selectedMenhGia && row.menhGia !== selectedMenhGia) return false;
            return true;
          })
          .sort((a, b) => {
            if (!selectedMenhGia && a.value !== b.value) return a.value - b.value;
            if (a.sourceRow !== b.sourceRow) return a.sourceRow - b.sourceRow;
            return a.pin.localeCompare(b.pin, "vi", { numeric: true });
          });

        const selectedPin = candidates[0];
        if (!selectedPin) {
          throw new Error(
            selectedMenhGia
              ? `Hết PMH "${selectedMenhGia}".`
              : `Hết PMH thuộc luồng ${request.flowLabel}. Cần mã có hậu tố ${getPmhFlowSuffix(request.flow)}.`
          );
        }

        const usedAt = nowVN();
        const claimed = await updateRows<any>(
          "pmh_codes",
          { pincode: eq(selectedPin.pin), status: selectedPin.statusFilter },
          {
            status: "Used",
            request_id: request.requestId,
            used_at: usedAt,
            used_by: clean(data.admin),
          }
        );

        if (!Array.isArray(claimed) || claimed.length === 0) {
          throw new Error("Mã PMH vừa được người khác sử dụng, vui lòng thử lại.");
        }

        try {
          await updateDbPincodeRequest(
            request.requestId,
            dbRequestPatchFromInput({
              status: "Approve",
              pincode: selectedPin.pin,
              rejectReason: "",
              adminReviewer: clean(data.admin),
              completionStatus: "",
              menhGia: selectedPin.menhGia,
            })
          );
        } catch (err) {
          await updateRows<any>(
            "pmh_codes",
            { pincode: eq(selectedPin.pin), request_id: eq(request.requestId) },
            {
              status: selectedPin.status,
              request_id: selectedPin.requestId,
              used_at: "",
              used_by: "",
            }
          ).catch((rollbackErr: any) => {
            console.warn("SUPABASE_ROLLBACK_PINCODE_ERROR:", rollbackErr?.message || rollbackErr);
          });
          throw err;
        }

        return {
          success: true,
          pinCode: selectedPin.pin,
          menhGia: selectedPin.menhGia,
          message: `Đã duyệt và cấp PMH ${selectedPin.menhGia}.`,
        };
      });
    } catch (err: any) {
      console.warn("SUPABASE_APPROVE_PINCODE_ERROR:", err?.message || err);
      throw err;
    }
  }

  await ensurePincodeSheets();

  return enqueuePincodeWrite(async () => {
    const request = await getPincodeRequestById(data.requestId);
    if (!request) throw new Error("Không tìm thấy hồ sơ cần duyệt.");
    if (request.status !== "Pending") throw new Error(`Hồ sơ đã được xử lý với trạng thái ${request.status}.`);
    assertPincodeClaimOwner(request, data.admin);

    const pmhRows = await readValues(`${PMH_SHEET}!A2:C`);
    const selectedMenhGia = clean(data.menhGia);
    let pinCode = "";
    let pinRowNumber = -1;
    let actualMenhGia = "";

    if (selectedMenhGia && !isPmhMenhGiaMatchFlow(selectedMenhGia, request.flow)) {
      throw new Error(`Mệnh giá "${selectedMenhGia}" không thuộc luồng ${request.flowLabel}.`);
    }

    const candidates: Array<{ pin: string; rowNumber: number; menhGia: string; value: number }> = [];

    for (let i = 0; i < pmhRows.length; i += 1) {
      const pin = clean(pmhRows[i][0]);
      const status = clean(pmhRows[i][1]);
      const menhGia = clean(pmhRows[i][2]);

      if (!pin || isPmhUsedStatus(status)) continue;
      if (!isPmhMenhGiaMatchFlow(menhGia, request.flow)) continue;
      if (selectedMenhGia && menhGia !== selectedMenhGia) continue;

      candidates.push({
        pin,
        rowNumber: i + 2,
        menhGia,
        value: getPmhMenhGiaValue(menhGia),
      });
    }

    candidates.sort((a, b) => {
      if (!selectedMenhGia && a.value !== b.value) return a.value - b.value;
      return a.rowNumber - b.rowNumber;
    });

    const selectedPin = candidates[0];
    if (selectedPin) {
      pinCode = selectedPin.pin;
      pinRowNumber = selectedPin.rowNumber;
      actualMenhGia = selectedPin.menhGia;
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
            values: [["Approve", pinCode, "", clean(data.admin), "", actualMenhGia]],
          },
        ],
      },
    });
    invalidateReadCache(PMH_SHEET);
    invalidateReadCache(REQUEST_SHEET);

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
  imageSlots?: string[];
}) {
  if (isSupabaseConfigured()) {
    return enqueuePincodeWrite(async () => {
      const request = await getPincodeRequestById(data.requestId);
      if (!request) throw new Error("Không tìm thấy hồ sơ cần từ chối.");
      if (request.status !== "Pending") throw new Error(`Hồ sơ đã được xử lý với trạng thái ${request.status}.`);
      assertPincodeClaimOwner(request, data.admin);

      const status: PincodeStatus = data.soft ? "Rejected_Soft" : "Rejected_Hard";
      const slots = normalizePincodeImageSlots(data.imageSlots, request.flow);
      if (data.soft && slots.length === 0) throw new Error("Vui lòng chọn ít nhất 1 file cần chụp lại.");
      const reasonText = clean(data.reason) || "Admin từ chối hồ sơ.";
      const storedReason = data.soft && slots.length > 0
        ? `[CHUP_LAI_ANH:${slots.join(",")}]\n${reasonText}`
        : reasonText;

      await updateDbPincodeRequest(
        request.requestId,
        dbRequestPatchFromInput({
          status,
          pincode: "",
          rejectReason: storedReason,
          adminReviewer: clean(data.admin),
        })
      );

      return {
        success: true,
        message: data.soft ? "Đã yêu cầu nhân viên cập nhật lại hồ sơ." : "Đã từ chối cấp PMH.",
      };
    });
  }

  await ensurePincodeSheets();

  return enqueuePincodeWrite(async () => {
    const request = await getPincodeRequestById(data.requestId);
    if (!request) throw new Error("Không tìm thấy hồ sơ cần từ chối.");
    if (request.status !== "Pending") throw new Error(`Hồ sơ đã được xử lý với trạng thái ${request.status}.`);
    assertPincodeClaimOwner(request, data.admin);

    const status: PincodeStatus = data.soft ? "Rejected_Soft" : "Rejected_Hard";
    const slots = normalizePincodeImageSlots(data.imageSlots, request.flow);
    if (data.soft && slots.length === 0) throw new Error("Vui lòng chọn ít nhất 1 file cần chụp lại.");
    const reasonText = clean(data.reason) || "Admin từ chối hồ sơ.";
    const storedReason = data.soft && slots.length > 0
      ? `[CHUP_LAI_ANH:${slots.join(",")}]\n${reasonText}`
      : reasonText;
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: `${REQUEST_SHEET}!K${request.rowNumber}:N${request.rowNumber}`,
            values: [[status, "", storedReason, clean(data.admin)]],
          },
        ],
      },
    });
    invalidateReadCache(REQUEST_SHEET);

    return {
      success: true,
      message: data.soft ? "Đã yêu cầu nhân viên cập nhật lại hồ sơ." : "Đã từ chối cấp PMH.",
    };
  });
}

export async function claimPincodeRequest(data: {
  requestId: string;
  admin: string;
}) {
  if (isSupabaseConfigured()) {
    return enqueuePincodeWrite(async () => {
      const request = await getPincodeRequestById(data.requestId);
      if (!request) throw new Error("Khong tim thay ho so can nhan xu ly.");
      if (request.status !== "Pending") throw new Error("Ho so nay da duoc xu ly.");
      if (request.claimedBy && request.claimedBy !== clean(data.admin)) {
        throw new Error(`Ho so da duoc ${request.claimedBy} nhan xu ly.`);
      }

      await updateDbPincodeRequest(
        request.requestId,
        dbRequestPatchFromInput({
          adminReviewer: makeClaimMarker(data.admin),
        })
      );

      return {
        success: true,
        request: await getPincodeRequestById(data.requestId),
        message: "Da nhan xu ly ho so.",
      };
    });
  }

  await ensurePincodeSheets();

  return enqueuePincodeWrite(async () => {
    const request = await getPincodeRequestById(data.requestId);
    if (!request) throw new Error("Khong tim thay ho so can nhan xu ly.");
    if (request.status !== "Pending") throw new Error("Ho so nay da duoc xu ly.");
    if (request.claimedBy && request.claimedBy !== clean(data.admin)) {
      throw new Error(`Ho so da duoc ${request.claimedBy} nhan xu ly.`);
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${REQUEST_SHEET}!N${request.rowNumber}:N${request.rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[makeClaimMarker(data.admin)]] },
    });
    invalidateReadCache(REQUEST_SHEET);

    return {
      success: true,
      request: await getPincodeRequestById(data.requestId),
      message: "Da nhan xu ly ho so.",
    };
  });
}

export async function reopenRejectedPincodeRequest(data: {
  requestId: string;
  admin: string;
}) {
  if (isSupabaseConfigured()) {
    return enqueuePincodeWrite(async () => {
      const request = await getPincodeRequestById(data.requestId);
      if (!request) throw new Error("Khong tim thay ho so can mo lai.");
      if (request.status !== "Rejected_Hard" && request.status !== "Rejected_Soft") {
        throw new Error("Chi mo lai duoc ho so da bi tu choi hoac yeu cau chup lai.");
      }
      if (!request.canReopen) {
        throw new Error("Da qua 5 phut, ho so nay can tao yeu cau moi.");
      }

      await updateDbPincodeRequest(
        request.requestId,
        dbRequestPatchFromInput({
          status: "Pending",
          pincode: "",
          rejectReason: "",
          adminReviewer: "",
          completionStatus: "",
          menhGia: "",
        })
      );

      return {
        success: true,
        request: await getPincodeRequestById(data.requestId),
        message: "Da mo lai ho so ve trang thai cho duyet.",
      };
    });
  }

  await ensurePincodeSheets();

  return enqueuePincodeWrite(async () => {
    const request = await getPincodeRequestById(data.requestId);
    if (!request) throw new Error("Khong tim thay ho so can mo lai.");
    if (request.status !== "Rejected_Hard" && request.status !== "Rejected_Soft") {
      throw new Error("Chi mo lai duoc ho so da bi tu choi hoac yeu cau chup lai.");
    }
    if (!request.canReopen) {
      throw new Error("Da qua 5 phut, ho so nay can tao yeu cau moi.");
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: `${REQUEST_SHEET}!K${request.rowNumber}:P${request.rowNumber}`,
            values: [["Pending", "", "", "", "", ""]],
          },
        ],
      },
    });
    invalidateReadCache(REQUEST_SHEET);

    return {
      success: true,
      request: await getPincodeRequestById(data.requestId),
      message: "Da mo lai ho so ve trang thai cho duyet.",
    };
  });
}

export async function updatePincodeRequestImages(data: {
  requestId: string;
  imageUrls: string[];
}) {
  if (isSupabaseConfigured()) {
    return enqueuePincodeWrite(async () => {
      const request = await getPincodeRequestById(data.requestId);
      if (!request) throw new Error("Không tìm thấy hồ sơ cần cập nhật ảnh.");
      if (request.status !== "Rejected_Soft") throw new Error("Hồ sơ không ở trạng thái yêu cầu chụp lại.");

      const imageUrls = Array.from({ length: 6 }, (_, index) => clean(data.imageUrls[index]));
      const requiredFileCount = request.flow === "ChienGia" ? 5 : 6;
      if (imageUrls.slice(0, requiredFileCount).some((url) => !url)) {
        throw new Error(`Vui lòng bổ sung đủ ${requiredFileCount} file hồ sơ.`);
      }

      await updateDbPincodeRequest(
        request.requestId,
        dbRequestPatchFromInput({
          imageUrls,
          status: "Pending",
          pincode: "",
          rejectReason: "",
          adminReviewer: "",
        })
      );

      return {
        success: true,
        request: await getPincodeRequestById(data.requestId),
        message: "Đã cập nhật ảnh và chuyển hồ sơ về trạng thái chờ duyệt.",
      };
    });
  }

  await ensurePincodeSheets();

  return enqueuePincodeWrite(async () => {
    const request = await getPincodeRequestById(data.requestId);
    if (!request) throw new Error("Không tìm thấy hồ sơ cần cập nhật ảnh.");
    if (request.status !== "Rejected_Soft") throw new Error("Hồ sơ không ở trạng thái yêu cầu chụp lại.");

    const imageUrls = Array.from({ length: 6 }, (_, index) => clean(data.imageUrls[index]));
    const requiredFileCount = request.flow === "ChienGia" ? 5 : 6;
    if (imageUrls.slice(0, requiredFileCount).some((url) => !url)) {
      throw new Error(`Vui lòng bổ sung đủ ${requiredFileCount} file hồ sơ.`);
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: `${REQUEST_SHEET}!E${request.rowNumber}:N${request.rowNumber}`,
            values: [[...imageUrls, "Pending", "", "", ""]],
          },
        ],
      },
    });
    invalidateReadCache(REQUEST_SHEET);

    return {
      success: true,
      request: await getPincodeRequestById(data.requestId),
      message: "Đã cập nhật ảnh và chuyển hồ sơ về trạng thái chờ duyệt.",
    };
  });
}

export async function markPincodeCompleted(requestId: string) {
  if (isSupabaseConfigured()) {
    return enqueuePincodeWrite(async () => {
      const request = await getPincodeRequestById(requestId);
      if (!request) throw new Error("Không tìm thấy hồ sơ.");

      await updateDbPincodeRequest(request.requestId, { completion_status: "Done" });

      return { success: true };
    });
  }

  await ensurePincodeSheets();

  return enqueuePincodeWrite(async () => {
    const request = await getPincodeRequestById(requestId);
    if (!request) throw new Error("Không tìm thấy hồ sơ.");

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
        ],
      },
    });
    invalidateReadCache(REQUEST_SHEET);

    return { success: true };
  });
}

export async function markPincodeSkipped(requestId: string) {
  if (isSupabaseConfigured()) {
    return enqueuePincodeWrite(async () => {
      const request = await getPincodeRequestById(requestId);
      if (!request) throw new Error("Không tìm thấy hồ sơ.");

      await updateDbPincodeRequest(request.requestId, { completion_status: "X" });

      return { success: true };
    });
  }

  await ensurePincodeSheets();

  return enqueuePincodeWrite(async () => {
    const request = await getPincodeRequestById(requestId);
    if (!request) throw new Error("Không tìm thấy hồ sơ.");

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: `${REQUEST_SHEET}!O${request.rowNumber}:O${request.rowNumber}`,
            values: [["X"]],
          },
        ],
      },
    });
    invalidateReadCache(REQUEST_SHEET);

    return { success: true };
  });
}
