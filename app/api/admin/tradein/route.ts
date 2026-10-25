import { NextRequest, NextResponse } from "next/server";
import { adminCanAccessModule, adminHasAction, requireAdminApi } from "@/lib/admin-auth";
import { isSameOriginRequest } from "@/lib/request-origin";
import { TradeinDataError } from "@/lib/tradein-pricing";
import { getTradeinSnapshot, syncTradeinSource, tradeinSummary } from "@/lib/tradein-store";
import { getTradeinAccess, writeTradeinAccess } from "@/lib/tradein-control-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function failure(error: unknown) {
  return NextResponse.json({ success: false, message: error instanceof TradeinDataError ? error.message : "Không kết nối được nguồn giá. Bản giá đã đồng bộ được giữ nguyên; vui lòng thử lại." },
    { status: error instanceof TradeinDataError ? error.status : 503 });
}
export async function GET(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req);
  if (response) return response;
  if (!adminCanAccessModule(admin, "tcdm") && !adminHasAction(admin, "reload-data", "tcdm") && !adminHasAction(admin, "settings-write", "tcdm")) return NextResponse.json({ success: false, message: "Không có quyền truy cập." }, { status: 403 });
  try {
    const [snapshot, access] = await Promise.all([getTradeinSnapshot(), getTradeinAccess()]);
    return NextResponse.json({ success: true, summary: tradeinSummary(snapshot), access });
  }
  catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req);
  if (response) return response;
  if (!isSameOriginRequest(req)) return NextResponse.json({ success: false, message: "Yêu cầu không hợp lệ." }, { status: 403 });
  if (Number(req.headers.get("content-length") || 0) > 2048) return NextResponse.json({ success: false, message: "Yêu cầu quá lớn." }, { status: 413 });
  let payload: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 2048) return NextResponse.json({ success: false, message: "Yêu cầu quá lớn." }, { status: 413 });
    payload = JSON.parse(raw);
  }
  catch { return NextResponse.json({ success: false, message: "Yêu cầu không hợp lệ." }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ success: false, message: "Yêu cầu không hợp lệ." }, { status: 400 });
  const input = payload as Record<string, unknown>;
  if (input.action === "SET_ACCESS") {
    if (!adminHasAction(admin, "settings-write", "tcdm")) return NextResponse.json({ success: false, message: "Không có quyền đóng/mở trang tra giá." }, { status: 403 });
    try {
      const access = await writeTradeinAccess(input, admin!.name || admin!.maNV);
      return NextResponse.json({ success: true, access, message: access.locked ? "Đã tạm khóa trang tra giá." : "Đã mở lại trang tra giá." });
    } catch (error) { return failure(error); }
  }
  if (!adminHasAction(admin, "reload-data", "tcdm")) return NextResponse.json({ success: false, message: "Không có quyền đồng bộ giá." }, { status: 403 });
  if ((input.action && input.action !== "SYNC") || typeof input.version !== "string" || input.version.length > 80) {
    return NextResponse.json({ success: false, message: "Vui lòng tải lại trạng thái bảng giá." }, { status: 400 });
  }
  try {
    const snapshot = await syncTradeinSource(input.version, admin!.name || admin!.maNV);
    return NextResponse.json({ success: true, summary: tradeinSummary(snapshot), message: "Đã đồng bộ và cập nhật bảng giá công khai." });
  } catch (error) { return failure(error); }
}
