import "server-only";
import { randomUUID } from "node:crypto";
import { insertRows, isSupabaseConfigured, selectRows, updateRows } from "./supabase-rest";
import { defaultTradeinAccess, normalizeTradeinAccess, type TradeinAccess, type TradeinStatus } from "./tradein-control";
import { TradeinDataError } from "./tradein-pricing";

const CONTROL_KEY = "TRADEIN_PUBLIC_CONTROL_V1";
function requireStorage() {
  if (!isSupabaseConfigured()) throw new TradeinDataError("Chưa cấu hình nơi lưu trạng thái tra giá.", 503);
}
export async function getTradeinAccess(): Promise<TradeinAccess> {
  requireStorage();
  const rows = await selectRows<{ value: string }>("system_settings", { select: "value", filters: { key: `eq.${CONTROL_KEY}` }, limit: 1 });
  if (!rows.length) return defaultTradeinAccess();
  const value = JSON.parse(rows[0].value) as TradeinAccess;
  if (!value.revision || typeof value.locked !== "boolean" || typeof value.message !== "string") throw new TradeinDataError("Không đọc được trạng thái trang tra giá.", 503);
  return value;
}
export async function getPublicTradeinStatus(): Promise<TradeinStatus> {
  requireStorage();
  const [access, metadata] = await Promise.all([
    getTradeinAccess(),
    // Read only the timestamp. A status check must never download the full price snapshot.
    selectRows<{ updated_at_text: string }>("system_settings", { select: "updated_at_text", filters: { key: "eq.TRADEIN_PUBLIC_SNAPSHOT_V1" }, limit: 1 }),
  ]);
  return { locked: access.locked, message: access.locked ? access.message : "", priceUpdatedAt: metadata[0]?.updated_at_text || "" };
}
export async function writeTradeinAccess(payload: Record<string, unknown>, actor: string) {
  const previous = await getTradeinAccess();
  if (payload.revision !== previous.revision) throw new TradeinDataError("Trạng thái vừa đổi ở phiên khác. Bấm “Làm mới thông tin” rồi thử lại.", 409);
  const access = normalizeTradeinAccess(payload, randomUUID());
  const row = { key: CONTROL_KEY, value: JSON.stringify(access), type: "TEXT", updated_at_text: new Date().toISOString(), updated_by: actor };
  if (previous.revision === "initial") {
    try { await insertRows("system_settings", [row]); }
    catch (error) {
      if (/23505|duplicate/i.test(String(error))) throw new TradeinDataError("Trạng thái vừa đổi ở phiên khác. Bấm “Làm mới thông tin” rồi thử lại.", 409);
      throw error;
    }
  } else {
    const changed = await updateRows("system_settings", { key: `eq.${CONTROL_KEY}`, value: `like.*"revision":"${previous.revision}"*` }, row);
    if (changed.length !== 1) throw new TradeinDataError("Trạng thái vừa đổi ở phiên khác. Bấm “Làm mới thông tin” rồi thử lại.", 409);
  }
  return access;
}
