import { TRADEIN_GRADES, TradeinDataError, type TradeinGrade } from "./tradein-pricing";

export type GradeDescriptions = Record<TradeinGrade, string>;
export type TradeinGradeGuide = { revision: string; descriptions: GradeDescriptions };
export function defaultGradeGuide(): TradeinGradeGuide {
  return { revision: "initial", descriptions: {
    1: "Màn hình chính hãng, đầy đủ chức năng, hoàn toàn không trầy xước. Pin iPhone từ 90% trở lên. iPhone 14 series trở lên mã VN/A.",
    2: "Màn hình chính hãng, đầy đủ chức năng, trầy xước nhẹ dưới 3 vết.",
    3: "Màn hình chính hãng, đầy đủ chức năng, trầy xước, cấn móp nhẹ.",
    4: "Màn hình chính hãng, cấn móp, bể vỡ nặng.",
    5: "Lỗi màn hình.",
  } };
}
export function normalizeGradeGuide(payload: Record<string, unknown>, revision: string): TradeinGradeGuide {
  const input = payload.descriptions;
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TradeinDataError("Vui lòng nhập định nghĩa cho cả 5 loại.");
  const descriptions = {} as GradeDescriptions;
  for (const grade of TRADEIN_GRADES) {
    const value = (input as Record<string, unknown>)[grade];
    if (typeof value !== "string" || !value.trim() || value.trim().length > 600) throw new TradeinDataError(`Định nghĩa Loại ${grade} cần từ 1 đến 600 ký tự.`);
    descriptions[grade] = value.trim();
  }
  return { revision, descriptions };
}
