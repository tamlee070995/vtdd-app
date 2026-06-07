import { NextRequest, NextResponse } from "next/server";
import { readSheetRange } from "@/lib/sheets";
import { getPublicSystemSettings } from "@/lib/system-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PriceDataPayload = {
  moi: any[][];
  cu: any[][];
  tablet: any[][];
};

type PriceDataCache = {
  version: string;
  loadedAt: string;
  loadedAtMs: number;
  data: PriceDataPayload;
};

let priceDataCache: PriceDataCache | null = null;
let priceDataLoadingPromise: Promise<PriceDataCache> | null = null;

function nowVN() {
  return new Date().toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function clean(value: any) {
  return String(value ?? "").trim();
}

function getDataVersion(settings: Record<string, string>) {
  return clean(settings.DATA_VERSION) || "1";
}

function buildNotifySettings(settings: Record<string, string>) {
  return {
    marquee: clean(settings.MARQUEE_MESSAGE),
    fixedBanner: clean(settings.FIXED_BANNER_MESSAGE),
    pushMessage: clean(settings.PUSH_NOTIFY_MESSAGE),
    pushVersion: clean(settings.PUSH_NOTIFY_VERSION),
    priceEffectiveFrom: clean(settings.PRICE_EFFECTIVE_FROM),
    priceEffectiveTo: clean(settings.PRICE_EFFECTIVE_TO),
  };
}

async function loadPriceDataFromSheet(version: string): Promise<PriceDataCache> {
  const [moi, cu, tablet] = await Promise.all([
    readSheetRange("Data_Moi!A:Z"),
    readSheetRange("Data_Cu!A:Z"),
    readSheetRange("Data_Cu_Tablet!A:Z"),
  ]);

  return {
    version,
    loadedAt: nowVN(),
    loadedAtMs: Date.now(),
    data: {
      moi,
      cu,
      tablet,
    },
  };
}

async function getCachedPriceData(version: string) {
  if (priceDataCache && priceDataCache.version === version) {
    return {
      cacheStatus: "HIT",
      cache: priceDataCache,
    };
  }

  if (priceDataLoadingPromise) {
    const loadingCache = await priceDataLoadingPromise;

    if (loadingCache.version === version) {
      return {
        cacheStatus: "WAIT_HIT",
        cache: loadingCache,
      };
    }
  }

  priceDataLoadingPromise = loadPriceDataFromSheet(version);

  try {
    const freshCache = await priceDataLoadingPromise;
    priceDataCache = freshCache;

    return {
      cacheStatus: "MISS",
      cache: freshCache,
    };
  } finally {
    priceDataLoadingPromise = null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // Luôn đọc System_Settings realtime để lock web/tab có hiệu lực ngay.
    // Chỉ cache 3 sheet bảng giá nặng: Data_Moi, Data_Cu, Data_Cu_Tablet.
    const settings = await getPublicSystemSettings();
    const version = getDataVersion(settings);

    const forceRefresh =
      req.nextUrl.searchParams.get("refresh") === "1" ||
      req.nextUrl.searchParams.get("force") === "1";

    if (forceRefresh) {
      priceDataCache = null;
      priceDataLoadingPromise = null;
    }

    const { cacheStatus, cache } = await getCachedPriceData(version);
    const notify = buildNotifySettings(settings);

    return NextResponse.json(
      {
        success: true,
        dataVersion: version,
        cache: {
          status: cacheStatus,
          version: cache.version,
          loadedAt: cache.loadedAt,
          ageSeconds: Math.max(0, Math.floor((Date.now() - cache.loadedAtMs) / 1000)),
        },
        data: {
          moi: cache.data.moi,
          cu: cache.data.cu,
          tablet: cache.data.tablet,

          // Quan trọng: trang nhân viên / khách hàng đang đọc lock từ json.data.system.
          // Không được bỏ field này, nếu không khóa tab sẽ không chạy.
          system: settings,

          // Thông báo dùng dạng camelCase để client đọc đúng.
          notify,

          // Giữ thêm rawSettings để sau này debug hoặc component mới cần dùng.
          rawSettings: settings,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-VTDD-Data-Version": version,
          "X-VTDD-Cache": cacheStatus,
          "X-VTDD-Cache-Loaded-At": cache.loadedAt,
        },
      }
    );
  } catch (err: any) {
    console.error("SUPER_FAST_DATA_ERROR:", err);

    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Không tải được dữ liệu tra cứu.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-VTDD-Cache": "ERROR",
        },
      }
    );
  }
}