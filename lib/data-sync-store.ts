import {
  countRows,
  deleteRows,
  eq,
  insertRows,
  isSupabaseConfigured,
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
    await deleteRows("products_old", { source_sheet: eq(sourceSheet) }, { returning: "minimal" });
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
    const rows = (await selectAllRows<any>("staff")).sort(sourceSort);
    return makeCsv(
      ["MÃ NHÂN VIÊN", "TÊN NHÂN VIÊN", "MÃ SIÊU THỊ", "TÊN SIÊU THỊ", "TÊN PHÒNG BAN", "MẬT KHẨU", "CÂU HỎI BẢO MẬT", "CÂU TRẢ LỜI BẢO MẬT", "GMAIL", "TRẠNG THÁI", "RESET_OTP_HASH", "RESET_OTP_EXPIRES", "RESET_OTP_DAY", "RESET_OTP_COUNT", "NEED_SETUP", "PERMISSION", "ADMIN_MODULES"],
      rows.map((row) => [
        row.ma_nv,
        row.staff_name,
        row.ma_st,
        row.store_name,
        row.department,
        row.password_hash,
        row.security_question,
        row.security_answer,
        row.gmail,
        row.status,
        row.reset_otp_hash,
        row.reset_otp_expires,
        row.reset_otp_day,
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
    const rows = (await selectAllRows<any>("system_settings", { order: "key.asc" }));
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
      staff,
      stores,
      products_new: productsNew,
      products_old: productsOld,
      pmh_codes: pmhCodes,
      pincode_requests: pincodeRequests,
      system_settings: systemSettings,
      admin_audit: adminAudit,
      quote_logs: quoteLogs,
    },
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
    countRows("products_old", { source_sheet: eq("Data_Cu") }),
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
