import { getSystemSettings, updateSystemSettings } from "@/lib/system-store";

export type HomeCmsSlug = "quy-trinh-thu-cu" | "may-moi" | "may-cu" | "demo";

export type HomeCmsItem = {
  slug: HomeCmsSlug;
  label: string;
  title: string;
  summary: string;
  body: string;
  draftTitle: string;
  draftSummary: string;
  draftBody: string;
  published: boolean;
  updatedAt: string;
};

const CMS_DEFS: Record<HomeCmsSlug, { label: string; fallbackTitle: string; fallbackSummary: string }> = {
  "quy-trinh-thu-cu": {
    label: "Quy trình thu cũ đổi mới",
    fallbackTitle: "Quy trình thu cũ đổi mới",
    fallbackSummary: "Tài liệu quy trình thao tác, kiểm tra và xử lý hồ sơ.",
  },
  "may-moi": {
    label: "Trang máy mới",
    fallbackTitle: "Chính sách bảo hành",
    fallbackSummary: "Thông tin chính sách bảo hành theo ngành hàng.",
  },
  "may-cu": {
    label: "Trang máy cũ",
    fallbackTitle: "Máy ĐSD, Máy Cũ Thu Mua",
    fallbackSummary: "Thông tin nghiệp vụ dành cho máy đã sử dụng / máy cũ thu mua.",
  },
  demo: {
    label: "Trang demo",
    fallbackTitle: "Gỡ Demo",
    fallbackSummary: "Hướng dẫn và công cụ hỗ trợ xử lý gỡ demo.",
  },
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function isOn(value: any) {
  const v = clean(value).toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function prefix(slug: HomeCmsSlug) {
  return `HOME_CMS_${slug.toUpperCase().replace(/-/g, "_")}`;
}

export const HOME_CMS_SLUGS: HomeCmsSlug[] = ["quy-trinh-thu-cu", "may-moi", "may-cu", "demo"];

export async function getHomeCmsItems(): Promise<Record<HomeCmsSlug, HomeCmsItem>> {
  const settings = await getSystemSettings();
  const result = {} as Record<HomeCmsSlug, HomeCmsItem>;

  HOME_CMS_SLUGS.forEach((slug) => {
    const p = prefix(slug);
    const def = CMS_DEFS[slug];
    const draftTitle = clean(settings[`${p}_DRAFT_TITLE`]) || def.fallbackTitle;
    const draftSummary = clean(settings[`${p}_DRAFT_SUMMARY`]) || def.fallbackSummary;
    const draftBody = clean(settings[`${p}_DRAFT_BODY`]);
    const title = clean(settings[`${p}_PUBLISHED_TITLE`]) || draftTitle;
    const summary = clean(settings[`${p}_PUBLISHED_SUMMARY`]) || draftSummary;
    const body = clean(settings[`${p}_PUBLISHED_BODY`]) || draftBody;

    result[slug] = {
      slug,
      label: def.label,
      title,
      summary,
      body,
      draftTitle,
      draftSummary,
      draftBody,
      published: isOn(settings[`${p}_PUBLISHED`]),
      updatedAt: clean(settings[`${p}_UPDATED_AT`]),
    };
  });

  return result;
}

export async function getHomeCmsItem(slug: string) {
  const safeSlug = HOME_CMS_SLUGS.find((item) => item === slug);
  if (!safeSlug) return null;

  const items = await getHomeCmsItems();
  return items[safeSlug];
}

export async function saveHomeCmsDraft(
  slug: HomeCmsSlug,
  data: { title: string; summary: string; body: string },
  updatedBy: string
) {
  const p = prefix(slug);
  const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  await updateSystemSettings(
    {
      [`${p}_DRAFT_TITLE`]: clean(data.title),
      [`${p}_DRAFT_SUMMARY`]: clean(data.summary),
      [`${p}_DRAFT_BODY`]: String(data.body || ""),
      [`${p}_UPDATED_AT`]: now,
    },
    updatedBy
  );
}

export async function publishHomeCmsItem(slug: HomeCmsSlug, updatedBy: string) {
  const items = await getHomeCmsItems();
  const item = items[slug];
  const p = prefix(slug);
  const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  await updateSystemSettings(
    {
      [`${p}_PUBLISHED`]: "1",
      [`${p}_PUBLISHED_TITLE`]: item.draftTitle,
      [`${p}_PUBLISHED_SUMMARY`]: item.draftSummary,
      [`${p}_PUBLISHED_BODY`]: item.draftBody,
      [`${p}_UPDATED_AT`]: now,
    },
    updatedBy
  );
}

export async function unpublishHomeCmsItem(slug: HomeCmsSlug, updatedBy: string) {
  const p = prefix(slug);
  const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  await updateSystemSettings(
    {
      [`${p}_PUBLISHED`]: "0",
      [`${p}_UPDATED_AT`]: now,
    },
    updatedBy
  );
}
