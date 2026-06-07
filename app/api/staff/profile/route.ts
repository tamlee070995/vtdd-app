import { NextRequest, NextResponse } from "next/server";
import { findStaffByMaNV } from "@/lib/staff-store";
import { decryptText, normalizeCode } from "@/lib/staff-security";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const maNV = normalizeCode(req.cookies.get("vtdd_staff_nv")?.value || "");

    if (!maNV) {
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập nhân viên." },
        { status: 401 }
      );
    }

    const staff = await findStaffByMaNV(maNV);

    if (!staff) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy tài khoản nhân viên." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: {
        maNV: staff.maNV,
        maST: staff.maST,
        staffName: staff.staffName,
        storeName: staff.storeName,
        department: staff.department,
        securityQuestion: decryptText(staff.securityQuestion),
        gmail: decryptText(staff.gmail),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không tải được thông tin cá nhân." },
      { status: 500 }
    );
  }
}
