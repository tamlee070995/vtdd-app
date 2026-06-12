import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import {
  approvePincodeRequest,
  getPincodeAdminDashboard,
  importPincodes,
  rejectPincodeRequest,
} from "@/lib/pincode-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { response } = await requireAdminApi(req, { module: "tools" });
  if (response) return response;

  try {
    const dashboard = await getPincodeAdminDashboard();

    return NextResponse.json({
      success: true,
      dashboard,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không tải được dữ liệu PMH." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req, { module: "tools" });
  if (response) return response;

  try {
    const body = await req.json().catch(() => null);
    const action = String(body?.action || "").trim().toUpperCase();
    const adminName = admin?.name || admin?.maNV || "Admin";

    if (action === "IMPORT_PINCODES") {
      const result = await importPincodes(Array.isArray(body?.items) ? body.items : []);

      return NextResponse.json(result);
    }

    if (action === "APPROVE") {
      const result = await approvePincodeRequest({
        requestId: body?.requestId || "",
        admin: adminName,
        menhGia: body?.menhGia || "",
      });

      return NextResponse.json(result);
    }

    if (action === "REJECT" || action === "REQUEST_UPDATE") {
      const result = await rejectPincodeRequest({
        requestId: body?.requestId || "",
        admin: adminName,
        reason: body?.reason || "",
        soft: action === "REQUEST_UPDATE",
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, message: "Action không hợp lệ." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không xử lý được yêu cầu PMH." },
      { status: 500 }
    );
  }
}
