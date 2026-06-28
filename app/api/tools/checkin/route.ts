import { NextRequest, NextResponse } from "next/server";
import {
  CHECKIN_TABLE_MISSING_MESSAGE,
  getCheckinCustomersResult,
  isCheckinTableMissingError,
  normalizeCheckinErrorMessage,
  setCustomerCheckin,
} from "@/lib/checkin-store";
import { getCurrentStaffFromRequest } from "@/lib/staff-auth";
import { staffHasCheckinToolAccess } from "@/lib/staff-store";
import { getSystemSettings } from "@/lib/system-store";
import { getCheckinToolAvailability } from "@/lib/tool-settings";

export const dynamic = "force-dynamic";

function noStoreHeaders() {
  return { "Cache-Control": "no-store, no-cache, must-revalidate" };
}

async function requireCheckinAccess(req: NextRequest) {
  const current = await getCurrentStaffFromRequest(req);

  if (!current) {
    return NextResponse.json(
      { success: false, message: "Vui lòng đăng nhập nhân viên để dùng công cụ Check-in." },
      { status: 401, headers: noStoreHeaders() }
    );
  }

  if (!staffHasCheckinToolAccess(current.staff)) {
    return NextResponse.json(
      { success: false, message: "Tài khoản chưa được Admin cấp quyền dùng công cụ Check-in." },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const settings = await getSystemSettings();
  const availability = getCheckinToolAvailability(settings);

  if (!availability.enabled) {
    return NextResponse.json(
      { success: false, message: availability.reason || "Công cụ Check-in đang tạm đóng." },
      { status: 423, headers: noStoreHeaders() }
    );
  }

  return null;
}

export async function GET(req: NextRequest) {
  const denied = await requireCheckinAccess(req);
  if (denied) return denied;

  try {
    const query = req.nextUrl.searchParams.get("q") || "";
    const result = await getCheckinCustomersResult({ query, limit: 50 });

    return NextResponse.json(
      {
        success: true,
        customers: result.customers,
        message: result.tableMissing && result.total === 0 ? CHECKIN_TABLE_MISSING_MESSAGE : "",
      },
      { headers: noStoreHeaders() }
    );
  } catch (err: any) {
    console.error("CHECKIN_SEARCH_ERROR:", err?.message || err);
    if (isCheckinTableMissingError(err)) {
      return NextResponse.json(
        {
          success: true,
          customers: [],
          message: normalizeCheckinErrorMessage(err, "Chưa có dữ liệu Check-in."),
        },
        { headers: noStoreHeaders() }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: normalizeCheckinErrorMessage(err, "Không tải được dữ liệu check-in."),
      },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireCheckinAccess(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => null);
    const id = String(body?.id || "").trim();
    const checkedIn = Boolean(body?.checkedIn);
    const customer = await setCustomerCheckin(id, checkedIn);

    return NextResponse.json(
      {
        success: true,
        customer,
        message: checkedIn ? "Đã check-in khách hàng." : "Đã bỏ check-in khách hàng.",
      },
      { headers: noStoreHeaders() }
    );
  } catch (err: any) {
    console.error("CHECKIN_UPDATE_ERROR:", err?.message || err);
    return NextResponse.json(
      {
        success: false,
        message: normalizeCheckinErrorMessage(err, "Không cập nhật được check-in."),
      },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
