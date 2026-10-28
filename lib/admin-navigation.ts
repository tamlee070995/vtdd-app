export type AdminSection = "content" | "prices" | "accounts" | "system";
export type AdminScreen = "tcdm" | "quy-trinh-thu-cu" | "may-moi" | "may-cu" | "demo" | "people" | "tools" | "system";

export const ADMIN_SECTIONS: Array<{ key: AdminSection; label: string; description: string; icon: string; screens: AdminScreen[] }> = [
  { key: "content", label: "Nội dung", description: "Bài viết & hướng dẫn", icon: "▤", screens: ["quy-trinh-thu-cu", "may-moi", "may-cu", "demo"] },
  { key: "prices", label: "Bảng giá", description: "Đồng bộ & đóng/mở", icon: "₫", screens: ["tcdm"] },
  { key: "accounts", label: "Tài khoản", description: "Nhân viên & phân quyền", icon: "♙", screens: ["people"] },
];

export function visibleAdminScreens(role: string, modules: string[], actions: string[]): AdminScreen[] {
  if (role === "admin") return ADMIN_SECTIONS.flatMap(section => section.screens);
  const result: AdminScreen[] = [];
  for (const key of ["quy-trinh-thu-cu", "may-moi", "may-cu", "demo"] as const) if (modules.includes(key)) result.push(key);
  if (modules.includes("tcdm") || actions.some(action => ["settings-write", "reload-data"].includes(action))) result.push("tcdm");
  if (modules.includes("people") || actions.some(action => ["staff-manage", "staff-delete", "staff-security"].includes(action))) result.push("people");
  return result;
}
