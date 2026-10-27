export const PORTAL_GROUPS = [
  { id: "he-thu-cu-doi-moi", title: "Thu cũ đổi mới", shortTitle: "Thu cũ", icon: "tradein" },
  { id: "he-may-moi", title: "Hệ máy mới", shortTitle: "Máy mới", icon: "phone" },
  { id: "he-may-cu", title: "Hệ máy cũ", shortTitle: "Máy cũ", icon: "used" },
  { id: "demo", title: "Demo", shortTitle: "Demo", icon: "demo" },
  { id: "cong-cu-ho-tro", title: "Công cụ hỗ trợ", shortTitle: "Công cụ", icon: "tools" },
] as const;

export function portalGroupForPath(path: string) {
  if (path === "/tra-gia-thu-cu" || path === "/sticker-tcdm" || path === "/p/quy-trinh-thu-cu") return PORTAL_GROUPS[0].id;
  if (path === "/p/may-moi") return PORTAL_GROUPS[1].id;
  if (path === "/p/may-cu") return PORTAL_GROUPS[2].id;
  if (path === "/p/demo" || path.startsWith("/p/demo/")) return PORTAL_GROUPS[3].id;
  if (path === "/cong-cu-ho-tro" || path.startsWith("/cong-cu-ho-tro/")) return PORTAL_GROUPS[4].id;
  return null;
}
