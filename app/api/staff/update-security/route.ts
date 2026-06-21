import { NextRequest, NextResponse } from "next/server";
import { updateStaffSecurity } from "@/lib/staff-store";
import { getCurrentStaffFromRequest, setStaffSessionCookies } from "@/lib/staff-auth";
import {
  decryptText,
  encryptText,
  hashPassword,
  isDefaultPasswordStored,
  normalizeText,
  verifyPassword,
} from "@/lib/staff-security";

export const dynamic = "force-dynamic";

function isGmail(value: string) {
  return /^[^\s@]+@gmail\.com$/i.test(value);
}

function isStrongEnough(password: string) {
  if (password.length < 6) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[!@#]/.test(password)) return false;
  return true;
}

function safeDecrypt(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    return decryptText(raw) || raw;
  } catch {
    return raw;
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentStaff = await getCurrentStaffFromRequest(req);

    if (!currentStaff) {
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập nhân viên." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { success: false, message: "Dữ liệu gửi lên không hợp lệ." },
        { status: 400 }
      );
    }

    const currentPassword = normalizeText(body.currentPassword);
    const newPassword = normalizeText(body.newPassword);
    const confirmPassword = normalizeText(body.confirmPassword);
    const question = normalizeText(body.question);
    const answer = normalizeText(body.answer);
    const gmail = normalizeText(body.gmail).toLowerCase();

    // Fix lỗi cũ: client có gửi mật khẩu mới nhưng thiếu flag changePassword thì server không đổi mật khẩu.
    const changePassword =
      body.changePassword === true || Boolean(newPassword) || Boolean(confirmPassword);

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

    if (!isGmail(gmail)) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập đúng Gmail cá nhân, ví dụ: ten@gmail.com." },
        { status: 400 }
      );
    }

    const staff = currentStaff.staff;

    if (!verifyPassword(currentPassword, staff.password)) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu hiện tại không đúng." },
        { status: 401 }
      );
    }

    const hasOldPlainPassword = !String(staff.password || "").startsWith("pwd:v1:");
    const hasSecurityQuestion = Boolean(safeDecrypt(staff.securityQuestion));
    const hasGmail = Boolean(safeDecrypt(staff.gmail));

    const forceSetup =
      currentStaff.forceSetup ||
      staff.needSetup === "1" ||
      isDefaultPasswordStored(staff.password) ||
      hasOldPlainPassword ||
      !hasSecurityQuestion ||
      !hasGmail ||
      !staff.securityAnswer;

    let passwordHash = staff.password;

    if (changePassword) {
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

      if (!isStrongEnough(newPassword)) {
        return NextResponse.json(
          {
            success: false,
            message: "Mật khẩu mới tối thiểu 6 ký tự, gồm chữ hoa, chữ thường, số và ký tự ! @ #.",
          },
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
      maNV: staff.maNV,
      passwordHash,
      encryptedQuestion: encryptText(question),
      answerHash,
      encryptedGmail: encryptText(gmail),
      needSetup: "0",
    });

    const res = NextResponse.json({
      success: true,
      changedPassword: changePassword,
      message:
        changePassword
          ? "Đã cập nhật thông tin và đổi mật khẩu thành công. Lần đăng nhập sau hãy dùng mật khẩu mới."
          : "Đã cập nhật thông tin cá nhân thành công.",
    });

    setStaffSessionCookies(res, {
      maNV: staff.maNV,
      maST: staff.maST,
      staffName: staff.staffName || "Nhân viên",
      storeName: staff.storeName || "",
      department: staff.department || "",
      gmail,
      forceSetup: false,
    });

    return res;
  } catch (err: any) {
    console.error("STAFF_UPDATE_SECURITY_ERROR:", err);

    return NextResponse.json(
      { success: false, message: err?.message || "Không cập nhật được thông tin." },
      { status: 500 }
    );
  }
}
