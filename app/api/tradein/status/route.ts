import { NextResponse } from "next/server";
import { getPublicTradeinStatus } from "@/lib/tradein-control-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  try { return NextResponse.json({ success: true, status: await getPublicTradeinStatus() }); }
  catch { return NextResponse.json({ success: false, message: "Chưa kiểm tra được cập nhật." }, { status: 503 }); }
}
