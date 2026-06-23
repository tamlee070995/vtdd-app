import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { getErrorLogs, getSystemHealth } from "@/lib/ops-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };
}

export async function GET(req: NextRequest) {
  const { response } = await requireAdminApi(req, { action: "dashboard-view" });
  if (response) return response;

  try {
    const mode = String(req.nextUrl.searchParams.get("mode") || "health").trim();

    if (mode === "errors") {
      const errors = await getErrorLogs({
        module: req.nextUrl.searchParams.get("module") || "",
        from: req.nextUrl.searchParams.get("from") || "",
        to: req.nextUrl.searchParams.get("to") || "",
        limit: Number(req.nextUrl.searchParams.get("limit") || 120),
      });

      return NextResponse.json({ success: true, errors }, { headers: noStoreHeaders() });
    }

    const health = await getSystemHealth();
    return NextResponse.json({ success: true, health }, { headers: noStoreHeaders() });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Khong tai duoc trang thai he thong." },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
