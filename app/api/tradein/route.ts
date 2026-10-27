import { NextResponse } from "next/server";
import { getTradeinSnapshot, publicTradeinData } from "@/lib/tradein-store";
import { getTradeinAccess } from "@/lib/tradein-control-store";
import { getTradeinGradeGuide } from "@/lib/tradein-grade-guide-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const access = await getTradeinAccess();
    if (access.locked) return NextResponse.json({ success: false, code: "TRADEIN_LOCKED", status: { locked: true, message: access.message, priceUpdatedAt: "" } }, { status: 503 });
    const [snapshot, gradeGuide] = await Promise.all([getTradeinSnapshot(), getTradeinGradeGuide()]);
    if (!snapshot) return NextResponse.json({ success: false, message: "Bảng giá đang được cập nhật. Vui lòng quay lại sau." }, { status: 503 });
    return NextResponse.json({ success: true, data: publicTradeinData(snapshot), gradeGuide: gradeGuide.descriptions });
  } catch {
    return NextResponse.json({ success: false, message: "Chưa tải được bảng giá. Vui lòng thử lại sau." }, { status: 503 });
  }
}
