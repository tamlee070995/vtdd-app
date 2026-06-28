import { deleteRows, eq, insertRows, isSupabaseConfigured, selectAllRows, selectRows, updateRows } from "@/lib/supabase-rest";

export const CHECKIN_TABLE = "checkin_customers";
export const CHECKIN_TABLE_MISSING_MESSAGE =
  "Chưa có dữ liệu Check-in. Admin cần tạo bảng checkin_customers hoặc import danh sách khách trước khi sử dụng.";

const CHECKIN_FALLBACK_SETTING_KEY = "CHECKIN_CUSTOMERS_DATA";

export type CheckinCustomer = {
  id: string;
  stt: number | null;
  sdt: string;
  tenKH: string;
  maSO: string;
  checkedIn: boolean;
  checkinTime: string;
  checkinAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CheckinDashboard = {
  total: number;
  checkedIn: number;
  waiting: number;
  firstCheckin: string;
  latestCheckin: string;
};

const CSV_HEADERS = ["STT", "SDT", "TenKH", "MaSO", "ThoiGianCheckIn"];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeSearch(value: unknown) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizePhone(value: unknown) {
  return clean(value).replace(/[^\d+]/g, "");
}

function getCell(row: Record<string, unknown>, keys: string[]) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizeSearch(key).replace(/[^a-z0-9]/g, ""), value])
  );

  for (const key of keys) {
    const value = normalized.get(normalizeSearch(key).replace(/[^a-z0-9]/g, ""));
    if (typeof value !== "undefined") return value;
  }

  return "";
}

function asNullableNumber(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function mapDbRow(row: any): CheckinCustomer {
  return {
    id: clean(row.id),
    stt: asNullableNumber(row.stt),
    sdt: clean(row.sdt),
    tenKH: clean(row.ten_kh),
    maSO: clean(row.ma_so),
    checkedIn: row.checked_in === true || clean(row.checked_in) === "true" || clean(row.checkin_time) !== "",
    checkinTime: clean(row.checkin_time),
    checkinAt: clean(row.checkin_at),
    createdAt: clean(row.created_at),
    updatedAt: clean(row.updated_at),
  };
}

function mapStoredRow(row: any, index = 0): CheckinCustomer {
  const id = clean(row.id) || `checkin-${Date.now()}-${index + 1}`;
  const checkinTime = clean(row.checkinTime ?? row.checkin_time);

  return {
    id,
    stt: asNullableNumber(row.stt),
    sdt: normalizePhone(row.sdt),
    tenKH: clean(row.tenKH ?? row.ten_kh),
    maSO: clean(row.maSO ?? row.ma_so),
    checkedIn: row.checkedIn === true || row.checked_in === true || checkinTime !== "",
    checkinTime,
    checkinAt: clean(row.checkinAt ?? row.checkin_at),
    createdAt: clean(row.createdAt ?? row.created_at),
    updatedAt: clean(row.updatedAt ?? row.updated_at),
  };
}

function toDbRow(row: Partial<CheckinCustomer>) {
  return {
    stt: row.stt || null,
    sdt: normalizePhone(row.sdt),
    ten_kh: clean(row.tenKH),
    ma_so: clean(row.maSO),
    checked_in: Boolean(row.checkedIn),
    checkin_time: clean(row.checkinTime),
    checkin_at: clean(row.checkinAt) || null,
  };
}

function toStoredRow(row: CheckinCustomer) {
  return {
    id: row.id,
    stt: row.stt,
    sdt: row.sdt,
    tenKH: row.tenKH,
    maSO: row.maSO,
    checkedIn: row.checkedIn,
    checkinTime: row.checkinTime,
    checkinAt: row.checkinAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assertSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase để dùng công cụ Check-in.");
  }
}

export function isCheckinTableMissingError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error || "");
  return (
    text.includes("PGRST205") ||
    (/checkin_customers/i.test(text) && /schema cache|could not find|not found|does not exist/i.test(text))
  );
}

export function normalizeCheckinErrorMessage(error: unknown, fallback: string) {
  if (isCheckinTableMissingError(error)) return CHECKIN_TABLE_MISSING_MESSAGE;

  const text = error instanceof Error ? error.message : String(error || "");
  if (!text) return fallback;

  try {
    const parsed = JSON.parse(text);
    return parsed?.message || parsed?.details || fallback;
  } catch {
    return text;
  }
}

export function formatVietnamDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "00";
  return `${value("day")}/${value("month")}/${value("year")} ${value("hour")}:${value("minute")}:${value("second")}`;
}

function parseVietnamDateTime(value: unknown) {
  const raw = clean(value);
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return "";

  const date = new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0)
  );

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function parseCsvLine(line: string, delimiter = ",") {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseCheckinCsv(csvText: string) {
  const lines = clean(csvText)
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const delimiter = lines[0].includes(";") && !lines[0].includes(",") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  const headers = parseCsvLine(lines[0], delimiter);
  return lines
    .slice(1)
    .map((line) => {
      const cells = parseCsvLine(line, delimiter);
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
    })
    .map((row) => {
      const checkinTime = clean(getCell(row, ["ThoiGianCheckIn", "Thời gian check-in", "CheckInTime", "Time"]));
      return {
        stt: Number(getCell(row, ["STT"])) || null,
        sdt: normalizePhone(getCell(row, ["SDT", "SĐT", "SoDienThoai", "Số điện thoại"])),
        tenKH: clean(getCell(row, ["TenKH", "Tên KH", "Ten Khach Hang", "Tên khách hàng"])),
        maSO: clean(getCell(row, ["MaSO", "Mã SO", "MaSo", "Mã số"])),
        checkedIn: Boolean(checkinTime),
        checkinTime,
        checkinAt: parseVietnamDateTime(checkinTime),
      } satisfies Partial<CheckinCustomer>;
    })
    .filter((row) => row.sdt || row.tenKH || row.maSO);
}

async function getTableRows() {
  return (await selectAllRows<any>(CHECKIN_TABLE, { order: "id.asc" })).map(mapDbRow);
}

async function getFallbackRows() {
  const rows = await selectRows<any>("system_settings", {
    select: "value",
    filters: { key: eq(CHECKIN_FALLBACK_SETTING_KEY) },
    limit: 1,
  });
  const rawValue = clean(rows?.[0]?.value);
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    const list: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : [];
    return list.map(mapStoredRow).filter((row) => row.sdt || row.tenKH || row.maSO);
  } catch {
    return [];
  }
}

async function saveFallbackRows(rows: CheckinCustomer[]) {
  const now = new Date();
  await insertRows(
    "system_settings",
    [
      {
        key: CHECKIN_FALLBACK_SETTING_KEY,
        value: JSON.stringify({
          rows: rows.map(toStoredRow),
          updatedAt: now.toISOString(),
        }),
        type: "json",
        updated_at_text: formatVietnamDateTime(now),
        updated_by: "Check-in",
      },
    ],
    { onConflict: "key", returning: "minimal" }
  );
}

async function getStoreRows() {
  try {
    return { rows: await getTableRows(), tableMissing: false };
  } catch (error) {
    if (!isCheckinTableMissingError(error)) throw error;
    return { rows: await getFallbackRows(), tableMissing: true };
  }
}

function recalculateRows(rows: CheckinCustomer[]) {
  const checked = rows
    .filter((row) => row.checkedIn)
    .sort((a, b) => {
      const left = Date.parse(a.checkinAt) || 0;
      const right = Date.parse(b.checkinAt) || 0;
      if (left !== right) return left - right;
      return Number(a.id || 0) - Number(b.id || 0);
    });

  return rows.map((row) => {
    const index = checked.findIndex((item) => item.id === row.id);
    return { ...row, stt: index >= 0 ? index + 1 : null };
  });
}

function filterAndSortRows(rows: CheckinCustomer[], options: { query?: string; limit?: number } = {}) {
  const query = normalizeSearch(options.query);
  const limit = Math.max(1, Math.min(Number(options.limit || 100), 1000));

  return rows
    .filter((row) => {
      if (!query) return true;
      const haystack = normalizeSearch(`${row.sdt} ${row.tenKH} ${row.maSO}`);
      return haystack.includes(query);
    })
    .sort((a, b) => {
      if (a.checkedIn !== b.checkedIn) return a.checkedIn ? -1 : 1;
      if (a.checkedIn && b.checkedIn) return (a.stt || 999999) - (b.stt || 999999);
      return a.tenKH.localeCompare(b.tenKH, "vi", { numeric: true });
    })
    .slice(0, limit);
}

export async function getCheckinCustomers(options: { query?: string; limit?: number } = {}) {
  assertSupabase();
  const { rows } = await getStoreRows();
  return filterAndSortRows(rows, options);
}

export async function getCheckinCustomersResult(options: { query?: string; limit?: number } = {}) {
  assertSupabase();
  const state = await getStoreRows();

  return {
    customers: filterAndSortRows(state.rows, options),
    tableMissing: state.tableMissing,
    total: state.rows.length,
  };
}

export async function getCheckinDashboard() {
  assertSupabase();

  const state = await getStoreRows();
  const rows = recalculateRows(state.rows);
  const checked = rows
    .filter((row) => row.checkedIn)
    .sort((a, b) => (a.stt || 999999) - (b.stt || 999999));

  return {
    rows,
    tableMissing: state.tableMissing,
    dashboard: {
      total: rows.length,
      checkedIn: checked.length,
      waiting: rows.length - checked.length,
      firstCheckin: checked[0]?.checkinTime || "",
      latestCheckin: checked[checked.length - 1]?.checkinTime || "",
    } satisfies CheckinDashboard,
  };
}

async function recalculateCheckinOrder() {
  const rows = recalculateRows(await getTableRows());

  await Promise.all(
    rows.map((row) =>
      updateRows(CHECKIN_TABLE, { id: eq(row.id) }, { stt: row.stt }, { returning: "minimal" })
    )
  );
}

export async function setCustomerCheckin(id: string, checkedIn: boolean) {
  assertSupabase();

  const targetId = clean(id);
  if (!targetId) throw new Error("Thiếu khách hàng cần check-in.");

  const now = new Date();
  const patch = checkedIn
    ? {
        checked_in: true,
        checkin_time: formatVietnamDateTime(now),
        checkin_at: now.toISOString(),
        updated_at: now.toISOString(),
      }
    : {
        checked_in: false,
        checkin_time: "",
        checkin_at: null,
        stt: null,
        updated_at: now.toISOString(),
      };

  try {
    const updated = await updateRows<any>(CHECKIN_TABLE, { id: eq(targetId) }, patch);
    if (!updated?.[0]) throw new Error("Không tìm thấy khách hàng để cập nhật check-in.");

    await recalculateCheckinOrder();
    const rows = await getCheckinCustomers({ limit: 1000 });
    return rows.find((row) => row.id === targetId) || mapDbRow(updated[0]);
  } catch (error) {
    if (!isCheckinTableMissingError(error)) throw error;

    const rows = await getFallbackRows();
    let found = false;
    const nextRows = recalculateRows(
      rows.map((row) => {
        if (row.id !== targetId) return row;
        found = true;
        return checkedIn
          ? {
              ...row,
              checkedIn: true,
              checkinTime: formatVietnamDateTime(now),
              checkinAt: now.toISOString(),
              updatedAt: now.toISOString(),
            }
          : {
              ...row,
              stt: null,
              checkedIn: false,
              checkinTime: "",
              checkinAt: "",
              updatedAt: now.toISOString(),
            };
      })
    );

    if (!found) throw new Error("Không tìm thấy khách hàng để cập nhật check-in.");
    await saveFallbackRows(nextRows);
    return nextRows.find((row) => row.id === targetId)!;
  }
}

function makeRowsForImport(rows: Partial<CheckinCustomer>[], startId = 0) {
  const now = new Date().toISOString();
  return recalculateRows(
    rows.map((row, index) => {
      const id = startId > 0 ? String(startId + index) : `checkin-${Date.now()}-${index + 1}`;
      return {
        id,
        stt: row.stt || null,
        sdt: normalizePhone(row.sdt),
        tenKH: clean(row.tenKH),
        maSO: clean(row.maSO),
        checkedIn: Boolean(row.checkedIn),
        checkinTime: clean(row.checkinTime),
        checkinAt: clean(row.checkinAt),
        createdAt: now,
        updatedAt: now,
      };
    })
  );
}

export async function importCheckinCustomers(csvText: string, options: { replace?: boolean } = {}) {
  assertSupabase();

  const rows = parseCheckinCsv(csvText);
  if (rows.length === 0) throw new Error("File CSV Check-in không có dòng hợp lệ.");

  try {
    let maxId = 0;
    if (!options.replace) {
      const currentRows = await getTableRows();
      maxId = currentRows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
    }

    if (options.replace) {
      await deleteRows(CHECKIN_TABLE, { id: "gte.0" }, { returning: "minimal" });
    }

    const now = new Date().toISOString();
    const tableRows = makeRowsForImport(rows, maxId + 1);
    const inserted = await insertRows<any>(
      CHECKIN_TABLE,
      tableRows.map((row) => ({
        id: Number(row.id),
        ...toDbRow(row),
        created_at: now,
        updated_at: now,
      })),
      { returning: "representation" }
    );

    await recalculateCheckinOrder();

    return {
      imported: inserted.length,
      total: rows.length,
      storage: "table",
    };
  } catch (error) {
    if (!isCheckinTableMissingError(error)) throw error;

    const currentRows = options.replace ? [] : await getFallbackRows();
    const importedRows = makeRowsForImport(rows);
    const nextRows = recalculateRows([...currentRows, ...importedRows]);
    await saveFallbackRows(nextRows);

    return {
      imported: importedRows.length,
      total: rows.length,
      storage: "settings",
    };
  }
}

function csvEscape(value: unknown) {
  const text = clean(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function exportCheckinCsv() {
  const { rows } = await getCheckinDashboard();
  const body = [
    CSV_HEADERS.join(","),
    ...rows.map((row) =>
      [row.stt || "", row.sdt, row.tenKH, row.maSO, row.checkinTime].map(csvEscape).join(",")
    ),
  ].join("\n");

  return {
    fileName: `checkin-customers-${new Date().toISOString().slice(0, 10)}.csv`,
    body,
  };
}
