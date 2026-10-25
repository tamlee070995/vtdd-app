import { TradeinDataError } from "./tradein-pricing";

export type TradeinAccess = { revision: string; locked: boolean; message: string };
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
export function tradeinRefreshReason(previous: TradeinStatus | null, next: TradeinStatus, loadedAt: string): TradeinRefreshReason | null {
  if (next.locked) return null;
  if (previous?.locked) return "reopened";
  if (loadedAt && next.priceUpdatedAt && next.priceUpdatedAt !== loadedAt) return "prices";
  return null;
}
