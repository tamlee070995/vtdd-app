export type StandbyImportPreview = { fileName: string; rawRows: number; codes: string[]; duplicates: string[]; errors: string[] };
function normalizeImportHeader(value: any) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeImportStaffCode(value: any) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/\.0$/, "")
    .replace(/^nv/i, "")
    .replace(/^'/, "");
}

function detectImportDelimiter(line: string) {
  const candidates = [",", "\t", ";"];
  return candidates
    .map((delimiter) => ({
      delimiter,
      count: line.split(delimiter).length - 1,
    }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ",";
}

export function parseDelimitedImport(text: string) {
  const cleanText = String(text || "").replace(/^\uFEFF/, "");
  const firstLine = cleanText.split(/\r?\n/).find((line) => line.trim()) || "";
  const delimiter = detectImportDelimiter(firstLine);
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < cleanText.length; index += 1) {
    const char = cleanText[index];
    const next = cleanText[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export type NewStaffInput = { maNV: string; staffName: string; maST: string };
export function validateNewStaffRows(input: unknown): NewStaffInput[] {
  if (!Array.isArray(input) || !input.length || input.length > 200) throw new Error("Mỗi lần thêm từ 1 đến 200 nhân viên.");
  const seen = new Set<string>();
  return input.map((row, index) => {
    if (!row || typeof row !== "object") throw new Error(`Dòng ${index + 1}: dữ liệu chưa hợp lệ.`);
    const maNV = normalizeImportStaffCode(row.maNV);
    const staffName = typeof row.staffName === "string" ? row.staffName.trim() : "";
    const maST = typeof row.maST === "string" ? row.maST.trim() : "";
    if (!/^\d{1,20}$/.test(maNV)) throw new Error(`Dòng ${index + 1}: mã nhân viên phải là số, tối đa 20 chữ số.`);
    if (!staffName || staffName.length > 120) throw new Error(`Dòng ${index + 1}: nhập họ tên, tối đa 120 ký tự.`);
    if (maST && !/^\d{1,20}$/.test(maST)) throw new Error(`Dòng ${index + 1}: mã siêu thị phải là số.`);
    if (seen.has(maNV)) throw new Error(`Mã ${maNV} bị trùng trong danh sách. Xin giữ lại một dòng.`);
    seen.add(maNV);
    return { maNV, staffName, maST };
  });
}
export function parseNewStaffImport(text: string): NewStaffInput[] {
  const rows = parseDelimitedImport(text);
  const first = rows[0] || [];
  const codeIndex = first.findIndex(cell => ["manhanvien", "manv", "nv", "staffcode", "employeeid"].includes(normalizeImportHeader(cell)));
  const hasHeader = codeIndex >= 0;
  const nameIndex = hasHeader ? first.findIndex(cell => ["tennhanvien", "hoten", "ten", "staffname", "name"].includes(normalizeImportHeader(cell))) : 1;
  const storeIndex = hasHeader ? first.findIndex(cell => ["masieuthi", "mast", "storecode"].includes(normalizeImportHeader(cell))) : 2;
  return validateNewStaffRows((hasHeader ? rows.slice(1) : rows).map(row => ({ maNV: row[hasHeader ? codeIndex : 0], staffName: row[nameIndex], maST: storeIndex >= 0 ? row[storeIndex] || "" : "" })));
}

export function buildStandbyImportPreview(text: string, fileName: string): StandbyImportPreview {
  if (!/\.(csv|tsv|txt)$/i.test(fileName)) throw new Error("Chỉ hỗ trợ CSV/TSV. Trong Excel, chọn Save As → CSV UTF-8 trước khi tải lên.");
  const rows = parseDelimitedImport(text);
  const errors: string[] = [];

  if (rows.length === 0) {
    return { fileName, rawRows: 0, codes: [], duplicates: [], errors: ["File CSV không có dữ liệu."] };
  }

  const headerAliases = new Set([
    "manhanvien",
    "manv",
    "ma_nv",
    "nv",
    "staffcode",
    "employeeid",
    "employee",
  ]);
  const headerRow = rows[0] || [];
  const headerIndex = headerRow.findIndex((cell) => headerAliases.has(normalizeImportHeader(cell)));
  const hasHeader = headerIndex >= 0;
  const codeIndex = hasHeader ? headerIndex : 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const codes: string[] = [];

  dataRows.forEach((item, index) => {
    const rowNumber = index + (hasHeader ? 2 : 1);
    const code = normalizeImportStaffCode(item[codeIndex]);

    if (!/^\d+$/.test(code)) {
      if (item.some((cell) => String(cell || "").trim())) {
        errors.push(`Dòng ${rowNumber}: mã nhân viên trống hoặc không hợp lệ.`);
      }
      return;
    }

    if (seen.has(code)) {
      duplicates.push(code);
      return;
    }

    seen.add(code);
    codes.push(code);
  });

  if (codes.length > 5000) {
    errors.push("Mỗi lần import tối đa 5.000 mã nhân viên.");
  }

  return {
    fileName,
    rawRows: dataRows.length,
    codes,
    duplicates,
    errors,
  };
}

