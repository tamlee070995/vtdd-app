import { NextRequest, NextResponse } from "next/server";
import { uploadDataUrlToCloudinary } from "@/lib/cloudinary-upload";
import { createPincodeRequest, normalizePincodeFlow, updatePincodeRequestImages } from "@/lib/pincode-store";
import { getCurrentPmhToolAvailability, pmhToolClosedJson } from "@/lib/pmh-tool-guard";
import { getSystemSettings } from "@/lib/system-store";
import { notifyPincodeRequestTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getUserAgent(req: NextRequest) {
  return String(req.headers.get("user-agent") || "").slice(0, 500);
}

function formatSubmitError(err: any) {
  const rawMessage = String(err?.message || "");
  const isQuotaError = /quota|read requests|sheets\.googleapis\.com/i.test(rawMessage);

  return {
    message: isQuotaError ? "Google Sheets đang quá tải lượt đọc. Vui lòng chờ khoảng 1 phút rồi gửi lại hồ sơ." : rawMessage || "Không gửi được hồ sơ PMH.",
    status: isQuotaError ? 429 : 400,
  };
}

async function notifyTelegramIfNeeded(result: any) {
  if (!result?.success || result?.recovered || !result?.request) return;

  try {
    const settings = await getSystemSettings();
    await notifyPincodeRequestTelegram(settings, result.request);
  } catch (err: any) {
    console.warn("PINCODE_TELEGRAM_NOTIFY_ERROR:", err?.message || err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const availability = await getCurrentPmhToolAvailability();

    if (!availability.enabled) {
      return pmhToolClosedJson(availability);
    }

    const body = await req.json().catch(() => null);
    const flow = normalizePincodeFlow(body?.flow);
    const requiredFileCount = flow === "ChienGia" ? 5 : 6;
    const images = Array.isArray(body?.images) ? body.images.slice(0, 6) : [];
    const requestId = String(body?.requestId || "").trim();

    if (
      images.length !== requiredFileCount ||
      images.slice(0, requiredFileCount).some((item: any) => !String(item?.dataUrl || item?.url || "").trim())
    ) {
      return NextResponse.json(
        { success: false, message: `Vui lòng tải đủ ${requiredFileCount} file hồ sơ theo đúng từng ô yêu cầu.` },
        { status: 400 }
      );
    }

    const imageUrls = await Promise.all(
      images.map((item: any, index: number) => {
        const dataUrl = String(item?.dataUrl || "");
        const url = String(item?.url || "").trim();

        if (dataUrl.startsWith("data:image/") || dataUrl.startsWith("data:audio/")) {
          return uploadDataUrlToCloudinary(dataUrl, {
            folder: "vtdd/pincode",
            name: `${body?.maNV || "nv"}-${String(body?.imei || "imei").replace(/[^\w-]+/g, "_")}-${index + 1}`,
          });
        }

        if (requestId && /^https?:\/\//i.test(url)) return Promise.resolve(url);
        throw new Error(`Vui lòng tải đủ ${requiredFileCount} file hồ sơ theo đúng từng ô yêu cầu.`);
      })
    );

    if (requestId) {
      const result = await updatePincodeRequestImages({
        requestId,
        imageUrls,
      });

      await notifyTelegramIfNeeded(result);

      return NextResponse.json(result);
    }

    const result = await createPincodeRequest({
      flow,
      maST: body?.maST || "",
      maNV: body?.maNV || "",
      imei: body?.imei || "",
      identifierType: body?.identifierType || "",
      modelCu: body?.modelCu || "",
      oldRamRom: body?.oldRamRom || "",
      modelMoi: body?.modelMoi || "",
      deviceCategory: body?.deviceCategory || "",
      note: body?.note || "",
      imageUrls,
      userAgent: getUserAgent(req),
    });

    await notifyTelegramIfNeeded(result);

    return NextResponse.json(result);
  } catch (err: any) {
    const error = formatSubmitError(err);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.status }
    );
  }
}
