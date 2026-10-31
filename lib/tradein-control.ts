import { TradeinDataError } from "./tradein-pricing";

export type TradeinSchedule = { lockAt: string | null; reopenAt: string | null };
export type TradeinAccess = { revision: string; locked: boolean; message: string; schedule?: TradeinSchedule };
export type TradeinStatus = { locked: boolean; message: string; priceUpdatedAt: string };
export type TradeinRefreshReason = "prices" | "reopened";
export const TRADEIN_POLL_MS = 30_000;
export const TRADEIN_RELOAD_SECONDS = 7;
export const DEFAULT_TRADEIN_MESSAGE = "Bảng giá đang được cập nhật. Vui lòng quay lại sau ít phút.";
export function defaultTradeinAccess(): TradeinAccess {
  return { revision: "initial", locked: false, message: DEFAULT_TRADEIN_MESSAGE };
}
export function normalizeTradeinAccess(payload: Record<string, unknown>, revision: string): TradeinAccess {
  if (typeof payload.locked !== "boolean" || typeof payload.message !== "string") throw new TradeinDataError("Vui lòng chọn trạng thái và nhập thông báo hợp lệ.");
  const message = payload.message.trim();
  if (!message || message.length > 300) throw new TradeinDataError("Thông báo tạm khóa cần từ 1 đến 300 ký tự.");
  return { revision, locked: payload.locked, message };
}
export function effectiveTradeinAccess(access: TradeinAccess, now = Date.now()): TradeinAccess {
  let locked = access.locked;
  if (access.schedule?.lockAt && now >= Date.parse(access.schedule.lockAt)) locked = true;
  if (access.schedule?.reopenAt && now >= Date.parse(access.schedule.reopenAt)) locked = false;
  return { ...access, locked };
}
export function normalizeTradeinSchedule(payload: Record<string, unknown>, now = Date.now()): TradeinSchedule {
  const readTime = (value: unknown) => {
    if (value === null || value === "") return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value)))
      throw new TradeinDataError("Giờ hẹn chưa hợp lệ. Xin chọn lại ngày và giờ.");
    if (Date.parse(value) <= now) throw new TradeinDataError("Giờ hẹn phải sau giờ hiện tại.");
    return new Date(value).toISOString();
  };
  const lockAt = readTime(payload.lockAt), reopenAt = readTime(payload.reopenAt);
  if (lockAt && reopenAt && Date.parse(reopenAt) <= Date.parse(lockAt)) throw new TradeinDataError("Giờ mở lại phải sau giờ khóa.");
  return { lockAt, reopenAt };
}
// datetime-local is interpreted as Viet Nam time, regardless of the administrator's device zone.
export function tradeinScheduleInput(iso: string | null | undefined): string {
  return iso ? new Date(Date.parse(iso) + 7 * 60 * 60 * 1000).toISOString().slice(0, 16) : "";
}
export function tradeinScheduleIso(local: string): string | null {
  return local ? new Date(local + ":00+07:00").toISOString() : null;
}
export function tradeinRefreshReason(previous: TradeinStatus | null, next: TradeinStatus, loadedAt: string): TradeinRefreshReason | null {
  if (next.locked) return null;
  if (previous?.locked) return "reopened";
  if (loadedAt && next.priceUpdatedAt && next.priceUpdatedAt !== loadedAt) return "prices";
  return null;
}
