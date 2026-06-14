import { NextRequest, NextResponse } from "next/server";
import { getPincodeNewModelsByCategory, getPincodeOldModels } from "@/lib/pincode-store";
import { getCurrentPmhToolAvailability, pmhToolClosedJson } from "@/lib/pmh-tool-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatQuotaMessage(err: any, fallback: string) {
  const rawMessage = String(err?.message || "");
  const isQuotaError = /quota|read requests|sheets\.googleapis\.com/i.test(rawMessage);

  return {
    message: isQuotaError ? "Google Sheets đang quá tải lượt đọc. Vui lòng chờ khoảng 1 phút rồi thử lại." : rawMessage || fallback,
    status: isQuotaError ? 429 : 500,
  };
}

export async function GET(req: NextRequest) {
  try {
    const availability = await getCurrentPmhToolAvailability();

    if (!availability.enabled) {
      return pmhToolClosedJson(availability, { models: [] });
    }

    const type = String(req.nextUrl.searchParams.get("type") || "").trim();
    if (type === "old") {
      const models = await getPincodeOldModels();

      return NextResponse.json({
        success: true,
        type,
        models,
      });
    }

    const category = String(req.nextUrl.searchParams.get("category") || "").trim();
    const models = await getPincodeNewModelsByCategory(category);

    return NextResponse.json({
      success: true,
      category,
      models,
    });
  } catch (err: any) {
    const error = formatQuotaMessage(err, "Không tải được danh sách máy mới.");
    return NextResponse.json(
      { success: false, models: [], message: error.message },
      { status: error.status }
    );
  }
}
