import { NextRequest, NextResponse } from "next/server";
import { getAdminDashboardStats } from "@/lib/system-store";
import { requireAdminApi } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdminApi(req, { module: "tcdm", action: "dashboard-view" });
    if (response) return response;

    const dashboard = await getAdminDashboardStats();

    return NextResponse.json({
      success: true,
      dashboard,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Không tải được dashboard tra giá.",
      },
      { status: 500 }
    );
  }
}
