import { NextRequest, NextResponse } from "next/server";
import { getOnlineStats } from "@/lib/online-store";

export const dynamic = "force-dynamic";

function isAdmin(req: NextRequest) {
  return req.cookies.get("vtdd_admin_token")?.value === "admin-ok";
}

export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json(
        {
          success: false,
          message: "Chưa đăng nhập Admin hoặc phiên đăng nhập đã hết hạn.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      online: getOnlineStats(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Không tải được thống kê online.",
      },
      { status: 500 }
    );
  }
}
