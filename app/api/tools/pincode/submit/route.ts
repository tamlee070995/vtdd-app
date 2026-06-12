import { NextRequest, NextResponse } from "next/server";
import { uploadDataUrlToCloudinary } from "@/lib/cloudinary-upload";
import { createPincodeRequest, normalizePincodeFlow } from "@/lib/pincode-store";
import { getSystemSettings } from "@/lib/system-store";
import { getPmhToolAvailability } from "@/lib/tool-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getUserAgent(req: NextRequest) {
  return String(req.headers.get("user-agent") || "").slice(0, 500);
}

export async function POST(req: NextRequest) {
  try {
    const settings = await getSystemSettings();
    const availability = getPmhToolAvailability(settings);

    if (!availability.enabled) {
      return NextResponse.json(
        {
          success: false,
          message: availability.reason || "Công cụ PMH/Pincode đang tạm đóng.",
        },
        { status: 423 }
      );
    }

    const body = await req.json().catch(() => null);
    const images = Array.isArray(body?.images) ? body.images.slice(0, 6) : [];
    const imageUrls = await Promise.all(
      images
        .filter((item: any) => String(item?.dataUrl || "").startsWith("data:image/"))
        .map((item: any, index: number) =>
          uploadDataUrlToCloudinary(String(item.dataUrl), {
            folder: "vtdd/pincode",
            name: `${body?.maNV || "nv"}-${body?.imei || "imei"}-${index + 1}`,
          })
        )
    );

    const result = await createPincodeRequest({
      flow: normalizePincodeFlow(body?.flow),
      maST: body?.maST || "",
      maNV: body?.maNV || "",
      imei: body?.imei || "",
      modelCu: body?.modelCu || "",
      modelMoi: body?.modelMoi || "",
      note: body?.note || "",
      imageUrls,
      userAgent: getUserAgent(req),
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không gửi được hồ sơ PMH." },
      { status: 400 }
    );
  }
}
