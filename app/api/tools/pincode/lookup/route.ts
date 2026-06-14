import { NextRequest, NextResponse } from "next/server";
import { lookupPincodeStaff } from "@/lib/pincode-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const maST = String(req.nextUrl.searchParams.get("maST") || "").trim();
    const maNV = String(req.nextUrl.searchParams.get("maNV") || "").trim();

    const lookup = await lookupPincodeStaff(maST, maNV);

    return NextResponse.json({
      success: true,
      ...lookup,
    });
  } catch (err: any) {
    const rawMessage = String(err?.message || "");
    const isQuotaError = /quota|read requests|sheets\.googleapis\.com/i.test(rawMessage);

    return NextResponse.json(
      {
        success: false,
        valid: false,
        message: isQuotaError
          ? "Google Sheets đang quá tải lượt đọc. Vui lòng chờ khoảng 1 phút rồi nhập lại mã."
          : rawMessage || "Không kiểm tra được mã siêu thị / nhân viên.",
      },
      { status: isQuotaError ? 429 : 500 }
    );
  }
}
