import { NextRequest, NextResponse } from "next/server";
import { uploadDataUrlToCloudinary } from "@/lib/cloudinary-upload";
import { createPincodeRequest, getPincodeRequestById, normalizePincodeFlow, updatePincodeRequestImages } from "@/lib/pincode-store";
import { getCurrentPmhToolAvailability, pmhToolClosedJson } from "@/lib/pmh-tool-guard";
import { appendErrorLog, consumeBehaviorRateLimit, getClientIpFromRequest } from "@/lib/ops-store";
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
  const leaksStaffMapping = /Data_Staff|thuộc ST|không khớp/i.test(rawMessage);
  const isSafeInputError = /Lỗi cú pháp|Serial Number|IMEI|Vui lòng|Không tìm thấy mã nhân viên|Tài khoản nhân viên/i.test(rawMessage);

  return {
    message: isQuotaError
      ? "Google Sheets đang quá tải lượt đọc. Vui lòng chờ khoảng 1 phút rồi gửi lại hồ sơ."
      : leaksStaffMapping
        ? "Mã siêu thị hoặc mã nhân viên không hợp lệ/không khớp."
        : isSafeInputError
          ? rawMessage
          : "Không gửi được hồ sơ PMH.",
    status: isQuotaError ? 429 : 400,
  };
}

function cleanCode(value: unknown) {
  return String(value ?? "").trim().replace(/\.0$/, "");
}

function getDataUrlPayloadBytes(value: unknown) {
  const dataUrl = String(value || "");
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) return 0;
  const payload = dataUrl.slice(comma + 1);
  return Math.floor((payload.length * 3) / 4);
}

function validateUploadQuality(images: any[], requiredFileCount: number) {
  const invalidSlots: number[] = [];

  images.slice(0, requiredFileCount).forEach((item, index) => {
    const dataUrl = String(item?.dataUrl || "");
    const url = String(item?.url || "");
    if (url && !dataUrl) return;
    if (dataUrl.startsWith("data:audio/")) return;
    if (getDataUrlPayloadBytes(dataUrl) < 25 * 1024) invalidSlots.push(index + 1);
  });

  if (invalidSlots.length) {
    throw new Error(`Ảnh ${invalidSlots.join(", ")} quá nhỏ hoặc không rõ. Vui lòng chụp/chọn lại ảnh rõ hơn.`);
  }
}

function requestBelongsToOwner(request: { maST?: string; maNV?: string } | null, maST: unknown, maNV: unknown) {
  if (!request) return false;
  return cleanCode(request.maST) === cleanCode(maST) && cleanCode(request.maNV) === cleanCode(maNV);
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
    const clientIp = getClientIpFromRequest(req);

    if (
      images.length !== requiredFileCount ||
      images.slice(0, requiredFileCount).some((item: any) => !String(item?.dataUrl || item?.url || "").trim())
    ) {
      return NextResponse.json(
        { success: false, message: `Vui lòng tải đủ ${requiredFileCount} file hồ sơ theo đúng từng ô yêu cầu.` },
        { status: 400 }
      );
    }

    if (requestId) {
      const request = await getPincodeRequestById(requestId);
      if (!request) {
        return NextResponse.json(
          { success: false, message: "Không tìm thấy hồ sơ cần cập nhật ảnh." },
          { status: 404 }
        );
      }

      if (!requestBelongsToOwner(request, body?.maST, body?.maNV)) {
        return NextResponse.json(
          { success: false, message: "Không có quyền cập nhật hồ sơ PMH này." },
          { status: 403 }
        );
      }
    }

    const rate = consumeBehaviorRateLimit({
      scope: requestId ? "pmh-update" : "pmh-submit",
      limit: requestId ? 8 : 5,
      lockMs: 10 * 60 * 1000,
      keys: [clientIp, body?.maNV, body?.maST, body?.imei],
    });

    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, code: "SOFT_LOCKED", message: rate.message },
        { status: 429 }
      );
    }

    validateUploadQuality(images, requiredFileCount);

    const imageUrls = await Promise.all(
      images.map((item: any, index: number) => {
        const dataUrl = String(item?.dataUrl || "");
        const url = String(item?.url || "").trim();

        if (dataUrl.startsWith("data:image/") || dataUrl.startsWith("data:audio/")) {
          return uploadDataUrlToCloudinary(dataUrl, {
            folder: "vtdd/pincode",
            name: `pmh-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${index + 1}`,
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
    await appendErrorLog({
      actor: "staff",
      module: "pmh-submit",
      page: "/api/tools/pincode/submit",
      message: err?.message || "PMH submit error",
      ip: getClientIpFromRequest(req),
      userAgent: req.headers.get("user-agent") || "",
    });
    const error = formatSubmitError(err);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.status }
    );
  }
}
