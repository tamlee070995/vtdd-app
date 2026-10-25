import "server-only";
import { randomUUID } from "node:crypto";
import { getSystemSettings, updateSystemSettings } from "./system-store";
import { insertRows, isSupabaseConfigured, selectAllRows, updateRows } from "./supabase-rest";
import { changeDemoBrand, defaultDemoBrands, demoSlug, DemoContentError, emptyDemoGuide, type DemoBrand } from "./demo-content";

const PREFIX = "DEMO_BRAND_";
let writes: Promise<unknown> = Promise.resolve();

async function readRecords(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return getSystemSettings();
  const rows = await selectAllRows<{ key: string; value: string }>("system_settings", { filters: { key: `like.${PREFIX}*` } });
  return Object.fromEntries(rows.map(row => [row.key, row.value]));
}
export function decodeDemoBrands(settings: Record<string, string>): DemoBrand[] {
  const brands = new Map(defaultDemoBrands().map(brand => [brand.id, brand]));
  for (const [key, value] of Object.entries(settings)) {
    if (!key.startsWith(PREFIX)) continue;
    const brand = JSON.parse(value) as DemoBrand;
    if (brand.id !== key.slice(PREFIX.length) || !/^[a-z0-9-]{1,80}$/.test(brand.slug) || !brand.draft || !brand.revision) throw new Error("Không đọc được dữ liệu hãng Gỡ Demo.");
    brands.set(brand.id, brand);
  }
  return [...brands.values()].sort((a, b) => a.order - b.order || a.draft.name.localeCompare(b.draft.name, "vi"));
}
export async function getDemoBrands() { return decodeDemoBrands(await readRecords()); }
export async function getPublishedDemoBrands() {
  return (await getDemoBrands()).filter(brand => brand.visible && brand.published).map(brand => ({
    id: brand.id, slug: brand.slug, guide: brand.published!, publishedAt: brand.publishedAt,
  }));
}
export async function writeDemoBrand(payload: Record<string, unknown>, actor: string) {
  const task = writes.then(async () => {
    const records = await readRecords();
    const brands = decodeDemoBrands(records);
    const now = new Date().toISOString();
    let brand: DemoBrand;
    if (payload.action === "CREATE") {
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      if (!name || name.length > 60) throw new DemoContentError("Tên hãng phải có từ 1 đến 60 ký tự.");
      if (brands.some(b => b.draft.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"))) throw new DemoContentError("Tên hãng đã tồn tại.");
      if (brands.length >= 100) throw new DemoContentError("Danh mục hiện hỗ trợ tối đa 100 hãng.");
      const id = randomUUID();
      brand = { id, slug: `${demoSlug(name)}-${id.slice(0, 8)}`, draft: emptyDemoGuide(name), published: null,
        visible: true, order: Math.min(9999, Math.max(0, ...brands.map(b => b.order)) + 10), revision: randomUUID(), updatedAt: now, publishedAt: "" };
    } else {
      const current = brands.find(b => b.id === payload.id);
      if (!current) throw new DemoContentError("Không tìm thấy hãng.", 404);
      brand = changeDemoBrand(current, payload, randomUUID(), now);
    }
    const key = PREFIX + brand.id;
    const value = JSON.stringify(brand);
    if (isSupabaseConfigured()) {
      const row = { key, value, type: "TEXT", updated_at_text: now, updated_by: actor };
      if (records[key]) {
        const old = JSON.parse(records[key]) as DemoBrand;
        const changed = await updateRows("system_settings", { key: `eq.${key}`, value: `like.*"revision":"${old.revision}"*` }, row);
        if (changed.length !== 1) throw new DemoContentError("Nội dung vừa thay đổi ở phiên khác. Vui lòng tải lại.", 409);
      } else {
        try { await insertRows("system_settings", [row]); }
        catch (error) { if (/23505|duplicate/i.test(String(error))) throw new DemoContentError("Hãng vừa được cập nhật ở phiên khác. Vui lòng tải lại.", 409); throw error; }
      }
    } else await updateSystemSettings({ [key]: value }, actor);
    return brand;
  });
  writes = task.catch(() => {});
  return task;
}
