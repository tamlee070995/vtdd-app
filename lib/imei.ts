export type ImeiBrand = "samsung" | "xiaomi" | "apple-13-plus" | "apple-other" | "other";
export type ImeiIssue = {
  recipient?: string;
  storeCode?: string;
  requestId: string;
  imei: string | null;
  brand: ImeiBrand;
  actor: string;
  actorName: string;
  createdAt: string;
  status: "active" | "cancelled" | "pending" | "conflict";
  cancelledAt?: string;
  cancelledBy?: string;
  reason?: string;
};

export class ImeiError extends Error {
  constructor(message: string, public status = 400, public code = "IMEI_ERROR") { super(message); }
}

export const IMEI_BRANDS: Record<ImeiBrand, string> = {
  samsung: "Samsung", xiaomi: "Xiaomi", "apple-13-plus": "Apple iPhone 13 trở lên", "apple-other": "Apple iPhone còn lại", other: "Hãng còn lại",
};
export const IMEI_CANCEL_WINDOW_MS = 2 * 60 * 1000;
export const IMEI_CANCEL_CONTACT = "Cần Hủy Mã Liên Hệ Quản Lý: 37804 - Lê Thanh Sang";
export const APPLE_SN_ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function isAppleSerial(brand: unknown) {
  return brand === "apple-13-plus" || brand === "apple-other";
}

export function imeiCodeLength(brand: ImeiBrand) {
  return brand === "apple-13-plus" ? 11 : brand === "apple-other" ? 13 : 15;
}

export function validImeiCode(brand: ImeiBrand, code: string) {
  if (!Object.hasOwn(IMEI_BRANDS, brand)) return false;
  if (isAppleSerial(brand)) return ["SWAP", "S99"].some(prefix => new RegExp(`^${prefix}[0-9A-HJ-NP-Z]{${imeiCodeLength(brand) - prefix.length}}$`).test(code));
  return validImei(code);
}

export function imeiCancelUntil(createdAt: string) {
  return Date.parse(createdAt) + IMEI_CANCEL_WINDOW_MS;
}

export function canCancelImei(item: Pick<ImeiIssue, "status" | "actor" | "createdAt">, actor: string,
  access: { canCancelOwn: boolean; canManageAll: boolean }, now: number) {
  if (item.status !== "active") return false;
  if (access.canManageAll) return true;
  const started = Date.parse(item.createdAt);
  return access.canCancelOwn && item.actor === actor && Number.isFinite(started) && now >= started && now < imeiCancelUntil(item.createdAt);
}

export function imeiPrefix(brand: unknown, actor: string) {
  if (brand === "samsung") return "35399";
  if (brand === "xiaomi") return "86799";
  if (isAppleSerial(brand)) return "SWAP";
  if (brand !== "other") throw new ImeiError("Xin chọn hãng máy.");
  if (!/^\d{1,13}$/.test(actor)) throw new ImeiError("Mã nhân viên phải gồm 1–13 số để chừa chỗ tạo mã và tính Luhn.");
  return actor;
}

export function completeImei(first14: string) {
  if (!/^\d{14}$/.test(first14)) throw new ImeiError("Phải có đúng 14 số trước khi tính Luhn.");
  const sum = [...first14].reduce((total, digit, index) => {
    const value = Number(digit) * (index % 2 ? 2 : 1);
    return total + (value > 9 ? value - 9 : value);
  }, 0);
  return first14 + ((10 - sum % 10) % 10);
}

export function validImei(value: string) {
  return /^\d{15}$/.test(value) && completeImei(value.slice(0, 14)) === value;
}

export function validImeiRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// No legacy module fallback: Mod needs an explicit grant for each write action.
export function imeiAccess(admin: { permission: string; modules?: string[]; actions?: string[] }) {
  const all = admin.permission === "admin";
  const actions = admin.actions || [];
  return {
    canView: all || (admin.modules || []).includes("imei") || actions.some(action => ["imei-create", "imei-cancel-own", "imei-manage-all", "imei-report"].includes(action)),
    canCreate: all || actions.includes("imei-create"),
    canCancelOwn: all || actions.includes("imei-cancel-own"),
    canManageAll: all || actions.includes("imei-manage-all"),
    canReport: all || actions.includes("imei-report") || actions.includes("imei-manage-all"),
  };
}
