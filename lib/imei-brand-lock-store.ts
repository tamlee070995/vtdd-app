import "server-only";
import { randomUUID } from "node:crypto";
import { insertRows, isSupabaseConfigured, selectRows, updateRows } from "@/lib/supabase-rest";
import { IMEI_BRANDS, ImeiError, imeiBrandLockedMessage, type ImeiBrand, type ImeiBrandLocks } from "@/lib/imei";

const KEY = "IMEI_V1_BRAND_LOCKS";
const stale = () => new ImeiError("Tình trạng khóa vừa đổi ở phiên khác. Xin tải lại rồi chọn lại hãng.", 409, "IMEI_LOCKS_CHANGED");

export async function getImeiBrandLocks(): Promise<ImeiBrandLocks> {
  if (!isSupabaseConfigured()) throw new ImeiError("Chưa đọc được tình trạng khóa hãng. Xin thử lại.", 503);
  const rows = await selectRows<{ value: string }>("system_settings", { select: "value", filters: { key: `eq.${KEY}` }, limit: 1 });
  if (!rows.length) return { revision: "initial", lockedBrands: [], updatedAt: "", updatedBy: "" };
  let policy: ImeiBrandLocks;
  try { policy = JSON.parse(rows[0].value); } catch { throw new ImeiError("Chưa đọc được tình trạng khóa hãng. Xin thử lại.", 503); }
  if (!policy || typeof policy.revision !== "string" || !/^[a-zA-Z0-9-]{1,50}$/.test(policy.revision) || !Array.isArray(policy.lockedBrands) ||
      policy.lockedBrands.length > 5 || policy.lockedBrands.some(brand => typeof brand !== "string" || !Object.hasOwn(IMEI_BRANDS, brand)) ||
      typeof policy.updatedAt !== "string" || typeof policy.updatedBy !== "string") {
    throw new ImeiError("Chưa đọc được tình trạng khóa hãng. Xin thử lại.", 503);
  }
  return policy;
}

export async function assertImeiBrandOpen(brand: ImeiBrand) {
  if ((await getImeiBrandLocks()).lockedBrands.includes(brand)) {
    throw new ImeiError(imeiBrandLockedMessage(brand), 403, "IMEI_BRAND_LOCKED");
  }
}

export async function writeImeiBrandLocks(input: Record<string, unknown>, actor: string): Promise<ImeiBrandLocks> {
  if (typeof input.revision !== "string" || !Array.isArray(input.lockedBrands) || input.lockedBrands.length > 5 ||
      input.lockedBrands.some(brand => typeof brand !== "string" || !Object.hasOwn(IMEI_BRANDS, brand))) {
    throw new ImeiError("Xin chọn hãng hợp lệ.");
  }
  const previous = await getImeiBrandLocks();
  if (previous.revision !== input.revision) throw stale();
  const next: ImeiBrandLocks = { revision: randomUUID(), lockedBrands: [...new Set(input.lockedBrands)] as ImeiBrand[], updatedAt: new Date().toISOString(), updatedBy: actor };
  const row = { key: KEY, value: JSON.stringify(next), type: "IMEI_BRAND_LOCKS", updated_at_text: next.updatedAt, updated_by: actor };
  if (previous.revision === "initial") {
    try { await insertRows("system_settings", [row]); }
    catch (error) { if (/23505|duplicate/i.test(String(error))) throw stale(); throw error; }
  } else {
    const changed = await updateRows("system_settings", { key: `eq.${KEY}`, value: `like.*"revision":"${previous.revision}"*` }, row);
    if (changed.length !== 1) throw stale();
  }
  return next;
}
