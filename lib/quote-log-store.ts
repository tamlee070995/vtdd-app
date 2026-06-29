import { readSheetRange } from "@/lib/sheets";
import { packQuoteClientMeta, parseQuoteClientMeta } from "@/lib/quote-client-meta";
import { deleteRows, insertRows, isSupabaseConfigured, selectAllRows, selectRows } from "@/lib/supabase-rest";

const LOG_SHEET = "Log_search";
const DELETE_CHUNK_SIZE = 200;

export type QuoteLogRow = {
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
  giaXac: number;
  troGiaHang: number;
  troGiaMWG: number;
  tongTien: number;
  khachCanBu: number;
  ip: string;
  userAgent: string;
  deviceLabel: string;
  networkType: string;
};

function inferQuoteLogSource(row: { source?: any; action?: any; maNV?: any; staffName?: any }) {
  const explicitSource = clean(row.source).toLowerCase();
  if (explicitSource === "staff" || explicitSource === "customer") return explicitSource as "staff" | "customer";

  const action = clean(row.action).toUpperCase();
  const maNV = clean(row.maNV).toUpperCase();
  const staffName = clean(row.staffName).toLowerCase();

  if (maNV === "KHACH" || maNV === "CUSTOMER") return "customer";
  if (staffName === "khách hàng" || staffName === "khach hang") return "customer";
  if (/^KH(Á|A)CH\s+TRA\s+GI(Á|A)/i.test(action)) return "customer";

  return "staff";
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function quoteDateKeyFromText(value: unknown) {
  const text = clean(value);
  if (!text) return "";

  const dmy = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const ymd = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (ymd) {
    const [, year, month, day] = ymd;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);

  return "";
}

function normalizeDeleteMode(value: unknown) {
  const mode = clean(value).toLowerCase();
  if (mode === "all") return { kind: "all" as const, days: 0 };

  const match = mode.match(/^oldest-(3|5|7|30)$/);
  if (!match) throw new Error("Tùy chọn xóa log không hợp lệ.");

  return { kind: "oldest-days" as const, days: Number(match[1]) };
}

async function deleteQuoteLogIds(ids: number[]) {
  let deleted = 0;

  for (let index = 0; index < ids.length; index += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + DELETE_CHUNK_SIZE);
    if (!chunk.length) continue;

    await deleteRows("quote_logs", { id: `in.(${chunk.join(",")})` }, { returning: "minimal" });
    deleted += chunk.length;
  }

  return deleted;
}

function isDuplicateKeyError(err: any) {
  const message = clean(err?.message || err);
  return /23505|duplicate key value|violates unique constraint/i.test(message);
}

async function getNextQuoteLogId() {
  const rows = await selectRows<any>("quote_logs", {
    select: "id",
    order: "id.desc",
    limit: 1,
  });
  const maxId = Number(rows?.[0]?.id || 0);
  return Number.isFinite(maxId) ? maxId + 1 : 1;
}

function mapQuoteLogRow(row: unknown[]): QuoteLogRow {
  const clientMeta = parseQuoteClientMeta(row[16]);

  const mapped = {
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
    giaXac: money(row[10]),
    troGiaHang: money(row[11]),
    troGiaMWG: money(row[12]),
    tongTien: money(row[13]),
    khachCanBu: money(row[14]),
    ip: clean(row[15]),
    userAgent: clientMeta.userAgent,
    deviceLabel: clientMeta.deviceLabel,
    networkType: clientMeta.networkType,
  };

  return {
    ...mapped,
    source: inferQuoteLogSource(mapped),
  };
}

function mapDbQuoteLogRow(row: any): QuoteLogRow {
  const clientMeta = parseQuoteClientMeta(row.user_agent);

  const mapped = {
    time: clean(row.time_text),
    action: clean(row.action),
    maNV: clean(row.ma_nv),
    maST: clean(row.ma_st),
    staffName: clean(row.staff_name),
    mode: clean(row.flow),
    spMoi: clean(row.product_new),
    spCu: clean(row.product_old),
    memory: clean(row.storage),
    loai: clean(row.device_type),
    giaXac: money(row.old_price),
    troGiaHang: money(row.subsidy_brand),
    troGiaMWG: money(row.subsidy_mwg),
    tongTien: money(row.customer_total),
    khachCanBu: money(row.customer_need_pay),
    ip: clean(row.ip),
    userAgent: clientMeta.userAgent,
    deviceLabel: clientMeta.deviceLabel,
    networkType: clientMeta.networkType,
  };

  return {
    ...mapped,
    source: inferQuoteLogSource({ ...mapped, source: row.source }),
  };
}

export async function getQuoteLogs(limit = 1000) {
  if (isSupabaseConfigured()) {
    try {
      const rows = await selectAllRows<any>("quote_logs", { order: "id.desc" });
      return rows
        .map(mapDbQuoteLogRow)
        .filter((row) => row.time || row.spCu || row.maNV)
        .slice(0, Math.max(1, limit));
    } catch (err: any) {
      console.warn("SUPABASE_QUOTE_LOGS_ERROR:", err?.message || err);
      throw err;
    }
  }

  let rows: unknown[][] = [];

  try {
    rows = await readSheetRange(`${LOG_SHEET}!A2:Q`);
  } catch {
    rows = [];
  }

  return rows
    .map(mapQuoteLogRow)
    .filter((row) => row.time || row.spCu || row.maNV)
    .reverse()
    .slice(0, Math.max(1, limit));
}

export async function appendQuoteLog(row: QuoteLogRow) {
  if (!isSupabaseConfigured()) return false;

  try {
    const payload = {
      time_text: clean(row.time),
      action: clean(row.action),
      ma_nv: clean(row.maNV),
      ma_st: clean(row.maST),
      staff_name: clean(row.staffName),
      flow: clean(row.mode),
      product_new: clean(row.spMoi),
      product_old: clean(row.spCu),
      storage: clean(row.memory),
      device_type: clean(row.loai),
      old_price: String(money(row.giaXac)),
      subsidy_brand: String(money(row.troGiaHang)),
      subsidy_mwg: String(money(row.troGiaMWG)),
      customer_total: String(money(row.tongTien)),
      customer_need_pay: String(money(row.khachCanBu)),
      ip: clean(row.ip),
      user_agent: packQuoteClientMeta({
        userAgent: row.userAgent,
        deviceLabel: row.deviceLabel,
        networkType: row.networkType,
      }),
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await insertRows(
          "quote_logs",
          [
            {
              id: await getNextQuoteLogId(),
              ...payload,
            },
          ],
          { returning: "minimal" }
        );
        return true;
      } catch (err: any) {
        if (attempt < 4 && isDuplicateKeyError(err)) continue;
        throw err;
      }
    }

    return true;
  } catch (err: any) {
    console.warn("SUPABASE_APPEND_QUOTE_LOG_ERROR:", err?.message || err);
    throw err;
  }
}

export async function getStaffQuoteHistory(maNV: string, limit = 20) {
  const target = clean(maNV);
  const rows = await getQuoteLogs(1000);

  return rows
    .filter((row) => row.maNV === target)
    .slice(0, Math.max(1, Math.min(100, limit)));
}

export async function deleteQuoteLogsByDashboardFilter(
  source: "staff" | "customer",
  modeValue: string
) {
  if (!isSupabaseConfigured()) {
    throw new Error("Chức năng xóa log chỉ hỗ trợ khi dùng Supabase.");
  }

  const mode = normalizeDeleteMode(modeValue);
  const rows = await selectAllRows<any>("quote_logs", { order: "id.asc" });
  const candidates = rows
    .map((row) => {
      const id = Number(row.id);
      const mapped = mapDbQuoteLogRow(row);

      return {
        id,
        source: mapped.source,
        dateKey: quoteDateKeyFromText(mapped.time),
      };
    })
    .filter((row) => Number.isFinite(row.id) && row.id > 0 && row.source === source);

  if (mode.kind === "all") {
    const deleted = await deleteQuoteLogIds(candidates.map((row) => row.id));

    return {
      deleted,
      source,
      mode: modeValue,
      days: [] as string[],
      totalBefore: candidates.length,
    };
  }

  const selectedDays = Array.from(new Set(candidates.map((row) => row.dateKey).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))
    .slice(0, mode.days);
  const selectedDaySet = new Set(selectedDays);
  const targetIds = candidates
    .filter((row) => selectedDaySet.has(row.dateKey))
    .map((row) => row.id);
  const deleted = await deleteQuoteLogIds(targetIds);

  return {
    deleted,
    source,
    mode: modeValue,
    days: selectedDays,
    totalBefore: candidates.length,
  };
}
