import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { DemoContentError } from "@/lib/demo-content";
import { getDemoBrands, writeDemoBrand } from "@/lib/demo-store";
import { isSameOriginRequest } from "@/lib/request-origin";

export const dynamic = "force-dynamic";
export async function GET() {
  const { response } = await requireAdminApi(undefined, { module: "demo" });
  if (response) return response;
  try { return NextResponse.json({ success: true, brands: await getDemoBrands() }); }
  catch { return NextResponse.json({ success: false, message: "Không tải được danh mục hãng. Vui lòng thử lại." }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req, { module: "demo", write: true });
  if (response) return response;
  if (!isSameOriginRequest(req)) return NextResponse.json({ success: false, message: "Yêu cầu không hợp lệ." }, { status: 403 });
  if (Number(req.headers.get("content-length") || 0) > 150000) return NextResponse.json({ success: false, message: "Nội dung quá lớn." }, { status: 413 });
  let payload: unknown;
  try { payload = await req.json(); } catch { return NextResponse.json({ success: false, message: "Nội dung gửi lên không hợp lệ." }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ success: false, message: "Nội dung không hợp lệ." }, { status: 400 });
  try {
    const brand = await writeDemoBrand(payload as Record<string, unknown>, admin?.name || "Admin");
    return NextResponse.json({ success: true, brand, message: "Đã cập nhật hãng." });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof DemoContentError ? error.message : "Không lưu được nội dung. Vui lòng thử lại." }, { status: error instanceof DemoContentError ? error.status : 500 });
  }
}
