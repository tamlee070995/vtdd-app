import { NextRequest, NextResponse } from "next/server";
import { findStaffByMaNV, updateStaffNeedSetup, updateStaffSecurity } from "@/lib/staff-store";
import {
  decryptText,
  encryptText,
  hashPassword,
  isDefaultPasswordStored,
  normalizeText,
  verifyPassword,
} from "@/lib/staff-security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const maNV = req.cookies.get("vtdd_staff_nv")?.value || "";

    if (!maNV) {
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập nhân viên." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const currentPassword = normalizeText(body.currentPassword);
    const changePassword = body.changePassword === true;
    const newPassword = normalizeText(body.newPassword);
    const confirmPassword = normalizeText(body.confirmPassword);
    const question = normalizeText(body.question);
    const answer = normalizeText(body.answer);
    const gmail = normalizeText(body.gmail);

    if (!currentPassword) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập mật khẩu hiện tại để xác thực." },
        { status: 400 }
      );
    }

    if (!question || !gmail) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập Gmail và câu hỏi bảo mật." },
        { status: 400 }
      );
    }

    if (!gmail.toLowerCase().endsWith("@gmail.com")) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập đúng địa chỉ Gmail." },
        { status: 400 }
      );
    }

    const staff = await findStaffByMaNV(maNV);

    if (!staff) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy tài khoản nhân viên." },
        { status: 404 }
      );
    }

    if (!verifyPassword(currentPassword, staff.password)) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu hiện tại không đúng." },
        { status: 401 }
      );
    }

    const forceSetup =
      req.cookies.get("vtdd_staff_force_setup")?.value === "1" ||
      isDefaultPasswordStored(staff.password) ||
      !String(staff.password || "").startsWith("pwd:v1:") ||
      !decryptText(staff.securityQuestion) ||
      !decryptText(staff.gmail) ||
      !staff.securityAnswer;

    let passwordHash = staff.password;

    if (forceSetup || changePassword) {
      if (!newPassword || !confirmPassword) {
        return NextResponse.json(
          { success: false, message: "Vui lòng nhập mật khẩu mới và xác nhận mật khẩu mới." },
          { status: 400 }
        );
      }

      if (newPassword !== confirmPassword) {
        return NextResponse.json(
          { success: false, message: "Mật khẩu xác nhận không khớp." },
          { status: 400 }
        );
      }

      if (newPassword === currentPassword) {
        return NextResponse.json(
          { success: false, message: "Mật khẩu mới không được trùng mật khẩu hiện tại." },
          { status: 400 }
        );
      }

      if (newPassword === (process.env.DEFAULT_STAFF_PASSWORD || "123123")) {
        return NextResponse.json(
          { success: false, message: "Không được sử dụng mật khẩu mặc định 123123." },
          { status: 400 }
        );
      }

      passwordHash = hashPassword(newPassword);
    }

    let answerHash = staff.securityAnswer;

    if (forceSetup || answer) {
      if (!answer) {
        return NextResponse.json(
          { success: false, message: "Vui lòng nhập câu trả lời bảo mật." },
          { status: 400 }
        );
      }

      answerHash = hashPassword(answer);
    }

    await updateStaffSecurity(staff.rowNumber, {
      passwordHash,
      encryptedQuestion: encryptText(question),
      answerHash,
      encryptedGmail: encryptText(gmail),
    });
    await updateStaffNeedSetup(staff.rowNumber, "0");

    const res = NextResponse.json({
      success: true,
      message: forceSetup || changePassword
        ? "Đã cập nhật thông tin và đổi mật khẩu thành công."
        : "Đã cập nhật thông tin cá nhân thành công.",
    });

    res.cookies.set("vtdd_staff_force_setup", "0", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 12,
        });
    return res;

    res.cookies.set("vtdd_staff_force_setup", "0", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    res.cookies.set("vtdd_staff_gmail", encodeURIComponent(gmail), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không cập nhật được thông tin." },
      { status: 500 }
    );
  }
}
