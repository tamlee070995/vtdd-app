import { NextResponse } from "next/server";
import { getPublicSystemSettings } from "@/lib/system-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getPublicSystemSettings();

    return NextResponse.json({
      success: true,
      dataVersion: String(settings.DATA_VERSION || "1"),
      updatedAt: new Date().toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không kiểm tra được phiên bản dữ liệu." },
      { status: 500 }
    );
  }
}
