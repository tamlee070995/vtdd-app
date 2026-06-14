import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import {
  approvePincodeRequest,
  getPincodeAdminDashboard,
  importPincodes,
  rejectPincodeRequest,
} from "@/lib/pincode-store";

export const dynamic = "force-dynamic";

function formatQuotaMessage(err: any, fallback: string) {
  const rawMessage = String(err?.message || "");
  const isQuotaError = /quota|read requests|sheets\.googleapis\.com/i.test(rawMessage);

  return {
    message: isQuotaError ? "Google Sheets đang quá tải lượt đọc. Vui lòng chờ khoảng 1 phút rồi thử lại." : rawMessage || fallback,
    status: isQuotaError ? 429 : 500,
  };
}

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
    const error = formatQuotaMessage(err, "Không tải được dữ liệu PMH.");
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.status }
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
        imageSlots: Array.isArray(body?.imageSlots) ? body.imageSlots : [],
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, message: "Action không hợp lệ." }, { status: 400 });
  } catch (err: any) {
    const error = formatQuotaMessage(err, "Không xử lý được yêu cầu PMH.");
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.status }
    );
  }
}
