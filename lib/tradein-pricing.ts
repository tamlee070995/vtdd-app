export const TRADEIN_GRADES = [1, 2, 3, 4, 5] as const;
export type TradeinGrade = typeof TRADEIN_GRADES[number];
export type PriceRange = { min: number; max: number; incomplete: boolean };
export type OldTradeinProduct = {
  id: string; brand: string; model: string; storage: string;
  ranges: Record<TradeinGrade, PriceRange>;
};
export type NewTradeinProduct = {
  id: string; brand: string; model: string;
  rate: number; appleRate: number; maxSupport: number; minSupport: number; appleMinSupport: number;
};
export type TradeinData = {
  version: string; syncedAt: string;
  oldProducts: OldTradeinProduct[]; newProducts: NewTradeinProduct[];
};
export type TradeinSnapshot = TradeinData & {
  schemaVersion: 1; importedBy: string;
  quality: { incompleteRanges: number; unavailableRanges: number; excludedTablets: number };
};
export class TradeinDataError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
type Cell = string | number | boolean | null | undefined;
type Rows = Cell[][];

export function normalizeTradeinText(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[Đđ]/g, "d")
    .toLowerCase().replace(/\+/g, " plus ").replace(/[^a-z0-9]+/g, " ").trim();
}
const header = (value: unknown) => normalizeTradeinText(value).replace(/ /g, "");
const text = (value: Cell) => String(value ?? "").trim();
function column(headers: Cell[], aliases: string[], label: string) {
  const names = aliases.map(header);
  const index = headers.findIndex(value => names.includes(header(value)));
  if (index < 0) throw new TradeinDataError(`Không tìm thấy cột ${label}. Vui lòng kiểm tra tiêu đề Google Sheet.`);
  return index;
}
function money(value: Cell, location: string) {
  if (value == null || value === "") return 0;
  let n: number;
  if (typeof value === "number") n = value;
  else {
    const raw = text(value);
    if (!raw) return 0;
    if (!/^\d[\d.,\s]*(?:₫|đ|vnd)?$/i.test(raw)) throw new TradeinDataError(`${location}: giá không hợp lệ.`);
    n = Number(raw.replace(/[^0-9]/g, ""));
  }
  if (!Number.isSafeInteger(n) || n < 0 || n > 1_000_000_000) throw new TradeinDataError(`${location}: giá không hợp lệ.`);
  return n;
}
function ratio(value: Cell, location: string) {
  if (value == null || value === "" || (typeof value === "string" && !value.trim())) return 0;
  if (typeof value === "boolean") throw new TradeinDataError(`${location}: tỷ lệ trợ giá không hợp lệ.`);
  const raw = String(value).trim();
  if (!/^\d+(?:[.,]\d+)?%?$/.test(raw)) throw new TradeinDataError(`${location}: tỷ lệ trợ giá không hợp lệ.`);
  let n = Number(raw.replace(/%$/, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new TradeinDataError(`${location}: tỷ lệ trợ giá không hợp lệ.`);
  if (raw.endsWith("%") || n > 1) n /= 100;
  return n;
}
function isTablet(model: string, category: string) {
  const value = normalizeTradeinText(`${model} ${category}`);
  return ["tablet", "may tinh bang", "ipad", "galaxy tab", "matepad", "redmi pad", "xiaomi pad", "oppo pad", "honor pad", "idea tab"].some(term => value.includes(term));
}
export function parseTradeinSheets(newRows: Rows, oldRows: Rows) {
  if (newRows.length < 2 || oldRows.length < 2) throw new TradeinDataError("Hai tab Data_Moi và Data_Cu_PhoneMWG phải có dữ liệu. Bản giá hiện tại được giữ nguyên.");
  if (newRows.length > 20_001 || oldRows.length > 20_001) throw new TradeinDataError("Mỗi bảng hỗ trợ tối đa 20.000 dòng.");
  const oldHeaders = oldRows[0];
  const oldColumnCount = Math.max(...oldRows.map(row => row.length));
  const brandCol = column(oldHeaders, ["Hãng", "Brand"], "Hãng trong Data_Cu_PhoneMWG");
  const modelCol = column(oldHeaders, ["Model", "Tên SP cũ", "Tên sản phẩm cũ"], "Model trong Data_Cu_PhoneMWG");
  const storageCol = column(oldHeaders, ["Bộ nhớ", "Dung lượng", "Storage", "Memory"], "Bộ nhớ trong Data_Cu_PhoneMWG");
  const pairs = new Map<TradeinGrade, [number, number]>();
  for (const grade of TRADEIN_GRADES) {
    const start = oldHeaders.findIndex((value, i) => i > storageCol && new RegExp(`^loai${grade}(?:min|max|mwg)?$`).test(header(value)));
    const next = header(oldHeaders[start + 1]);
    if (start < 0 || start + 1 >= oldColumnCount || (next && !["min", "max", `loai${grade}`, `loai${grade}min`, `loai${grade}max`].includes(next))) {
      throw new TradeinDataError(`Data_Cu_PhoneMWG: Loại ${grade} cần hai cột giá liền kề. Bản giá hiện tại được giữ nguyên.`);
    }
    pairs.set(grade, [start, start + 1]);
  }
  const quality = { incompleteRanges: 0, unavailableRanges: 0, excludedTablets: 0 };
  const oldProducts: OldTradeinProduct[] = [];
  const oldKeys = new Map<string, string>();
  oldRows.slice(1).forEach((row, index) => {
    if (row.every(value => !text(value))) return;
    const brand = text(row[brandCol]), model = text(row[modelCol]), storage = text(row[storageCol]);
    if (!brand || !model) throw new TradeinDataError(`Data_Cu_PhoneMWG dòng ${index + 2}: thiếu hãng hoặc model.`);
    const ranges = {} as Record<TradeinGrade, PriceRange>;
    for (const grade of TRADEIN_GRADES) {
      const pair = pairs.get(grade)!;
      const label = `Data_Cu_PhoneMWG dòng ${index + 2}, Loại ${grade}`;
      const a = money(row[pair[0]], label), b = money(row[pair[1]], label);
      const incomplete = Boolean(a) !== Boolean(b);
      ranges[grade] = { min: Math.min(a, b), max: Math.max(a, b), incomplete };
      if (incomplete) quality.incompleteRanges++;
      else if (!a && !b) quality.unavailableRanges++;
    }
    const key = [brand, model, storage].map(normalizeTradeinText).join("|");
    const signature = JSON.stringify(ranges);
    if (oldKeys.has(key)) {
      if (oldKeys.get(key) !== signature) throw new TradeinDataError(`Data_Cu_PhoneMWG dòng ${index + 2}: model và bộ nhớ trùng nhưng khác giá.`);
      return;
    }
    oldKeys.set(key, signature);
    oldProducts.push({ id: `old-${index}`, brand, model, storage, ranges });
  });
  const headers = newRows[0];
  const cols = {
    brand: column(headers, ["hang", "Hãng", "Brand"], "Hãng trong Data_Moi"),
    model: column(headers, ["tensanphamdoilen", "Tên SP mới", "Model"], "Tên sản phẩm đổi lên trong Data_Moi"),
    rate: column(headers, ["tiletrogia", "Tỷ lệ trợ giá"], "Tỷ lệ trợ giá trong Data_Moi"),
    appleRate: column(headers, ["tiletrogiaApple", "Tỷ lệ trợ giá Apple"], "Tỷ lệ trợ giá Apple trong Data_Moi"),
    max: column(headers, ["muctrogia", "Mức trợ giá", "Trợ giá tối đa"], "Mức trợ giá trong Data_Moi"),
    category: column(headers, ["nganhhangmaydoilen", "Ngành hàng", "Category"], "Ngành hàng trong Data_Moi"),
    min: column(headers, ["minmuctrogia", "Trợ giá tối thiểu"], "Trợ giá tối thiểu trong Data_Moi"),
    appleMin: column(headers, ["minmuctrogiaApple", "Trợ giá tối thiểu Apple"], "Trợ giá tối thiểu Apple trong Data_Moi"),
  };
  const newProducts: NewTradeinProduct[] = [];
  const newKeys = new Map<string, string>();
  newRows.slice(1).forEach((row, index) => {
    if (row.every(value => !text(value))) return;
    const brand = text(row[cols.brand]), model = text(row[cols.model]);
    if (!brand || !model) throw new TradeinDataError(`Data_Moi dòng ${index + 2}: thiếu hãng hoặc model.`);
    if (isTablet(model, text(row[cols.category]))) { quality.excludedTablets++; return; }
    const label = `Data_Moi dòng ${index + 2}`;
    const terms = { rate: ratio(row[cols.rate], label), appleRate: ratio(row[cols.appleRate], label),
      maxSupport: money(row[cols.max], label), minSupport: money(row[cols.min], label), appleMinSupport: money(row[cols.appleMin], label) };
    if (terms.maxSupport && Math.max(terms.minSupport, terms.appleMinSupport) > terms.maxSupport) throw new TradeinDataError(`${label}: mức trợ giá tối thiểu lớn hơn mức tối đa.`);
    const key = normalizeTradeinText(`${brand} ${model}`), signature = JSON.stringify(terms);
    if (newKeys.has(key)) {
      if (newKeys.get(key) !== signature) throw new TradeinDataError(`${label}: trùng model nhưng khác mức trợ giá.`);
      return;
    }
    newKeys.set(key, signature);
    newProducts.push({ id: `new-${index}`, brand, model, ...terms });
  });
  if (!oldProducts.length || !newProducts.length) throw new TradeinDataError("Chưa có đủ máy cũ và máy mới hợp lệ để đồng bộ.");
  return { oldProducts, newProducts, quality };
}

// Keep the supplied Apps Script order: round to 5,000, cap, then apply the floor.
export function calculateTradeinSupport(oldPrice: number, rate: number, minimum: number, maximum: number) {
  if (oldPrice <= 0) return 0;
  let support = Math.round(oldPrice * rate / 5000) * 5000;
  if (maximum > 0 && support > maximum) support = maximum;
  if (minimum > 0 && support < minimum) support = minimum;
  return Math.max(0, support);
}
export function calculateTradeinQuote(old: OldTradeinProduct, next: NewTradeinProduct, grade: TradeinGrade) {
  const price = old.ranges[grade];
  if (!price || price.incomplete || price.min <= 0 || price.max <= 0) return null;
  const apple = /apple|iphone|ipad/.test(normalizeTradeinText(`${old.brand} ${old.model}`));
  const rate = apple ? next.appleRate : next.rate;
  const minimum = apple ? next.appleMinSupport : next.minSupport;
  const a = calculateTradeinSupport(price.min, rate, minimum, next.maxSupport);
  const b = calculateTradeinSupport(price.max, rate, minimum, next.maxSupport);
  return { support: { min: Math.min(a, b), max: Math.max(a, b) }, total: { min: price.min + a, max: price.max + b } };
}
export function tradeinMatches(product: { brand: string; model: string; storage?: string }, query: string) {
  const haystack = normalizeTradeinText(`${product.brand} ${product.model} ${product.storage || ""}`);
  return normalizeTradeinText(query).split(" ").filter(Boolean).every(token => haystack.includes(token));
}
export function formatTradeinMoney(value: number) { return new Intl.NumberFormat("vi-VN").format(value) + "\u00a0₫"; }
export function formatTradeinRange(range: { min: number; max: number; incomplete?: boolean }, allowZero = false) {
  if (range.incomplete) return "Thiếu mốc giá";
  if (!range.min && !range.max && !allowZero) return "Chưa có giá";
  return range.min === range.max ? formatTradeinMoney(range.min) : `${formatTradeinMoney(range.min)} – ${formatTradeinMoney(range.max)}`;
}
