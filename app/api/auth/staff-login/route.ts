import { NextRequest, NextResponse } from "next/server";
import {
  decryptText,
  normalizeCode,
  normalizeText,
  verifyPassword,
} from "@/lib/staff-security";
import {
  clearStaffSessionCookies,
  setStaffSessionCookies,
  shouldForceStaffSetup,
} from "@/lib/staff-auth";
import { findStaffByMaNV } from "@/lib/staff-store";

export const dynamic = "force-dynamic";

function redirectLogin(req: NextRequest, message: string) {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", message);

  const res = NextResponse.redirect(url, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
    },
  });

  clearStaffSessionCookies(res);
  return res;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const maNV = normalizeCode(form.get("maNV"));
    const password = normalizeText(form.get("password"));

    if (!maNV || !password) {
      return redirectLogin(req, "Vui lòng nhập Mã nhân viên và Mật khẩu.");
    }

    const staff = await findStaffByMaNV(maNV);

    if (!staff) {
      return redirectLogin(
        req,
        "Tài khoản chưa tồn tại trên hệ thống. Vui lòng kiểm tra lại mã nhân viên hoặc tạo tài khoản mới."
      );
    }

    if (String(staff.status || "").toLowerCase() === "standby") {
      return redirectLogin(
        req,
        "Tài khoản chưa được duyệt sử dụng, vui lòng liên hệ Admin."
      );
    }

    if (!verifyPassword(password, staff.password)) {
      return redirectLogin(req, "Mật khẩu không đúng. Vui lòng kiểm tra lại.");
    }

    if (!staff.maST) {
      return redirectLogin(
        req,
        "Tài khoản chưa có Mã siêu thị, vui lòng liên hệ Admin."
      );
    }

    const gmail = decryptText(staff.gmail);
    const securityQuestion = decryptText(staff.securityQuestion);
    const forceSetup = shouldForceStaffSetup(staff, gmail, securityQuestion);

    const url = new URL("/staff", req.url);

    const res = NextResponse.redirect(url, {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
      },
    });

    setStaffSessionCookies(res, {
      maNV: staff.maNV,
      maST: staff.maST,
      staffName: staff.staffName || "Nhân viên",
      storeName: staff.storeName || "",
      department: staff.department || "",
      gmail: gmail || "",
      forceSetup,
    });

    return res;
  } catch (err: any) {
    return redirectLogin(
      req,
      "Lỗi hệ thống đăng nhập: " + (err?.message || "Không xác thực được.")
    );
  }
}
