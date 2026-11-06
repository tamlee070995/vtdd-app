import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { isSameOriginRequest } from "@/lib/request-origin";
import { imeiAccess, ImeiError } from "@/lib/imei";
import { imeiReport } from "@/lib/imei-report";
import { getImeiBrandLocks } from "@/lib/imei-brand-lock-store";
import { cancelImei, generateImei, listImei } from "@/lib/imei-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json({ ...body, serverTime: Date.now() }, { status, headers: { "Cache-Control": "private, no-store" } });
function failure(error: unknown) {
  return json({ success: false, message: error instanceof ImeiError ? error.message : "Chưa nhận được kết quả từ sổ mã. Xin thử lại đúng lượt này để khỏi cấp dư mã.", code: error instanceof ImeiError ? error.code : "IMEI_UNAVAILABLE" }, error instanceof ImeiError ? error.status : 503);
}
export async function GET(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req);
  if (response) return response;
  const access = imeiAccess(admin!);
  if (!access.canView) return json({ success: false, message: "Bạn chưa được cấp quyền dùng mục Tạo IMEI / SN." }, 403);
  try {
    const filters = Object.fromEntries(["from","to","employee","store","brand","status","q"].map(key=>[key,req.nextUrl.searchParams.get(key)||""]));
    const all = access.canReport;
    if (!all && ["from","to","employee","store","brand","status"].some(key=>filters[key])) return json({success:false,message:"Bạn chưa được cấp quyền lọc toàn bộ sổ."},403);
    const [items, policy] = await Promise.all([imeiReport(admin!.maNV, all, filters), getImeiBrandLocks()]);
    const page = Math.max(1, Math.floor(Number(req.nextUrl.searchParams.get("page"))||1));
    return json({ success:true, items:items.slice((page-1)*20,page*20),total:items.length,page,pages:Math.max(1,Math.ceil(items.length/20)),access,policy });
  } catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req);
  if (response) return response;
  if (!isSameOriginRequest(req)) return json({ success: false, message: "Yêu cầu chưa đúng nguồn." }, 403);
  const access = imeiAccess(admin!);
  if (!access.canView) return json({ success: false, message: "Bạn chưa được cấp quyền dùng mục Tạo IMEI / SN." }, 403);
  if (Number(req.headers.get("content-length") || 0) > 4096) return json({ success: false, message: "Yêu cầu quá dài." }, 413);
  try {
    const raw = await req.text();
    if (raw.length > 4096) return json({ success: false, message: "Yêu cầu quá dài." }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { throw new ImeiError("Yêu cầu chưa đúng dạng."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ImeiError("Yêu cầu chưa đúng dạng.");
    if (body.action === "GENERATE") {
      if (!access.canCreate) return json({ success: false, message: "Bạn chưa được cấp quyền tạo mã." }, 403);
      const item = await generateImei(body.brand, body.requestId, admin!, {recipient:body.recipient,storeCode:body.storeCode});
      return json({ success: true, item, message: item.status === "cancelled" ? "Lượt cấp này đã hủy. Muốn cấp lại, xin tạo một lượt mới." : "Đã cấp mã và lưu vào sổ." });
    }
    if (body.action === "CANCEL") return json({ success: true, item: await cancelImei(body, admin!, access), message: "Đã hủy lượt cấp. Mã này có thể được cấp lại." });
    throw new ImeiError("Thao tác chưa đúng.");
  } catch (error) { return failure(error); }
}
