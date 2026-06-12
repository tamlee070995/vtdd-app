import { readSheetRange } from "@/lib/sheets";

const LOG_SHEET = "Log_search";

export type QuoteLogRow = {
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
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function mapQuoteLogRow(row: unknown[]): QuoteLogRow {
  return {
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
    userAgent: clean(row[16]),
  };
}

export async function getQuoteLogs(limit = 1000) {
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

export async function getStaffQuoteHistory(maNV: string, limit = 20) {
  const target = clean(maNV);
  const rows = await getQuoteLogs(1000);

  return rows
    .filter((row) => row.maNV === target)
    .slice(0, Math.max(1, Math.min(100, limit)));
}
