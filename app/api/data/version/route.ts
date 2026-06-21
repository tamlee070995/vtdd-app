import { NextResponse } from "next/server";
import { getPublicSystemSettings } from "@/lib/system-store";

export const dynamic = "force-dynamic";

function clean(value: any) {
  return String(value ?? "").trim();
}

function buildNotifySettings(settings: Record<string, string>) {
  return {
    marquee: clean(settings.MARQUEE_MESSAGE),
    fixedBanner: clean(settings.FIXED_BANNER_MESSAGE),
    pushMessage: clean(settings.PUSH_NOTIFY_MESSAGE),
    pushVersion: clean(settings.PUSH_NOTIFY_VERSION),
    staffPopupTradeinEnabled: clean(settings.STAFF_POPUP_TRADEIN_ENABLED),
    staffPopupTradeinMessage: clean(settings.STAFF_POPUP_TRADEIN_MESSAGE),
    staffPopupTradeinSeconds: clean(settings.STAFF_POPUP_TRADEIN_SECONDS),
    staffPopupTradeinVersion: clean(settings.STAFF_POPUP_TRADEIN_VERSION),
    staffPopupBuyonlyEnabled: clean(settings.STAFF_POPUP_BUYONLY_ENABLED),
    staffPopupBuyonlyMessage: clean(settings.STAFF_POPUP_BUYONLY_MESSAGE),
    staffPopupBuyonlySeconds: clean(settings.STAFF_POPUP_BUYONLY_SECONDS),
    staffPopupBuyonlyVersion: clean(settings.STAFF_POPUP_BUYONLY_VERSION),
    priceEffectiveFrom: clean(settings.PRICE_EFFECTIVE_FROM),
    priceEffectiveTo: clean(settings.PRICE_EFFECTIVE_TO),
  };
}

export async function GET() {
  try {
    const settings = await getPublicSystemSettings();
    const dataVersion = String(settings.DATA_VERSION || "1");

    return NextResponse.json({
      success: true,
      dataVersion,
      system: settings,
      notify: buildNotifySettings(settings),
      updatedAt: new Date().toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không kiểm tra được phiên bản dữ liệu." },
      { status: 500 }
    );
  }
}
