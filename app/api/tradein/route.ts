import { NextResponse } from "next/server";
import { getTradeinSnapshot, publicTradeinData } from "@/lib/tradein-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await getTradeinSnapshot();
    if (!snapshot) return NextResponse.json({ success: false, message: "Bảng giá đang được cập nhật. Vui lòng quay lại sau." }, { status: 503 });
    return NextResponse.json({ success: true, data: publicTradeinData(snapshot) });
  } catch {
    return NextResponse.json({ success: false, message: "Chưa tải được bảng giá. Vui lòng thử lại sau." }, { status: 503 });
  }
}
