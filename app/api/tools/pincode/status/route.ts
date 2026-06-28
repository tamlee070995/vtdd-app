import { NextRequest, NextResponse } from "next/server";
import {
  findPincodeFollowUpRequest,
  getPincodeRequestById,
  markPincodeCompleted,
  markPincodeSkipped,
  normalizePincodeFlow,
} from "@/lib/pincode-store";

export const dynamic = "force-dynamic";

function formatQuotaMessage(err: any, fallback: string) {
  const originalMessage = String(err?.message || "");
  const rawMessage = /quota|read requests|sheets\.googleapis\.com/i.test(originalMessage) ? originalMessage : "";
  const isQuotaError = /quota|read requests|sheets\.googleapis\.com/i.test(rawMessage);

  return {
    message: isQuotaError ? "Google Sheets đang quá tải lượt đọc. Vui lòng chờ khoảng 1 phút rồi thử lại." : rawMessage || fallback,
    status: isQuotaError ? 429 : 500,
  };
}

function cleanCode(value: unknown) {
  return String(value ?? "").trim().replace(/\.0$/, "");
}

function requestBelongsToOwner(request: { maST?: string; maNV?: string } | null, maST: unknown, maNV: unknown) {
  if (!request) return false;
  return cleanCode(request.maST) === cleanCode(maST) && cleanCode(request.maNV) === cleanCode(maNV);
}

export async function GET(req: NextRequest) {
  try {
    const requestId = String(req.nextUrl.searchParams.get("requestId") || "").trim();
    const maST = String(req.nextUrl.searchParams.get("maST") || "").trim();
    const maNV = String(req.nextUrl.searchParams.get("maNV") || "").trim();
    const flow = String(req.nextUrl.searchParams.get("flow") || "").trim();

    if (!requestId && maST && maNV) {
      const request = await findPincodeFollowUpRequest({
        maST,
        maNV,
        flow: flow ? normalizePincodeFlow(flow) : undefined,
      });

      return NextResponse.json({
        success: true,
        request,
      });
    }

    const request = await getPincodeRequestById(requestId);

    if (!request) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy hồ sơ PMH." },
        { status: 404 }
      );
    }

    if (!requestBelongsToOwner(request, maST, maNV)) {
      return NextResponse.json(
        { success: false, message: "Không có quyền xem hồ sơ PMH này." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      request,
    });
  } catch (err: any) {
    const error = formatQuotaMessage(err, "Không kiểm tra được trạng thái PMH.");
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const requestId = String(body?.requestId || "").trim();
    const action = String(body?.action || "DONE").trim().toUpperCase();
    const maST = cleanCode(body?.maST);
    const maNV = cleanCode(body?.maNV);

    const request = await getPincodeRequestById(requestId);

    if (!request) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy hồ sơ PMH." },
        { status: 404 }
      );
    }

    if (!requestBelongsToOwner(request, maST, maNV)) {
      return NextResponse.json(
        { success: false, message: "Không có quyền cập nhật hồ sơ PMH này." },
        { status: 403 }
      );
    }

    if (action === "SKIP") {
      await markPincodeSkipped(requestId);

      return NextResponse.json({
        success: true,
        message: "Đã bỏ qua PMH cũ để tạo yêu cầu mới.",
      });
    }

    await markPincodeCompleted(requestId);

    return NextResponse.json({
      success: true,
      message: "Đã ghi nhận nhân viên nhận PMH.",
    });
  } catch (err: any) {
    const error = formatQuotaMessage(err, "Không ghi nhận được trạng thái PMH.");
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.status }
    );
  }
}
