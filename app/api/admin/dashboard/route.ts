import { NextRequest, NextResponse } from "next/server";
import { deleteQuoteLogsByDashboardFilter } from "@/lib/quote-log-store";
import { appendAdminAudit, getAdminDashboardStats } from "@/lib/system-store";
import { requireAdminApi } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdminApi(req, { module: "tcdm", action: "dashboard-view" });
    if (response) return response;

    const sourceParam = req.nextUrl.searchParams.get("source");
    const source = sourceParam === "customer" ? "customer" : "staff";
    const dashboard = await getAdminDashboardStats(source);

    return NextResponse.json({
      success: true,
      source,
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

export async function DELETE(req: NextRequest) {
  try {
    const { admin, response } = await requireAdminApi(req, { module: "tcdm", action: "dashboard-view" });
    if (response) return response;

    if (String(admin?.permission || "").toLowerCase() !== "admin") {
      return NextResponse.json(
        {
          success: false,
          message: "Chỉ Admin mới được xóa lượt tìm kiếm.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const source = body?.source === "customer" ? "customer" : "staff";
    const mode = String(body?.mode || "").trim();
    const result = await deleteQuoteLogsByDashboardFilter(source, mode);
    const dashboard = await getAdminDashboardStats(source);

    await appendAdminAudit({
      admin: admin?.name || admin?.maNV || "Admin",
      action: "DELETE_QUOTE_LOGS",
      target: `quote_logs:${source}`,
      oldValue: mode,
      newValue: String(result.deleted),
      note: result.days.length ? `Days: ${result.days.join(", ")}` : "All logs",
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      source,
      result,
      dashboard,
      message: result.deleted
        ? `Đã xóa ${result.deleted} lượt tìm kiếm.`
        : "Không có lượt tìm kiếm phù hợp để xóa.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Không xóa được lượt tìm kiếm.",
      },
      { status: 500 }
    );
  }
}
