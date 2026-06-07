import { NextRequest, NextResponse } from "next/server";
import { insertSheetRowAt2Queued } from "@/lib/sheets-write";

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

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return value || "";
  }
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

    const cookieNV = req.cookies.get("vtdd_staff_nv")?.value || "";
    const cookieST = req.cookies.get("vtdd_staff_st")?.value || "";
    const cookieName = req.cookies.get("vtdd_staff_name")?.value || "";

    const maNV = clean(cookieNV || body.maNV);
    const maST = clean(cookieST || body.maST);
    const staffName = clean(safeDecode(cookieName) || body.staffName || "");

    if (!maNV || !maST) {
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

    await insertSheetRowAt2Queued(SHEET_NAME, HEADERS, [
      now,
      getActionLabel(clean(body.action)),
      maNV,
      maST,
      staffName,
      body.mode === "tradein" ? "Thu cũ đổi mới" : "Thu cũ không đổi mới",
      clean(body.spMoi),
      clean(body.spCu),
      clean(body.memory),
      clean(body.loai),
      money(body.giaXac),
      money(body.troGiaHang),
      money(body.troGiaMWG),
      money(body.tongTien),
      money(body.khachCanBu),
      getClientIp(req, body),
      req.headers.get("user-agent") || "",
    ]);

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