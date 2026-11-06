export type AdminSection = "content" | "prices" | "accounts" | "imei" | "system";
export type AdminScreen = "tcdm" | "quy-trinh-thu-cu" | "may-moi" | "may-cu" | "demo" | "people" | "imei" | "tools" | "system";

export const ADMIN_SECTIONS: Array<{ key: AdminSection; label: string; description: string; icon: string; screens: AdminScreen[] }> = [
  { key: "content", label: "Nội dung", description: "Bài viết & hướng dẫn", icon: "▤", screens: ["quy-trinh-thu-cu", "may-moi", "may-cu", "demo"] },
  { key: "prices", label: "Bảng giá", description: "Đồng bộ & đóng/mở", icon: "₫", screens: ["tcdm"] },
  { key: "accounts", label: "Tài khoản", description: "Nhân viên & phân quyền", icon: "♙", screens: ["people"] },
  { key: "imei", label: "Tạo IMEI / SN", description: "Cấp mã & lịch sử", icon: "#", screens: ["imei"] },
];

export const PERSONNEL_ACTIONS = ["staff-manage", "staff-delete", "staff-security"];

// Once explicit actions exist, the old broad people module cannot grant personnel access.
export function effectiveAdminAccessTokens(tokens: string[]) {
  if (!tokens.includes("action:imei-manage-all")) tokens = tokens.filter(token => token !== "action:imei-brand-lock");
  const actions = tokens.filter(token => token.startsWith("action:")).map(token => token.slice(7));
  if (actions.length && !actions.some(action => PERSONNEL_ACTIONS.includes(action))) return tokens.filter(token => token !== "people");
  return tokens;
}

export function removeAdminActionToken(tokens: string[], action: string) {
  const remaining = tokens.filter(token => token !== `action:${action}`);
  if (PERSONNEL_ACTIONS.includes(action) && !remaining.some(token => PERSONNEL_ACTIONS.some(key => token === `action:${key}`))) return remaining.filter(token => token !== "people");
  return effectiveAdminAccessTokens(remaining);
}

export function visibleAdminScreens(role: string, modules: string[], actions: string[]): AdminScreen[] {
  if (role === "admin") return ADMIN_SECTIONS.flatMap(section => section.screens);
  const result: AdminScreen[] = [];
  for (const key of ["quy-trinh-thu-cu", "may-moi", "may-cu", "demo"] as const) if (modules.includes(key)) result.push(key);
  if (modules.includes("tcdm") || actions.some(action => ["settings-write", "reload-data"].includes(action))) result.push("tcdm");
  if ((!actions.length && modules.includes("people")) || actions.some(action => PERSONNEL_ACTIONS.includes(action))) result.push("people");
  if (modules.includes("imei") || actions.some(action => ["imei-create", "imei-cancel-own", "imei-manage-all", "imei-report"].includes(action))) result.push("imei");
  return result;
}
