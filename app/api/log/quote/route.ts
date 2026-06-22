import { NextRequest, NextResponse } from "next/server";
import { detectDeviceLabel, normalizeNetworkTypeForDevice, packQuoteClientMeta } from "@/lib/quote-client-meta";
import { appendQuoteLog } from "@/lib/quote-log-store";
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
    const currentStaff = await getCurrentStaffFromRequest(req);

    if (!currentStaff) {
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

    const logRow = {
      time: now,
      action: getActionLabel(clean(body.action)),
      maNV: currentStaff.maNV,
      maST: currentStaff.maST,
      staffName: currentStaff.staffName,
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
      ip: getClientIp(req, body),
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
    });
  } catch (err: any) {
    console.error("LOG_QUOTE_ERROR:", err);

    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Không ghi được log.",
      },
      { status: 500 }
    );
  }
}
