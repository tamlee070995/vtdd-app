import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaffFromRequest } from "@/lib/staff-auth";
import { getStaffQuoteHistory } from "@/lib/quote-log-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const currentStaff = await getCurrentStaffFromRequest(req);

    if (!currentStaff) {
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập nhân viên." },
        { status: 401 }
      );
    }

    const limit = Number(req.nextUrl.searchParams.get("limit") || 20);
    const history = await getStaffQuoteHistory(currentStaff.maNV, limit);

    return NextResponse.json({
      success: true,
      history,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không tải được lịch sử báo giá." },
      { status: 500 }
    );
  }
}
