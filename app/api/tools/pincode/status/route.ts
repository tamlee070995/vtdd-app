import { NextRequest, NextResponse } from "next/server";
import { getPincodeRequestById, markPincodeCompleted } from "@/lib/pincode-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const requestId = String(req.nextUrl.searchParams.get("requestId") || "").trim();
    const request = await getPincodeRequestById(requestId);

    if (!request) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy hồ sơ PMH." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      request,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không kiểm tra được trạng thái PMH." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const requestId = String(body?.requestId || "").trim();

    await markPincodeCompleted(requestId);

    return NextResponse.json({
      success: true,
      message: "Đã ghi nhận nhân viên nhận PMH.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không ghi nhận được trạng thái PMH." },
      { status: 500 }
    );
  }
}
