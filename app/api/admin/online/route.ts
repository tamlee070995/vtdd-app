import { NextRequest, NextResponse } from "next/server";
import { getOnlineStats } from "@/lib/online-store";
import { requireAdminApi } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdminApi(req);
    if (response) return response;

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
