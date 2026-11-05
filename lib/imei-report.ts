import "server-only";
import { listImei } from "@/lib/imei-store";
import { ImeiError, IMEI_BRANDS, type ImeiIssue } from "@/lib/imei";
export type ImeiFilters = { from?: string; to?: string; employee?: string; store?: string; brand?: string; status?: string; q?: string };
export async function imeiReport(actor: string, all: boolean, filters: ImeiFilters) {
  for (const key of ["from", "to"] as const) if (filters[key] && !/^\d{4}-\d{2}-\d{2}$/.test(filters[key]!) ) throw new ImeiError("Ngày lọc chưa đúng.");
  for(const key of ["from","to"] as const) if(filters[key] && (!Number.isFinite(Date.parse(filters[key]!)) || new Date(filters[key]!).toISOString().slice(0,10)!==filters[key])) throw new ImeiError("Ngày lọc chưa đúng.");
  for(const value of Object.values(filters)) if(value && value.length>100) throw new ImeiError("Nội dung lọc quá dài.");
  if (filters.from && filters.to && filters.from > filters.to) throw new ImeiError("Ngày bắt đầu phải trước ngày kết thúc.");
  if (filters.brand && !Object.hasOwn(IMEI_BRANDS, filters.brand)) throw new ImeiError("Hãng lọc chưa đúng.");
  if (filters.status && !["active","cancelled","pending","conflict"].includes(filters.status)) throw new ImeiError("Tình trạng lọc chưa đúng.");
  let items: ImeiIssue[] = [];
  // Bound scans explicitly; never return a silently truncated export.
  const first = await listImei(actor, all, 1, filters.q || "");
  if(first.total > 5000) throw new ImeiError("Sổ có hơn 5.000 lượt. Xin tìm theo IMEI / SN trước khi xuất; cần nâng cấp bộ chỉ mục cho sổ lớn.", 413);
  items.push(...first.items);
  for(let page=2;page<=first.pages;page++) items.push(...(await listImei(actor,all,page,filters.q||"")).items);
  return items.filter(item => {
    const day = new Date(Date.parse(item.createdAt)+7*3600000).toISOString().slice(0,10);
    return (all || item.status!=="cancelled") && (!filters.from || day>=filters.from) && (!filters.to || day<=filters.to)
      && (!filters.employee || [item.actor,item.actorName,item.recipient||""].some(v=>v.toLowerCase().includes(filters.employee!.toLowerCase())))
      && (!filters.store || item.storeCode===filters.store) && (!filters.brand || item.brand===filters.brand) && (!filters.status || item.status===filters.status);
  });
}
