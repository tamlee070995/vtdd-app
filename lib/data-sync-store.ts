import {
  countRows,
  deleteRows,
  eq,
  insertRows,
  isNull,
  isSupabaseConfigured,
  neq,
  notIsNull,
  selectAllRows,
} from "@/lib/supabase-rest";

export type SyncImportTarget =
  | "products_new"
  | "products_old_phone"
  | "products_old_tablet"
  | "staff"
  | "pmh_codes"
  | "pincode_requests";

export type SyncExportTarget =
  | SyncImportTarget
  | "system_settings"
  | "admin_audit"
  | "quote_logs"
  | "backup";

type PreviewSample = Record<string, string>;

type DataQualityIssue = {
  label: string;
  value: number;
  severity: "ok" | "warn" | "danger";
  samples?: string[];
};

type DataQualitySection = {
  key: string;
  title: string;
  total: number;
  issues: DataQualityIssue[];
};

const IMPORT_TARGETS = new Set<SyncImportTarget>([
  "products_new",
  "products_old_phone",
  "products_old_tablet",
  "staff",
  "pmh_codes",
  "pincode_requests",
]);

const EXPORT_TARGETS = new Set<SyncExportTarget>([
  "products_new",
  "products_old_phone",
  "products_old_tablet",
  "staff",
  "pmh_codes",
  "pincode_requests",
  "system_settings",
  "admin_audit",
  "quote_logs",
  "backup",
]);

const EXPORT_FILE_NAMES: Record<SyncExportTarget, string> = {
  products_new: "Data_Moi.csv",
  products_old_phone: "Data_Cu.csv",
  products_old_tablet: "Data_Cu_Tablet.csv",
  staff: "Data_Staff.csv",
  pmh_codes: "PMH.csv",
  pincode_requests: "Data_PincodeAudit.csv",
  system_settings: "System_Settings.csv",
  admin_audit: "Admin_Audit.csv",
  quote_logs: "Log_search.csv",
  backup: "vtdd-backup.json",
};

function assertDbReady() {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY.");
  }
}

function clean(value: unknown) {
  return String(value ?? "").trim().replace(/^\uFEFF/, "");
}

function cleanCode(value: unknown) {
  return clean(value).replace(/\.0$/, "");
}

function normalizeKey(value: unknown) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function compactKey(value: unknown) {
  return normalizeKey(value).replace(/\s+/g, "");
}

function hasAppleKeyword(...values: unknown[]) {
  const text = values.map(compactKey).join(" ");
  return text.includes("apple") || text.includes("iphone") || text.includes("ipad");
}

function getDuplicateSummary<T>(
  rows: T[],
  keyer: (row: T) => string,
  labeler: (row: T) => string
) {
  const groups = new Map<string, string[]>();

  rows.forEach((row) => {
    const key = keyer(row);
    if (!key) return;

    const list = groups.get(key) || [];
    list.push(labeler(row));
    groups.set(key, list);
  });

  const duplicates = Array.from(groups.values())
    .filter((items) => items.length > 1)
    .sort((a, b) => b.length - a.length);

  return {
    groups: duplicates.length,
    rows: duplicates.reduce((sum, items) => sum + items.length, 0),
    samples: duplicates.slice(0, 5).map((items) => `${items[0]} (${items.length})`),
  };
}

function makeIssue(
  label: string,
  value: number,
  severity: "ok" | "warn" | "danger",
  samples?: string[]
): DataQualityIssue {
  return {
    label,
    value,
    severity,
    samples: samples?.filter(Boolean).slice(0, 5),
  };
}

function rowHasData(row: string[]) {
  return row.some((cell) => clean(cell));
}

function detectDelimiter(text: string) {
  const firstLine = clean(text).split(/\r?\n/).find(Boolean) || "";
  const candidates = ["\t", ";", ","];
  return candidates
    .map((delimiter) => ({
      delimiter,
      count: firstLine.split(delimiter).length,
    }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ",";
}

function parseCsv(text: string) {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (rowHasData(row)) rows.push(row.map(clean));
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (rowHasData(row)) rows.push(row.map(clean));
  return rows;
}

function isHeaderRow(row: string[], target: SyncImportTarget) {
  const normalized = row.map(normalizeKey);
  const joined = normalized.join(" ");

  if (target === "products_new") {
    return joined.includes("tensanphamdoilen") || joined.includes("ten san pham doi len") || joined.includes("nganhhangmaydoilen");
  }

  if (target === "products_old_phone" || target === "products_old_tablet") {
    return joined.includes("tensanphamthuvao") || joined.includes("ten san pham thu vao") || joined.includes("loai 1");
  }

  if (target === "staff") {
    return joined.includes("ma nhan vien") || joined.includes("ma nv") || joined.includes("ten nhan vien");
  }

  if (target === "pmh_codes") {
    return normalized[0] === "pincode" || normalized[0] === "pin";
  }

  if (target === "pincode_requests") {
    return normalized[0] === "time" || joined.includes("ma st") || joined.includes("trang thai");
  }

  return false;
}

function dataRowsFromCsv(text: string, target: SyncImportTarget) {
  const rows = parseCsv(text);
  const hasHeader = rows[0] ? isHeaderRow(rows[0], target) : false;
  const offset = hasHeader ? 2 : 1;

  return rows
    .slice(hasHeader ? 1 : 0)
    .map((row, index) => ({ row, sourceRow: String(index + offset) }))
    .filter((item) => rowHasData(item.row));
}

function normalizePermission(value: unknown) {
  const v = clean(value).toLowerCase();
  if (v === "admin") return "admin";
  if (v === "mod" || v === "moderator") return "mod";
  return "";
}

function nonEmptyOrFallback(value: unknown, fallback: unknown) {
  const text = clean(value);
  return text || clean(fallback);
}

async function insertChunks(
  table: string,
  rows: Array<Record<string, unknown>>,
  options: { onConflict?: string } = {}
) {
  const chunkSize = 800;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await insertRows(table, chunk, {
      onConflict: options.onConflict,
      returning: "minimal",
    });
  }
}

async function countOldPhoneRowsForReplace() {
  const [notTabletRows, missingSourceRows] = await Promise.all([
    countRows("products_old", { source_sheet: neq("Data_Cu_Tablet") }),
    countRows("products_old", { source_sheet: isNull() }),
  ]);

  return notTabletRows + missingSourceRows;
}

async function deleteOldPhoneRowsForReplace() {
  await deleteRows("products_old", { source_sheet: neq("Data_Cu_Tablet") }, { returning: "minimal" });
  await deleteRows("products_old", { source_sheet: isNull() }, { returning: "minimal" });
}

async function deleteOldTabletRowsForReplace() {
  await deleteRows("products_old", { source_sheet: eq("Data_Cu_Tablet") }, { returning: "minimal" });
}

function buildNewProductRows(csvText: string) {
  return dataRowsFromCsv(csvText, "products_new")
    .map(({ row, sourceRow }) => ({
      brand: clean(row[0]),
      product_name: clean(row[1]),
      subsidy_ratio: clean(row[2]),
      subsidy_ratio_apple: clean(row[3]),
      subsidy_amount: clean(row[4]),
      category: clean(row[5]),
      min_subsidy_amount: clean(row[6]),
      min_subsidy_amount_apple: clean(row[7]),
      source_row: sourceRow,
    }))
    .filter((row) => row.product_name);
}

function buildOldProductRows(csvText: string, sourceSheet: "Data_Cu" | "Data_Cu_Tablet") {
  const target = sourceSheet === "Data_Cu" ? "products_old_phone" : "products_old_tablet";

  return dataRowsFromCsv(csvText, target)
    .map(({ row, sourceRow }) => ({
      source_sheet: sourceSheet,
      brand: clean(row[0]),
      product_name: clean(row[1]),
      storage: clean(row[2]),
      price_type_1: clean(row[3]),
      price_type_2: clean(row[4]),
      price_type_3: clean(row[5]),
      price_type_4: clean(row[6]),
      price_type_5: clean(row[7]),
      price_type_5_plus: clean(row[8]),
      category: clean(row[9]),
      mwg_type_1: clean(row[10]),
      mwg_type_2: clean(row[11]),
      source_row: sourceRow,
    }))
    .filter((row) => row.product_name);
}

async function rebuildStoresFromStaff() {
  const staffRows = await selectAllRows<any>("staff", { order: "source_row.asc" });
  const stores = new Map<string, { ma_st: string; store_name: string; departments: Set<string>; staff_count: number }>();

  staffRows.forEach((row) => {
    const maST = cleanCode(row.ma_st);
    if (!maST) return;

    const item = stores.get(maST) || {
      ma_st: maST,
      store_name: clean(row.store_name),
      departments: new Set<string>(),
      staff_count: 0,
    };

    if (!item.store_name && clean(row.store_name)) item.store_name = clean(row.store_name);
    if (clean(row.department)) item.departments.add(clean(row.department));
    item.staff_count += 1;
    stores.set(maST, item);
  });

  await deleteRows("stores", { ma_st: notIsNull() }, { returning: "minimal" });
  const rows = Array.from(stores.values()).map((row) => ({
    ma_st: row.ma_st,
    store_name: row.store_name,
    departments: Array.from(row.departments).join(" | "),
    staff_count: String(row.staff_count),
  }));

  await insertChunks("stores", rows, { onConflict: "ma_st" });
  return rows.length;
}

async function importStaff(csvText: string) {
  const existingRows = await selectAllRows<any>("staff");
  const existing = new Map(existingRows.map((row) => [cleanCode(row.ma_nv), row]));
  const rows = dataRowsFromCsv(csvText, "staff")
    .map(({ row, sourceRow }) => {
      const maNV = cleanCode(row[0]);
      if (!maNV) return null;

      const old = existing.get(maNV) || {};
      return {
        ma_nv: maNV,
        staff_name: clean(row[1]),
        ma_st: cleanCode(row[2]),
        store_name: clean(row[3]),
        department: clean(row[4]),
        password_hash: nonEmptyOrFallback(row[5], old.password_hash),
        security_question: nonEmptyOrFallback(row[6], old.security_question),
        security_answer: nonEmptyOrFallback(row[7], old.security_answer),
        gmail: nonEmptyOrFallback(row[8], old.gmail),
        status: clean(row[9]) || clean(old.status) || "Standby",
        reset_otp_hash: nonEmptyOrFallback(row[10], old.reset_otp_hash),
        reset_otp_expires: nonEmptyOrFallback(row[11], old.reset_otp_expires),
        reset_otp_day: nonEmptyOrFallback(row[12], old.reset_otp_day),
        reset_otp_count: clean(row[13]) || clean(old.reset_otp_count) || "0",
        need_setup: clean(row[14]) || clean(old.need_setup) || "0",
        permission: normalizePermission(row[15]) || normalizePermission(old.permission),
        module_permissions: clean(row[16]) || clean(old.module_permissions),
        source_row: sourceRow,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  if (rows.length === 0) throw new Error("File Data_Staff không có dòng hợp lệ.");

  await insertChunks("staff", rows, { onConflict: "ma_nv" });
  const stores = await rebuildStoresFromStaff();
  return { imported: rows.length, stores };
}

async function importPmhCodes(csvText: string) {
  const existingRows = await selectAllRows<any>("pmh_codes");
  const existing = new Set(existingRows.map((row) => clean(row.pincode)).filter(Boolean));
  const current = new Set<string>();
  let skipped = 0;

  const rows = dataRowsFromCsv(csvText, "pmh_codes")
    .map(({ row, sourceRow }) => ({
      pincode: clean(row[0]),
      status: clean(row[1]),
      menh_gia: clean(row[2]),
      request_id: clean(row[3]),
      used_at: clean(row[4]),
      used_by: clean(row[5]),
      source_row: sourceRow,
    }))
    .filter((row) => {
      if (!row.pincode) return false;
      if (existing.has(row.pincode) || current.has(row.pincode)) {
        skipped += 1;
        return false;
      }
      current.add(row.pincode);
      return true;
    });

  if (rows.length > 0) await insertChunks("pmh_codes", rows);
  return { imported: rows.length, skipped };
}

function buildPincodeRequestRows(csvText: string) {
  return dataRowsFromCsv(csvText, "pincode_requests")
    .map(({ row, sourceRow }) => {
      const requestId = clean(row[19]) || sourceRow;
      return {
        request_id: requestId,
        created_at_text: clean(row[0]),
        ma_st: cleanCode(row[1]),
        ma_nv: cleanCode(row[2]),
        imei: clean(row[3]),
        image_link_1: clean(row[4]),
        image_link_2: clean(row[5]),
        image_link_3: clean(row[6]),
        image_link_4: clean(row[7]),
        image_link_5: clean(row[8]),
        image_link_6: clean(row[9]),
        status: clean(row[10]) || "Pending",
        pincode: clean(row[11]),
        reject_reason: clean(row[12]),
        admin_reviewer: clean(row[13]),
        completion_status: clean(row[14]),
        menh_gia: clean(row[15]),
        old_model: clean(row[16]),
        new_model: clean(row[17]),
        support_type: clean(row[18]) || "NgoaiDS",
        source_row: sourceRow,
      };
    })
    .filter((row) => row.created_at_text && row.ma_st && row.ma_nv);
}

function sampleRows(rows: Array<Record<string, unknown>>, fields: string[], limit = 5): PreviewSample[] {
  return rows.slice(0, limit).map((row) => {
    const item: PreviewSample = {};
    fields.forEach((field) => {
      item[field] = clean(row[field]);
    });
    return item;
  });
}

function countUniqueBy<T>(rows: T[], keyer: (row: T) => string) {
  return new Set(rows.map(keyer).filter(Boolean)).size;
}

function getPreviewLabel(target: SyncImportTarget) {
  if (target === "products_new") return "Data_Moi";
  if (target === "products_old_phone") return "Data_Cu";
  if (target === "products_old_tablet") return "Data_Cu_Tablet";
  if (target === "staff") return "Data_Staff";
  if (target === "pmh_codes") return "PMH";
  return "Data_PincodeAudit";
}

export async function previewSyncCsv(target: string, csvText: string) {
  assertDbReady();
  if (!IMPORT_TARGETS.has(target as SyncImportTarget)) throw new Error("Loại import không hợp lệ.");

  const importTarget = target as SyncImportTarget;
  const warnings: string[] = [];
  let rows: Array<Record<string, unknown>> = [];
  let currentRows = 0;
  let willInsert = 0;
  let willUpdate = 0;
  let willReplace = 0;
  let willSkip = 0;
  let mode: "replace" | "upsert" | "append" = "upsert";
  let samples: PreviewSample[] = [];

  if (importTarget === "products_new") {
    rows = buildNewProductRows(csvText);
    currentRows = await countRows("products_new");
    willReplace = currentRows;
    willInsert = rows.length;
    mode = "replace";
    samples = sampleRows(rows, ["brand", "product_name", "category", "subsidy_ratio", "subsidy_amount"]);

    const duplicate = getDuplicateSummary(
      rows,
      (row) => compactKey(row.product_name),
      (row) => clean(row.product_name)
    );
    if (duplicate.groups > 0) warnings.push(`Có ${duplicate.groups} tên máy mới bị trùng: ${duplicate.samples.join(", ")}.`);
  } else if (importTarget === "products_old_phone" || importTarget === "products_old_tablet") {
    const sourceSheet = importTarget === "products_old_phone" ? "Data_Cu" : "Data_Cu_Tablet";
    rows = buildOldProductRows(csvText, sourceSheet);
    currentRows = importTarget === "products_old_phone"
      ? await countOldPhoneRowsForReplace()
      : await countRows("products_old", { source_sheet: eq(sourceSheet) });
    willReplace = currentRows;
    willInsert = rows.length;
    mode = "replace";
    samples = sampleRows(rows, ["brand", "product_name", "storage", "price_type_1", "price_type_2"]);

    const duplicate = getDuplicateSummary(
      rows,
      (row) => [row.source_sheet, compactKey(row.product_name), compactKey(row.storage)].join("|"),
      (row) => `${clean(row.product_name)} ${clean(row.storage)}`
    );
    if (duplicate.groups > 0) warnings.push(`Có ${duplicate.groups} máy cũ/dung lượng bị trùng: ${duplicate.samples.join(", ")}.`);
  } else if (importTarget === "staff") {
    rows = dataRowsFromCsv(csvText, "staff")
      .map(({ row, sourceRow }) => ({
        ma_nv: cleanCode(row[0]),
        staff_name: clean(row[1]),
        ma_st: cleanCode(row[2]),
        store_name: clean(row[3]),
        department: clean(row[4]),
        source_row: sourceRow,
      }))
      .filter((row) => row.ma_nv);

    const existingRows = await selectAllRows<any>("staff", { select: "ma_nv" });
    const existing = new Set(existingRows.map((row) => cleanCode(row.ma_nv)).filter(Boolean));
    const incoming = new Set<string>();
    rows.forEach((row) => {
      const maNV = cleanCode(row.ma_nv);
      if (!maNV) return;
      if (existing.has(maNV)) willUpdate += 1;
      else willInsert += 1;
      incoming.add(maNV);
    });
    currentRows = existingRows.length;
    mode = "upsert";
    samples = sampleRows(rows, ["ma_nv", "staff_name", "ma_st", "store_name"]);

    const duplicate = getDuplicateSummary(
      rows,
      (row) => cleanCode(row.ma_nv),
      (row) => `${clean(row.ma_nv)} - ${clean(row.staff_name)}`
    );
    if (duplicate.groups > 0) warnings.push(`File có ${duplicate.groups} mã nhân viên bị trùng: ${duplicate.samples.join(", ")}.`);
    if (incoming.size !== rows.length) willSkip += rows.length - incoming.size;
  } else if (importTarget === "pmh_codes") {
    rows = dataRowsFromCsv(csvText, "pmh_codes")
      .map(({ row, sourceRow }) => ({
        pincode: clean(row[0]),
        status: clean(row[1]),
        menh_gia: clean(row[2]),
        request_id: clean(row[3]),
        source_row: sourceRow,
      }))
      .filter((row) => row.pincode);

    const existingRows = await selectAllRows<any>("pmh_codes", { select: "pincode" });
    const existing = new Set(existingRows.map((row) => clean(row.pincode)).filter(Boolean));
    const incoming = new Set<string>();

    rows.forEach((row) => {
      const pin = clean(row.pincode);
      if (!pin) return;
      if (existing.has(pin) || incoming.has(pin)) willSkip += 1;
      else willInsert += 1;
      incoming.add(pin);
    });

    currentRows = existingRows.length;
    mode = "append";
    samples = sampleRows(rows, ["pincode", "status", "menh_gia"]);
    if (willSkip > 0) warnings.push(`Có ${willSkip} mã PMH trùng sẽ được bỏ qua.`);
  } else {
    rows = buildPincodeRequestRows(csvText);
    const existingRows = await selectAllRows<any>("pincode_requests", { select: "request_id" });
    const existing = new Set(existingRows.map((row) => clean(row.request_id)).filter(Boolean));
    rows.forEach((row) => {
      if (existing.has(clean(row.request_id))) willUpdate += 1;
      else willInsert += 1;
    });
    currentRows = existingRows.length;
    mode = "upsert";
    samples = sampleRows(rows, ["request_id", "created_at_text", "ma_st", "ma_nv", "status", "support_type"]);
  }

  if (rows.length === 0) warnings.push("Không tìm thấy dòng dữ liệu hợp lệ trong file.");

  return {
    target: importTarget,
    label: getPreviewLabel(importTarget),
    mode,
    currentRows,
    validRows: rows.length,
    uniqueRows: countUniqueBy(rows, (row) => clean(row.request_id) || clean(row.pincode) || clean(row.ma_nv) || clean(row.product_name)),
    willInsert,
    willUpdate,
    willReplace,
    willSkip,
    warnings,
    samples,
  };
}

export async function importSyncCsv(target: string, csvText: string) {
  assertDbReady();
  if (!IMPORT_TARGETS.has(target as SyncImportTarget)) throw new Error("Loại import không hợp lệ.");

  if (target === "products_new") {
    const rows = buildNewProductRows(csvText);
    if (rows.length === 0) throw new Error("File Data_Moi không có dòng hợp lệ.");
    await deleteRows("products_new", { id: notIsNull() }, { returning: "minimal" });
    await insertChunks("products_new", rows);
    return { target, imported: rows.length, skipped: 0, mode: "replace" };
  }

  if (target === "products_old_phone" || target === "products_old_tablet") {
    const sourceSheet = target === "products_old_phone" ? "Data_Cu" : "Data_Cu_Tablet";
    const rows = buildOldProductRows(csvText, sourceSheet);
    if (rows.length === 0) throw new Error(`File ${sourceSheet} không có dòng hợp lệ.`);
    if (target === "products_old_phone") {
      await deleteOldPhoneRowsForReplace();
    } else {
      await deleteOldTabletRowsForReplace();
    }
    await insertChunks("products_old", rows);
    return { target, imported: rows.length, skipped: 0, mode: "replace" };
  }

  if (target === "staff") {
    const result = await importStaff(csvText);
    return { target, imported: result.imported, skipped: 0, stores: result.stores, mode: "upsert" };
  }

  if (target === "pmh_codes") {
    const result = await importPmhCodes(csvText);
    return { target, imported: result.imported, skipped: result.skipped, mode: "append" };
  }

  const rows = buildPincodeRequestRows(csvText);
  if (rows.length === 0) throw new Error("File Data_PincodeAudit không có dòng hợp lệ.");
  await insertChunks("pincode_requests", rows, { onConflict: "request_id" });
  return { target, imported: rows.length, skipped: 0, mode: "upsert" };
}

function csvEscape(value: unknown) {
  const text = clean(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
  return text;
}

function makeCsv(headers: string[], rows: unknown[][]) {
  return "\uFEFF" + [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");
}

function redactStaffRow(row: any) {
  return {
    ma_nv: row.ma_nv,
    staff_name: row.staff_name,
    ma_st: row.ma_st,
    store_name: row.store_name,
    department: row.department,
    status: row.status,
    reset_otp_count: row.reset_otp_count,
    need_setup: row.need_setup,
    permission: row.permission,
    module_permissions: row.module_permissions,
    source_row: row.source_row,
  };
}

function redactSystemSettingRow(row: any) {
  const key = clean(row.key);
  const isSecret = /(TOKEN|SECRET|HASH|PASSWORD|PASS|PIN)/i.test(key);

  return {
    ...row,
    value: isSecret ? "[REDACTED]" : row.value,
  };
}

function sourceSort(a: any, b: any) {
  const aRow = Number(clean(a.source_row));
  const bRow = Number(clean(b.source_row));
  if (Number.isFinite(aRow) && Number.isFinite(bRow) && aRow !== bRow) return aRow - bRow;
  return clean(a.id).localeCompare(clean(b.id), "vi", { numeric: true });
}

export function getExportFileName(target: SyncExportTarget) {
  return EXPORT_FILE_NAMES[target] || "export.csv";
}

export async function exportSyncTarget(target: string) {
  assertDbReady();
  if (!EXPORT_TARGETS.has(target as SyncExportTarget)) throw new Error("Loại export không hợp lệ.");

  if (target === "backup") {
    const backup = await exportBackupJson();
    return {
      contentType: "application/json; charset=utf-8",
      fileName: getExportFileName("backup"),
      body: JSON.stringify(backup, null, 2),
    };
  }

  const csv = await exportCsv(target as Exclude<SyncExportTarget, "backup">);
  return {
    contentType: "text/csv; charset=utf-8",
    fileName: getExportFileName(target as SyncExportTarget),
    body: csv,
  };
}

async function exportCsv(target: Exclude<SyncExportTarget, "backup">) {
  if (target === "products_new") {
    const rows = (await selectAllRows<any>("products_new")).sort(sourceSort);
    return makeCsv(
      ["hang", "tensanphamdoilen", "tiletrogia", "tiletrogiaApple", "muctrogia", "nganhhangmaydoilen", "minmuctrogia", "minmuctrogiaApple"],
      rows.map((row) => [
        row.brand,
        row.product_name,
        row.subsidy_ratio,
        row.subsidy_ratio_apple,
        row.subsidy_amount,
        row.category,
        row.min_subsidy_amount,
        row.min_subsidy_amount_apple,
      ])
    );
  }

  if (target === "products_old_phone" || target === "products_old_tablet") {
    const sourceSheet = target === "products_old_phone" ? "Data_Cu" : "Data_Cu_Tablet";
    const rows = (await selectAllRows<any>("products_old", { filters: { source_sheet: eq(sourceSheet) } })).sort(sourceSort);
    return makeCsv(
      ["hang", "tensanphamthuvao", "bonho", "LOAI 1", "LOAI 2", "LOAI 3", "LOAI 4", "LOAI 5", "LOAI 5+", "nganhhangmaythuvao", "LOAI 1 MWG", "LOAI 2 MWG"],
      rows.map((row) => [
        row.brand,
        row.product_name,
        row.storage,
        row.price_type_1,
        row.price_type_2,
        row.price_type_3,
        row.price_type_4,
        row.price_type_5,
        row.price_type_5_plus,
        row.category,
        row.mwg_type_1,
        row.mwg_type_2,
      ])
    );
  }

  if (target === "staff") {
    const rows = (await selectAllRows<any>("staff")).sort(sourceSort).map(redactStaffRow);
    return makeCsv(
      ["MA_NHAN_VIEN", "TEN_NHAN_VIEN", "MA_SIEU_THI", "TEN_SIEU_THI", "TEN_PHONG_BAN", "TRANG_THAI", "RESET_OTP_COUNT", "NEED_SETUP", "PERMISSION", "ADMIN_MODULES"],
      rows.map((row) => [
        row.ma_nv,
        row.staff_name,
        row.ma_st,
        row.store_name,
        row.department,
        row.status,
        row.reset_otp_count,
        row.need_setup,
        row.permission,
        row.module_permissions,
      ])
    );
  }

  if (target === "pmh_codes") {
    const rows = (await selectAllRows<any>("pmh_codes")).sort(sourceSort);
    return makeCsv(
      ["PINCODE", "STATUS", "MENH_GIA", "REQUEST_ID", "USED_AT", "USED_BY"],
      rows.map((row) => [row.pincode, row.status, row.menh_gia, row.request_id, row.used_at, row.used_by])
    );
  }

  if (target === "pincode_requests") {
    const rows = (await selectAllRows<any>("pincode_requests")).sort(sourceSort);
    return makeCsv(
      ["TIME", "Mã ST", "Mã NV", "IMEI", "Link ảnh 1", "Link ảnh 2", "Link ảnh 3", "Link ảnh 4", "Link ảnh 5", "Link ảnh 6", "Trạng thái", "Pincode", "Nội dung từ chối", "Admin duyệt", "Hoàn tất/Copy", "Mệnh giá", "Model cũ", "Model mới", "Loại hỗ trợ"],
      rows.map((row) => [
        row.created_at_text,
        row.ma_st,
        row.ma_nv,
        row.imei,
        row.image_link_1,
        row.image_link_2,
        row.image_link_3,
        row.image_link_4,
        row.image_link_5,
        row.image_link_6,
        row.status,
        row.pincode,
        row.reject_reason,
        row.admin_reviewer,
        row.completion_status,
        row.menh_gia,
        row.old_model,
        row.new_model,
        row.support_type,
      ])
    );
  }

  if (target === "system_settings") {
    const rows = (await selectAllRows<any>("system_settings", { order: "key.asc" })).map(redactSystemSettingRow);
    return makeCsv(
      ["KEY", "VALUE", "TYPE", "UPDATED_AT", "UPDATED_BY"],
      rows.map((row) => [row.key, row.value, row.type, row.updated_at_text, row.updated_by])
    );
  }

  if (target === "admin_audit") {
    const rows = (await selectAllRows<any>("admin_audit", { order: "id.asc" }));
    return makeCsv(
      ["TIME", "ADMIN", "ACTION", "TARGET", "OLD_VALUE", "NEW_VALUE", "IP", "NOTE"],
      rows.map((row) => [row.time_text, row.admin, row.action, row.target, row.old_value, row.new_value, row.ip, row.note])
    );
  }

  const rows = (await selectAllRows<any>("quote_logs", { order: "id.asc" }));
  return makeCsv(
    ["Thời gian", "Hành động", "Mã NV", "Mã ST", "Tên nhân viên", "Luồng", "Máy mới", "Máy cũ", "Dung lượng", "Loại máy", "Giá máy cũ", "Hỗ trợ lên đời", "Ưu đãi MWG", "Tổng khách nhận", "Khách cần bù", "IP", "Thiết bị"],
    rows.map((row) => [
      row.time_text,
      row.action,
      row.ma_nv,
      row.ma_st,
      row.staff_name,
      row.flow,
      row.product_new,
      row.product_old,
      row.storage,
      row.device_type,
      row.old_price,
      row.subsidy_brand,
      row.subsidy_mwg,
      row.customer_total,
      row.customer_need_pay,
      row.ip,
      row.user_agent,
    ])
  );
}

async function exportBackupJson() {
  const [
    staff,
    stores,
    productsNew,
    productsOld,
    pmhCodes,
    pincodeRequests,
    systemSettings,
    adminAudit,
    quoteLogs,
  ] = await Promise.all([
    selectAllRows("staff"),
    selectAllRows("stores"),
    selectAllRows("products_new"),
    selectAllRows("products_old"),
    selectAllRows("pmh_codes"),
    selectAllRows("pincode_requests"),
    selectAllRows("system_settings"),
    selectAllRows("admin_audit"),
    selectAllRows("quote_logs"),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    tables: {
      staff: (staff as any[]).map(redactStaffRow),
      stores,
      products_new: productsNew,
      products_old: productsOld,
      pmh_codes: pmhCodes,
      pincode_requests: pincodeRequests,
      system_settings: (systemSettings as any[]).map(redactSystemSettingRow),
      admin_audit: adminAudit,
      quote_logs: quoteLogs,
    },
  };
}

export async function getDataQualityReport() {
  assertDbReady();

  const [productsNew, productsOld, staff, pmhCodes, pincodeRequests] = await Promise.all([
    selectAllRows<any>("products_new"),
    selectAllRows<any>("products_old"),
    selectAllRows<any>("staff"),
    selectAllRows<any>("pmh_codes"),
    selectAllRows<any>("pincode_requests"),
  ]);

  const duplicateNew = getDuplicateSummary(
    productsNew,
    (row) => compactKey(row.product_name),
    (row) => clean(row.product_name)
  );
  const duplicateOld = getDuplicateSummary(
    productsOld,
    (row) => [clean(row.source_sheet), compactKey(row.product_name), compactKey(row.storage)].join("|"),
    (row) => `${clean(row.product_name)} ${clean(row.storage)}`
  );
  const duplicateStaff = getDuplicateSummary(
    staff,
    (row) => cleanCode(row.ma_nv),
    (row) => `${clean(row.ma_nv)} - ${clean(row.staff_name)}`
  );
  const duplicatePmh = getDuplicateSummary(
    pmhCodes,
    (row) => clean(row.pincode),
    (row) => `${clean(row.pincode)} ${clean(row.menh_gia)}`
  );

  const newMissingCategory = productsNew.filter((row) => !clean(row.category));
  const newAppleRows = productsNew.filter((row) => hasAppleKeyword(row.brand, row.product_name));
  const oldMissingPrice = productsOld.filter(
    (row) =>
      !clean(row.price_type_1) &&
      !clean(row.price_type_2) &&
      !clean(row.price_type_3) &&
      !clean(row.price_type_4) &&
      !clean(row.price_type_5) &&
      !clean(row.price_type_5_plus)
  );
  const staffMissingStore = staff.filter((row) => !cleanCode(row.ma_st));
  const staffNeedSetup = staff.filter((row) => clean(row.need_setup) === "1");
  const pmhAvailable = pmhCodes.filter((row) => clean(row.status).toLowerCase() !== "used" && !clean(row.request_id));
  const pmhMissingValue = pmhCodes.filter((row) => !clean(row.menh_gia));
  const pendingRequests = pincodeRequests.filter((row) => clean(row.status).toLowerCase() === "pending");
  const requestsMissingImages = pincodeRequests.filter(
    (row) =>
      !clean(row.image_link_1) ||
      !clean(row.image_link_2) ||
      !clean(row.image_link_3) ||
      !clean(row.image_link_4) ||
      !clean(row.image_link_5)
  );

  const sections: DataQualitySection[] = [
    {
      key: "products_new",
      title: "Data_Moi",
      total: productsNew.length,
      issues: [
        makeIssue("Tên máy mới bị trùng", duplicateNew.groups, duplicateNew.groups > 0 ? "warn" : "ok", duplicateNew.samples),
        makeIssue(
          "Thiếu ngành hàng",
          newMissingCategory.length,
          newMissingCategory.length > 0 ? "danger" : "ok",
          newMissingCategory.slice(0, 5).map((row) => clean(row.product_name))
        ),
        makeIssue(
          "Có sản phẩm Apple",
          newAppleRows.length,
          newAppleRows.length > 0 ? "warn" : "ok",
          newAppleRows.slice(0, 5).map((row) => clean(row.product_name))
        ),
      ],
    },
    {
      key: "products_old",
      title: "Data_Cu / Data_Cu_Tablet",
      total: productsOld.length,
      issues: [
        makeIssue("Máy cũ + bộ nhớ bị trùng", duplicateOld.groups, duplicateOld.groups > 0 ? "warn" : "ok", duplicateOld.samples),
        makeIssue(
          "Thiếu toàn bộ giá loại máy",
          oldMissingPrice.length,
          oldMissingPrice.length > 0 ? "danger" : "ok",
          oldMissingPrice.slice(0, 5).map((row) => `${clean(row.product_name)} ${clean(row.storage)}`)
        ),
      ],
    },
    {
      key: "staff",
      title: "Data_Staff",
      total: staff.length,
      issues: [
        makeIssue("Mã nhân viên bị trùng", duplicateStaff.groups, duplicateStaff.groups > 0 ? "danger" : "ok", duplicateStaff.samples),
        makeIssue(
          "Thiếu mã siêu thị",
          staffMissingStore.length,
          staffMissingStore.length > 0 ? "danger" : "ok",
          staffMissingStore.slice(0, 5).map((row) => `${clean(row.ma_nv)} - ${clean(row.staff_name)}`)
        ),
        makeIssue("Tài khoản cần setup", staffNeedSetup.length, staffNeedSetup.length > 0 ? "warn" : "ok"),
      ],
    },
    {
      key: "pmh_codes",
      title: "Kho PMH",
      total: pmhCodes.length,
      issues: [
        makeIssue("PMH còn khả dụng", pmhAvailable.length, pmhAvailable.length > 0 ? "ok" : "warn"),
        makeIssue("Mã PMH bị trùng", duplicatePmh.groups, duplicatePmh.groups > 0 ? "danger" : "ok", duplicatePmh.samples),
        makeIssue(
          "PMH thiếu mệnh giá",
          pmhMissingValue.length,
          pmhMissingValue.length > 0 ? "warn" : "ok",
          pmhMissingValue.slice(0, 5).map((row) => clean(row.pincode))
        ),
      ],
    },
    {
      key: "pincode_requests",
      title: "Hồ sơ PMH",
      total: pincodeRequests.length,
      issues: [
        makeIssue("Hồ sơ đang chờ duyệt", pendingRequests.length, pendingRequests.length > 0 ? "warn" : "ok"),
        makeIssue(
          "Hồ sơ thiếu ảnh",
          requestsMissingImages.length,
          requestsMissingImages.length > 0 ? "warn" : "ok",
          requestsMissingImages.slice(0, 5).map((row) => `${clean(row.request_id)} - ${clean(row.ma_nv)}`)
        ),
      ],
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    sections,
  };
}

export async function getSyncSummary() {
  assertDbReady();
  const [
    staff,
    stores,
    productsNew,
    productsOldPhone,
    productsOldTablet,
    pmhCodes,
    pmhAvailable,
    pincodeRequests,
    pincodePending,
    quoteLogs,
    adminAudit,
  ] = await Promise.all([
    countRows("staff"),
    countRows("stores"),
    countRows("products_new"),
    countOldPhoneRowsForReplace(),
    countRows("products_old", { source_sheet: eq("Data_Cu_Tablet") }),
    countRows("pmh_codes"),
    countRows("pmh_codes", { status: "neq.Used" }),
    countRows("pincode_requests"),
    countRows("pincode_requests", { status: eq("Pending") }),
    countRows("quote_logs"),
    countRows("admin_audit"),
  ]);

  return {
    staff,
    stores,
    productsNew,
    productsOldPhone,
    productsOldTablet,
    pmhCodes,
    pmhAvailable,
    pincodeRequests,
    pincodePending,
    quoteLogs,
    adminAudit,
  };
}
