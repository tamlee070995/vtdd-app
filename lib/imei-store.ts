import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { countRows, insertRows, isSupabaseConfigured, selectRows, updateRows } from "@/lib/supabase-rest";
import { completeImei, imeiPrefix, ImeiError, validImei, validImeiRequestId, type ImeiBrand, type ImeiIssue } from "@/lib/imei";

const PREFIX = "IMEI_V1_";
const REQUEST = PREFIX + "REQUEST_";
const CODE = PREFIX + "CODE_";
type Actor = { maNV: string; name: string };
type Plan = { revision: string; requestId: string; imei: string; brand: ImeiBrand; prefix: string; actor: string; actorName: string; createdAt: string };
type Event = { requestId: string; actor: string; createdAt: string; cancelledAt?: string; cancelledBy?: string; reason?: string; rejected?: boolean };
type Ledger = { revision: string; imei: string; events: Event[] };
type Setting = { key: string; value: string; type: string; updated_at_text: string; updated_by: string };

function ready() {
  if (!isSupabaseConfigured()) throw new ImeiError("Chưa nối được nơi lưu sổ mã.", 503);
}
function requestKey(actor: string, id: string) { return REQUEST + actor + "_" + id.toLowerCase(); }
function row(key: string, data: Plan | Ledger, type: string, actor: string, time = new Date().toISOString()): Setting {
  return { key, value: JSON.stringify(data), type, updated_at_text: time, updated_by: actor };
}
function conflict() { return new ImeiError("Mã vừa được cấp ở lượt khác. Xin bấm tạo mã khác.", 409, "IMEI_COLLISION"); }
function duplicate(error: unknown) { return /23505|duplicate key/i.test(String(error)); }
async function read<T>(key: string): Promise<T | null> {
  const rows = await selectRows<{ value: string }>("system_settings", { select: "value", filters: { key: `eq.${key}` }, limit: 1 });
  return rows.length ? JSON.parse(rows[0].value) as T : null;
}
function parseLedger(value: Ledger | null, imei: string) {
  if (value && (value.imei !== imei || !Array.isArray(value.events) || !value.revision)) throw new ImeiError("Sổ mã chưa đọc được. Xin liên lạc Admin.", 503);
  return value;
}
async function saveLedger(previous: Ledger | null, next: Ledger, actor: string) {
  const active = next.events.some(event => !event.rejected && !event.cancelledAt);
  const record = row(CODE + next.imei, next, active ? "IMEI_ACTIVE" : "IMEI_AVAILABLE", actor);
  if (previous) {
    // One atomic compare-and-swap arbitrates all concurrent claims/cancellations for this code.
    const changed = await updateRows("system_settings", { key: `eq.${record.key}`, value: `like.*"revision":"${previous.revision}"*` }, record);
    return changed.length === 1;
  }
  try { await insertRows("system_settings", [record]); return true; }
  catch (error) { if (duplicate(error)) return false; throw error; }
}
function issue(plan: Plan, ledger: Ledger | null): ImeiIssue {
  const event = ledger?.events.find(event => event.requestId === plan.requestId && event.actor === plan.actor);
  const status = !event ? "pending" : event.rejected ? "conflict" : event.cancelledAt ? "cancelled" : "active";
  return { requestId: plan.requestId, imei: status === "pending" || status === "conflict" ? null : plan.imei,
    brand: plan.brand, actor: plan.actor, actorName: plan.actorName, createdAt: plan.createdAt, status,
    ...(event?.cancelledAt ? { cancelledAt: event.cancelledAt, cancelledBy: event.cancelledBy, reason: event.reason } : {}) };
}
function randomCode(prefix: string) {
  let digits = prefix;
  while (digits.length < 14) digits += randomInt(10);
  return completeImei(digits);
}
async function candidate(prefix: string) {
  const available = await selectRows<Setting>("system_settings", { select: "key,value", filters: { key: `like.${CODE}${prefix}*`, type: "eq.IMEI_AVAILABLE" }, order: "updated_at_text.asc,key.asc", limit: 1 });
  if (available.length) {
    const imei = available[0].key.slice(CODE.length);
    const ledger = parseLedger(JSON.parse(available[0].value), imei);
    if (validImei(imei) && !ledger!.events.some(event => !event.rejected && !event.cancelledAt)) return imei;
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    const imei = randomCode(prefix);
    const ledger = parseLedger(await read<Ledger>(CODE + imei), imei);
    if (!ledger || !ledger.events.some(event => !event.rejected && !event.cancelledAt)) return imei;
  }
  throw new ImeiError("Dãy số này đang đầy hoặc có nhiều người tạo cùng lúc. Xin thử lại.", 409, "IMEI_COLLISION");
}

export async function generateImei(brand: unknown, requestId: unknown, actor: Actor) {
  ready();
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(actor.maNV)) throw new ImeiError("Mã tài khoản chưa dùng được với sổ mã này.");
  if (!validImeiRequestId(requestId)) throw new ImeiError("Mã lượt tạo chưa đúng. Xin tải lại trang.");
  const id = requestId.toLowerCase(), prefix = imeiPrefix(brand, actor.maNV), key = requestKey(actor.maNV, id);
  let plan = await read<Plan>(key);
  if (!plan) {
    const next: Plan = { revision: randomUUID(), requestId: id, imei: await candidate(prefix), brand: brand as ImeiBrand, prefix, actor: actor.maNV, actorName: actor.name, createdAt: new Date().toISOString() };
    try { await insertRows("system_settings", [row(key, next, "IMEI_REQUEST", actor.maNV, next.createdAt)]); plan = next; }
    catch (error) { if (!duplicate(error)) throw error; plan = await read<Plan>(key); }
  }
  if (!plan || plan.actor !== actor.maNV || plan.brand !== brand || plan.prefix !== prefix || !validImei(plan.imei)) throw new ImeiError("Lượt tạo này không khớp. Xin tải lại lịch sử.", 409);
  // The persisted candidate NEVER changes for a request, including after network failures.
  // This avoids a second allocation if an earlier response was lost.
  for (let attempt = 0; attempt < 16; attempt++) {
    const previous = parseLedger(await read<Ledger>(CODE + plan.imei), plan.imei);
    const existing = previous?.events.find(event => event.requestId === id && event.actor === actor.maNV);
    if (existing) { if (existing.rejected) throw conflict(); return issue(plan, previous); }
    const busy = previous?.events.some(event => !event.rejected && !event.cancelledAt) || false;
    const event: Event = { requestId: id, actor: actor.maNV, createdAt: plan.createdAt, ...(busy ? { rejected: true } : {}) };
    const next: Ledger = { revision: randomUUID(), imei: plan.imei, events: [...(previous?.events || []), event] };
    if (await saveLedger(previous, next, actor.maNV)) {
      // Persist a collision outcome too: retrying this old request must never allocate later.
      if (busy) throw conflict();
      return issue(plan, next);
    }
  }
  throw new ImeiError("Có nhiều lượt xử lý cùng lúc. Xin thử lại đúng lượt này.", 409);
}

export async function cancelImei(input: { requestId?: unknown; actor?: unknown; reason?: unknown }, by: Actor, access: { canCancelOwn: boolean; canManageAll: boolean }) {
  ready();
  if (!validImeiRequestId(input.requestId) || typeof input.actor !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/.test(input.actor)) throw new ImeiError("Lượt cấp mã chưa đúng.");
  if (!access.canManageAll && (!access.canCancelOwn || input.actor !== by.maNV)) throw new ImeiError("Bạn chưa được cấp quyền hủy mã này.", 403);
  if (typeof input.reason !== "string" || !input.reason.trim() || input.reason.trim().length > 300) throw new ImeiError("Xin ghi lý do hủy, tối đa 300 chữ.");
  const plan = await read<Plan>(requestKey(input.actor, input.requestId));
  if (!plan) throw new ImeiError("Không tìm thấy lượt cấp mã.", 404);
  for (let attempt = 0; attempt < 16; attempt++) {
    const previous = parseLedger(await read<Ledger>(CODE + plan.imei), plan.imei);
    const event = previous?.events.find(event => event.requestId === plan.requestId && event.actor === plan.actor);
    if (!previous || !event || event.rejected) throw new ImeiError("Lượt này chưa có mã để hủy.", 409);
    if (event.cancelledAt) return issue(plan, previous);
    const next = { ...previous, revision: randomUUID(), events: previous.events.map(item => item === event ? { ...item, cancelledAt: new Date().toISOString(), cancelledBy: by.maNV, reason: input.reason!.toString().trim() } : item) };
    if (await saveLedger(previous, next, by.maNV)) return issue(plan, next);
  }
  throw new ImeiError("Sổ mã vừa đổi. Xin tải lại lịch sử rồi thử lại.", 409);
}

export async function listImei(actor: string, canManageAll: boolean, pageInput: unknown, queryInput: unknown) {
  ready();
  const page = Math.max(1, Math.min(100000, Math.floor(Number(pageInput) || 1))), pageSize = 20;
  const query = String(queryInput || "").trim();
  if (query && !/^\d{15}$/.test(query)) throw new ImeiError("Xin nhập đủ 15 số để tìm mã.");
  const filters: Record<string, string> = { key: `like.${REQUEST}*`, ...(!canManageAll ? { updated_by: `eq.${actor}` } : {}), ...(query ? { value: `like.*"imei":"${query}"*` } : {}) };
  const [plans, total] = await Promise.all([
    selectRows<Setting>("system_settings", { select: "value", filters, order: "updated_at_text.desc,key.desc", limit: pageSize, offset: (page - 1) * pageSize }),
    countRows("system_settings", filters),
  ]);
  const parsed = plans.map(record => JSON.parse(record.value) as Plan);
  const ledgers = new Map<string, Promise<Ledger | null>>();
  const items = await Promise.all(parsed.map(async plan => {
    if (!ledgers.has(plan.imei)) ledgers.set(plan.imei, read<Ledger>(CODE + plan.imei));
    return issue(plan, parseLedger(await ledgers.get(plan.imei)!, plan.imei));
  }));
  return { items, page, pages: Math.max(1, Math.ceil(total / pageSize)), total };
}
