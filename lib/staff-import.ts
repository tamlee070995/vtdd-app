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

function parseDelimitedImport(text: string) {
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

