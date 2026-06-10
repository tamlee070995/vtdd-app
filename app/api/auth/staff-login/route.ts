import { NextRequest, NextResponse } from "next/server";
import {
  decryptText,
  isDefaultPasswordStored,
  normalizeCode,
  normalizeText,
  verifyPassword,
} from "@/lib/staff-security";
import { findStaffByMaNV } from "@/lib/staff-store";

const STAFF_COOKIES = [
  "vtdd_staff_nv",
  "vtdd_staff_st",
  "vtdd_staff_name",
  "vtdd_staff_store_name",
  "vtdd_staff_department",
  "vtdd_staff_gmail",
  "vtdd_staff_force_setup",
];

export const dynamic = "force-dynamic";

function clearStaffCookies(res: NextResponse) {
  STAFF_COOKIES.forEach((name) => {
    res.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  });
}

function setCookie(res: NextResponse, name: string, value: string) {
  res.cookies.set(name, encodeURIComponent(value || ""), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

function redirectLogin(req: NextRequest, message: string) {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", message);

  const res = NextResponse.redirect(url, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
    },
  });

  clearStaffCookies(res);
  return res;
}

function shouldForceSetup(staff: any, gmail: string, securityQuestion: string) {
  const needSetupFlag = String(staff.needSetup || "").trim().toLowerCase();

  const needSetupByFlag =
    needSetupFlag === "1" ||
    needSetupFlag === "true" ||
    needSetupFlag === "yes";

  const needSetupByOldDefaultPassword = isDefaultPasswordStored(staff.password);

  const needSetupByMissingSecurity =
    !gmail ||
    !securityQuestion ||
    !staff.securityAnswer;

  const needSetupByOldPlainPassword =
    !String(staff.password || "").startsWith("pwd:v1:");

  return (
    needSetupByFlag ||
    needSetupByOldDefaultPassword ||
    needSetupByMissingSecurity ||
    needSetupByOldPlainPassword
  );
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
    const forceSetup = shouldForceSetup(staff, gmail, securityQuestion);

    const url = new URL("/staff", req.url);

    const res = NextResponse.redirect(url, {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
      },
    });

    setCookie(res, "vtdd_staff_nv", staff.maNV);
    setCookie(res, "vtdd_staff_st", staff.maST);
    setCookie(res, "vtdd_staff_name", staff.staffName || "Nhân viên");
    setCookie(res, "vtdd_staff_store_name", staff.storeName || "");
    setCookie(res, "vtdd_staff_department", staff.department || "");
    setCookie(res, "vtdd_staff_gmail", gmail || "");
    setCookie(res, "vtdd_staff_force_setup", forceSetup ? "1" : "0");

    return res;
  } catch (err: any) {
    return redirectLogin(
      req,
      "Lỗi hệ thống đăng nhập: " + (err?.message || "Không xác thực được.")
    );
  }
}