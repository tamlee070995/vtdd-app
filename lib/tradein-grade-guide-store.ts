import "server-only";
import { randomUUID } from "node:crypto";
import { insertRows, selectRows, updateRows } from "./supabase-rest";
import { defaultGradeGuide, normalizeGradeGuide, type TradeinGradeGuide } from "./tradein-grade-guide";
import { TradeinDataError } from "./tradein-pricing";

const KEY = "TRADEIN_GRADE_GUIDE_V1";
export async function getTradeinGradeGuide(): Promise<TradeinGradeGuide> {
  const rows = await selectRows<{ value: string }>("system_settings", { select: "value", filters: { key: `eq.${KEY}` }, limit: 1 });
  if (!rows.length) return defaultGradeGuide();
  const raw = JSON.parse(rows[0].value) as Record<string, unknown>;
  if (typeof raw.revision !== "string" || !raw.revision) throw new TradeinDataError("Chưa đọc được định nghĩa phân loại máy.", 503);
  return normalizeGradeGuide(raw, raw.revision);
}
export async function writeTradeinGradeGuide(input: Record<string, unknown>, actor: string) {
  const previous = await getTradeinGradeGuide();
  const conflict = () => new TradeinDataError("Định nghĩa vừa được sửa ở phiên khác. Làm mới thông tin rồi thử lại.", 409);
  if (input.revision !== previous.revision) throw conflict();
  const guide = normalizeGradeGuide(input, randomUUID());
  const row = { key: KEY, value: JSON.stringify(guide), type: "TEXT", updated_at_text: new Date().toISOString(), updated_by: actor };
  if (previous.revision === "initial") {
    try { await insertRows("system_settings", [row]); }
    catch (error) { if (/23505|duplicate/i.test(String(error))) throw conflict(); throw error; }
  } else {
    const changed = await updateRows("system_settings", { key: `eq.${KEY}`, value: `like.*"revision":"${previous.revision}"*` }, row);
    if (changed.length !== 1) throw conflict();
  }
  return guide;
}
