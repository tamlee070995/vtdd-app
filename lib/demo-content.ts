import { sanitizeHtml } from "./html-sanitize";

export type DemoFeatures = { text: boolean; images: boolean; video: boolean; files: boolean };
export type DemoMedia = { url: string; label: string };
export type DemoGuide = {
  name: string;
  title: string;
  summary: string;
  body: string;
  features: DemoFeatures;
  images: DemoMedia[];
  videoUrl: string;
  files: DemoMedia[];
};
export type DemoBrand = {
  id: string;
  slug: string;
  draft: DemoGuide;
  published: DemoGuide | null;
  visible: boolean;
  order: number;
  revision: string;
  updatedAt: string;
  publishedAt: string;
};
export class DemoContentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
function limited(value: unknown, max: number, label: string) {
  const result = text(value);
  if (result.length > max) throw new DemoContentError(`${label} tối đa ${max} ký tự.`);
  return result;
}
export function demoSlug(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).replace(/-$/, "") || "hang";
}
export function demoUrl(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  if (raw.length > 2000 || /[\s\\\u0000-\u001f\u007f]/.test(raw)) throw new DemoContentError("Liên kết không hợp lệ.");
  if (/^\/uploads\/[a-zA-Z0-9_./%-]+$/.test(raw) && !raw.includes("..")) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw new DemoContentError("Vui lòng dùng liên kết HTTPS hợp lệ."); }
}
export function demoVideoEmbed(value: string): string {
  if (!value) return "";
  let url: URL;
  try { url = new URL(value); } catch { return ""; }
  const host = url.hostname.toLowerCase();
  let id = "";
  if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
    id = url.pathname === "/watch" ? url.searchParams.get("v") || "" : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)\/?$/)?.[1] || "";
  } else if (host === "youtu.be") id = url.pathname.slice(1);
  if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
    const vimeoId = url.pathname.match(/^\/(?:video\/)?(\d+)\/?$/)?.[1];
    if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
  }
  return "";
}
function mediaList(value: unknown, max: number, label: string): DemoMedia[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) throw new DemoContentError(`${label} tối đa ${max} mục.`);
  return value.map(item => {
    if (!item || typeof item !== "object") throw new DemoContentError(`${label} không hợp lệ.`);
    const url = demoUrl(item.url);
    if (!url) throw new DemoContentError(`${label} cần có liên kết.`);
    return { url, label: limited(item.label, 160, "Tên / chú thích") };
  });
}
export function normalizeDemoGuide(value: unknown): DemoGuide {
  if (!value || typeof value !== "object") throw new DemoContentError("Nội dung hướng dẫn không hợp lệ.");
  const data = value as Record<string, unknown>;
  const name = limited(data.name, 60, "Tên hãng");
  const title = limited(data.title, 160, "Tiêu đề");
  if (!name || !title) throw new DemoContentError("Vui lòng nhập tên hãng và tiêu đề trang.");
  const rawBody = limited(data.body, 30000, "Nội dung");
  if (/src\s*=\s*["'](?:blob:|data:)/i.test(rawBody)) throw new DemoContentError("Ảnh chưa tải lên xong. Vui lòng chờ rồi lưu lại.");
  const flags = data.features && typeof data.features === "object" ? data.features as Record<string, unknown> : {};
  const videoUrl = demoUrl(data.videoUrl);
  if (videoUrl && !demoVideoEmbed(videoUrl) && !/\.(mp4|webm|ogg)(?:[?#]|$)/i.test(videoUrl)) {
    throw new DemoContentError("Video cần là liên kết YouTube, Vimeo hoặc tệp MP4 / WebM / OGG.");
  }
  return {
    name, title, summary: limited(data.summary, 400, "Mô tả"), body: sanitizeHtml(rawBody),
    features: { text: flags.text !== false, images: flags.images !== false, video: flags.video === true, files: flags.files === true },
    images: mediaList(data.images, 20, "Ảnh"), videoUrl, files: mediaList(data.files, 15, "Tệp đính kèm"),
  };
}
export function emptyDemoGuide(name: string): DemoGuide {
  return { name, title: `Hướng dẫn gỡ Demo ${name}`, summary: `Hướng dẫn dành cho máy trưng bày ${name}.`, body: "",
    features: { text: true, images: true, video: false, files: false }, images: [], videoUrl: "", files: [] };
}
export function defaultDemoBrands(): DemoBrand[] {
  return ["OPPO", "VIVO", "REALME", "HONOR"].map((name, index) => ({
    id: name.toLowerCase(), slug: name.toLowerCase(), draft: emptyDemoGuide(name), published: emptyDemoGuide(name),
    visible: true, order: (index + 1) * 10, revision: "initial", updatedAt: "", publishedAt: "",
  }));
}
export function demoGuideHtml(guide: DemoGuide) {
  if (!guide.features.text) return "";
  const body = sanitizeHtml(guide.body);
  return guide.features.images ? body : body.replace(/<img\b[^>]*>/gi, "");
}
export function hasDemoContent(guide: DemoGuide) {
  const body = demoGuideHtml(guide);
  return Boolean(body.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim() || /<img\b/.test(body)
    || (guide.features.images && guide.images.length) || (guide.features.video && guide.videoUrl) || (guide.features.files && guide.files.length));
}

export function changeDemoBrand(current: DemoBrand, payload: Record<string, unknown>, revision: string, now: string): DemoBrand {
  if (payload.revision !== current.revision) throw new DemoContentError("Nội dung đã được cập nhật ở phiên khác. Vui lòng tải lại danh sách.", 409);
  const next = structuredClone(current);
  switch (payload.action) {
    case "SAVE_DRAFT":
    case "PUBLISH":
      next.draft = normalizeDemoGuide(payload.guide);
      if (payload.action === "PUBLISH") {
        next.published = structuredClone(next.draft);
        next.publishedAt = now;
      }
      break;
    case "UNPUBLISH": next.published = null; break;
    case "SET_VISIBILITY":
      if (typeof payload.visible !== "boolean") throw new DemoContentError("Trạng thái hiển thị không hợp lệ.");
      next.visible = payload.visible;
      break;
    case "SET_ORDER":
      if (typeof payload.order !== "number" || !Number.isInteger(payload.order) || payload.order < 0 || payload.order > 9999) throw new DemoContentError("Thứ tự phải từ 0 đến 9999.");
      next.order = payload.order;
      break;
    default: throw new DemoContentError("Thao tác không hợp lệ.");
  }
  next.revision = revision;
  next.updatedAt = now;
  if (JSON.stringify(next).length > 44000) throw new DemoContentError("Nội dung quá dài. Vui lòng chia bớt nội dung hoặc giảm số liên kết.");
  return next;
}
