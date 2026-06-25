import { NextRequest, NextResponse } from "next/server";
import { detectDeviceLabel, normalizeNetworkTypeForDevice, packQuoteClientMeta } from "@/lib/quote-client-meta";
import { appendQuoteLog, type QuoteLogRow } from "@/lib/quote-log-store";
import { appendErrorLog, consumeBehaviorRateLimit, getClientIpFromRequest } from "@/lib/ops-store";
import { insertSheetRowAt2Queued } from "@/lib/sheets-write";
import { getCurrentStaffFromRequest } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

const SHEET_NAME = "Log_search";

const HEADERS = [
  "Thời gian",
  "Hành động",
  "Mã NV",
  "Mã ST",
  "Tên nhân viên",
  "Luồng",
  "Máy mới",
  "Máy cũ",
  "Dung lượng",
  "Loại máy",
  "Giá máy cũ",
  "Hỗ trợ lên đời",
  "Ưu đãi MWG",
  "Tổng khách nhận",
  "Khách cần bù",
  "IP",
  "Thiết bị",
];

function clean(value: any) {
  return String(value ?? "").trim();
}

function money(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function getActionLabel(action: string) {
  if (action === "TRA_GIA") return "TRA GIÁ";
  if (action === "CUSTOMER_QUOTE") return "KHÁCH TRA GIÁ";
  if (action === "COPY") return "COPY BÁO GIÁ";
  if (action === "SHARE") return "CHIA SẺ BÁO GIÁ";
  if (action === "CUSTOMER_VIEW") return "CHẾ ĐỘ KHÁCH XEM";
  return action || "";
}

function getClientIp(req: NextRequest, body: any) {
  const forwarded = req.headers.get("forwarded") || "";
  const forwardedFor = forwarded.match(/for="?([^;,"]+)/i)?.[1] || "";

  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("true-client-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-client-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    forwardedFor ||
    clean(body.clientIpHint) ||
    "";

  return ip || "Không xác định";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const source = clean(body.source).toLowerCase();
    const isCustomerQuote = source === "customer" || clean(body.action) === "CUSTOMER_QUOTE";
    const currentStaff = isCustomerQuote ? null : await getCurrentStaffFromRequest(req);

    if (!isCustomerQuote && !currentStaff) {
      return NextResponse.json(
        {
          success: false,
          message: "Chưa xác thực nhân viên.",
        },
        { status: 401 }
      );
    }

    const now = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const userAgent = req.headers.get("user-agent") || "";
    const deviceLabel = clean(body.clientDevice) || detectDeviceLabel(userAgent);
    const networkType = normalizeNetworkTypeForDevice(deviceLabel, body.networkType);
    const clientIp = getClientIp(req, body);
    const action = clean(body.action);
    const rate = consumeBehaviorRateLimit({
      scope: isCustomerQuote ? "quote-log-customer" : "quote-log",
      limit: 60,
      lockMs: 10 * 60 * 1000,
      keys: isCustomerQuote
        ? [clientIp, deviceLabel, clean(body.spCu)]
        : [clientIp, currentStaff?.maNV || "", currentStaff?.maST || ""],
    });

    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: rate.message,
        },
        { status: 429 }
      );
    }

    const spamWarning =
      !isCustomerQuote &&
      action === "TRA_GIA" &&
      Number(rate.count || 0) >= 45;

    if (spamWarning && (Number(rate.count || 0) === 45 || Number(rate.count || 0) % 10 === 0)) {
      await appendErrorLog({
        actor: currentStaff?.maNV || "staff",
        module: "quote-spam-warning",
        page: "/staff",
        message: `Nhân viên ${currentStaff?.maNV || ""} tra giá ${rate.count}/${rate.limit} lượt trong 10 phút.`,
        ip: clientIp,
        userAgent,
        severity: "warn",
      });
    }

    const logRow: QuoteLogRow = {
      source: isCustomerQuote ? "customer" : "staff",
      time: now,
      action: getActionLabel(isCustomerQuote ? "CUSTOMER_QUOTE" : action),
      maNV: isCustomerQuote ? "KHACH" : currentStaff?.maNV || "",
      maST: isCustomerQuote ? "" : currentStaff?.maST || "",
      staffName: isCustomerQuote ? "Khách hàng" : currentStaff?.staffName || "",
      mode: body.mode === "tradein" ? "Thu cũ đổi mới" : "Thu cũ không đổi mới",
      spMoi: clean(body.spMoi),
      spCu: clean(body.spCu),
      memory: clean(body.memory),
      loai: clean(body.loai),
      giaXac: money(body.giaXac),
      troGiaHang: money(body.troGiaHang),
      troGiaMWG: money(body.troGiaMWG),
      tongTien: money(body.tongTien),
      khachCanBu: money(body.khachCanBu),
      ip: clientIp,
      userAgent,
      deviceLabel,
      networkType,
    };

    const wroteDb = await appendQuoteLog(logRow);

    if (!wroteDb) {
      await insertSheetRowAt2Queued(SHEET_NAME, HEADERS, [
        now,
        logRow.action,
        logRow.maNV,
        logRow.maST,
        logRow.staffName,
        logRow.mode,
        logRow.spMoi,
        logRow.spCu,
        logRow.memory,
        logRow.loai,
        logRow.giaXac,
        logRow.troGiaHang,
        logRow.troGiaMWG,
        logRow.tongTien,
        logRow.khachCanBu,
        logRow.ip,
        packQuoteClientMeta({
          userAgent: logRow.userAgent,
          deviceLabel: logRow.deviceLabel,
          networkType: logRow.networkType,
        }),
      ]);
    }

    return NextResponse.json({
      success: true,
      spamWarning,
      spamCount: rate.count || 0,
      spamLimit: rate.limit || 0,
    });
  } catch (err: any) {
    console.error("LOG_QUOTE_ERROR:", err);
    await appendErrorLog({
      actor: "staff",
      module: "quote-log",
      page: "/api/log/quote",
      message: err?.message || "Quote log error",
      ip: getClientIpFromRequest(req),
      userAgent: req.headers.get("user-agent") || "",
    });

    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Không ghi được log.",
      },
      { status: 500 }
    );
  }
}
