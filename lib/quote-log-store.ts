import { readSheetRange } from "@/lib/sheets";
import { packQuoteClientMeta, parseQuoteClientMeta } from "@/lib/quote-client-meta";
import { insertRows, isSupabaseConfigured, selectAllRows } from "@/lib/supabase-rest";

const LOG_SHEET = "Log_search";

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
    await insertRows(
      "quote_logs",
      [
        {
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
        },
      ],
      { returning: "minimal" }
    );
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
