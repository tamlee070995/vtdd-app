import "server-only";
import { randomUUID } from "node:crypto";
import { google } from "googleapis";
import { insertRows, isSupabaseConfigured, selectRows, updateRows } from "./supabase-rest";
import { parseTradeinSheets, TradeinDataError, type TradeinData, type TradeinSnapshot } from "./tradein-pricing";

const SNAPSHOT_KEY = "TRADEIN_PUBLIC_SNAPSHOT_V1";

export async function getTradeinSnapshot(): Promise<TradeinSnapshot | null> {
  if (!isSupabaseConfigured()) throw new TradeinDataError("Chưa cấu hình nơi lưu bảng giá.", 503);
  const rows = await selectRows<{ value: string }>("system_settings", { select: "value", filters: { key: `eq.${SNAPSHOT_KEY}` }, limit: 1 });
  if (!rows.length) return null;
  const snapshot = JSON.parse(rows[0].value) as TradeinSnapshot;
  if (snapshot.schemaVersion !== 1 || !snapshot.version || !snapshot.syncedAt || !Array.isArray(snapshot.oldProducts) || !Array.isArray(snapshot.newProducts)) {
    throw new TradeinDataError("Không đọc được bảng giá đã lưu. Vui lòng đồng bộ lại từ Admin.", 503);
  }
  return snapshot;
}
export function publicTradeinData(snapshot: TradeinSnapshot): TradeinData {
  return { version: snapshot.version, syncedAt: snapshot.syncedAt, oldProducts: snapshot.oldProducts, newProducts: snapshot.newProducts };
}
export function tradeinSummary(snapshot: TradeinSnapshot | null) {
  return snapshot ? { version: snapshot.version, syncedAt: snapshot.syncedAt, oldCount: snapshot.oldProducts.length,
    newCount: snapshot.newProducts.length, importedBy: snapshot.importedBy, quality: snapshot.quality } : null;
}
export async function readTradeinSource() {
  if (!process.env.SPREADSHEET_ID || !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new TradeinDataError("Chưa cấu hình kết nối Google Sheet trên máy chủ.", 503);
  }
  const auth = new google.auth.JWT({ email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"), scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId: process.env.SPREADSHEET_ID,
    ranges: ["'Data_Moi'!A1:AZ20002", "'Data_Cu_PhoneMWG'!A1:AZ20002"], valueRenderOption: "UNFORMATTED_VALUE" }, { timeout: 20_000 });
  const ranges = response.data.valueRanges || [];
  return parseTradeinSheets(ranges[0]?.values || [], ranges[1]?.values || []);
}
export async function syncTradeinSource(expectedVersion: string, actor: string) {
  const previous = await getTradeinSnapshot();
  if ((previous?.version || "") !== expectedVersion) throw new TradeinDataError("Bảng giá vừa được đồng bộ ở phiên khác. Vui lòng tải lại trạng thái.", 409);
  // Read and validate both sheets before replacing the single stored snapshot.
  const parsed = await readTradeinSource();
  const snapshot: TradeinSnapshot = { ...parsed, schemaVersion: 1, version: randomUUID(), syncedAt: new Date().toISOString(), importedBy: actor };
  const row = { key: SNAPSHOT_KEY, value: JSON.stringify(snapshot), type: "TEXT", updated_at_text: snapshot.syncedAt, updated_by: actor };
  if (previous) {
    const changed = await updateRows("system_settings", { key: `eq.${SNAPSHOT_KEY}`, value: `like.*"version":"${previous.version}"*` }, row);
    if (changed.length !== 1) throw new TradeinDataError("Bảng giá vừa được đồng bộ ở phiên khác. Vui lòng tải lại trạng thái.", 409);
  } else {
    try { await insertRows("system_settings", [row]); }
    catch (error) {
      if (/23505|duplicate/i.test(String(error))) throw new TradeinDataError("Bảng giá vừa được đồng bộ ở phiên khác. Vui lòng tải lại trạng thái.", 409);
      throw error;
    }
  }
  return snapshot;
}
