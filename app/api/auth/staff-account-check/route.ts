import { NextRequest, NextResponse } from "next/server";
import { findStaffByMaNV } from "@/lib/staff-store";
import { normalizeCode } from "@/lib/staff-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeStaffUser(value: any) {
  return normalizeCode(value).replace(/^NV/i, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const maNV = normalizeStaffUser(body.user || body.maNV);

    if (!maNV) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập mã user cần kiểm tra." },
        { status: 400 }
      );
    }

    const staff = await findStaffByMaNV(maNV);

    return NextResponse.json({
      success: true,
      exists: Boolean(staff),
      maNV,
    });
  } catch (err: any) {
    console.error("STAFF_ACCOUNT_CHECK_ERROR:", err?.message || err);
    return NextResponse.json(
      { success: false, message: "Không kiểm tra được tài khoản. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
