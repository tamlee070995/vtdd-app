import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaffFromRequest } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

function hideEncryptedLeak(value: unknown) {
  const text = String(value || "").trim();
  return text.startsWith("enc:v1:") ? "" : text;
}

export async function GET(req: NextRequest) {
  try {
    const currentStaff = await getCurrentStaffFromRequest(req);

    if (!currentStaff) {
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập nhân viên." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: {
        maNV: currentStaff.maNV,
        maST: currentStaff.maST,
        staffName: currentStaff.staffName,
        storeName: currentStaff.storeName,
        department: currentStaff.department,
        securityQuestion: hideEncryptedLeak(currentStaff.securityQuestion),
        gmail: hideEncryptedLeak(currentStaff.gmail),
        forceSetup: currentStaff.forceSetup,
        mustChangePassword: currentStaff.mustChangePassword,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không tải được thông tin cá nhân." },
      { status: 500 }
    );
  }
}
