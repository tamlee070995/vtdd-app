import { NextRequest, NextResponse } from "next/server";
import {
  createStandbyAccount,
  findStaffByMaNV,
  getStaffRows,
} from "@/lib/staff-store";
import {
  decryptText,
  encryptText,
  hashPassword,
  normalizeCode,
  normalizeText,
} from "@/lib/staff-security";
import { verifyCaptchaAnswer } from "@/lib/captcha";
import { sendNewStaffAccountMail } from "@/lib/mail";

export const dynamic = "force-dynamic";

function redirectRegister(
  req: NextRequest,
  type: "error" | "success",
  message: string
) {
  const url = new URL("/register", req.url);
  url.searchParams.set(type, message);

  return NextResponse.redirect(url, { status: 303 });
}

function checkPasswordRule(password: string) {
  if (password.length < 6) {
    return "Mật khẩu phải có ít nhất 6 ký tự.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Mật khẩu phải có ít nhất 1 ký tự viết HOA.";
  }

  if (!/[a-z]/.test(password)) {
    return "Mật khẩu phải có ít nhất 1 ký tự viết thường.";
  }

  if (!/[0-9]/.test(password)) {
    return "Mật khẩu phải có ít nhất 1 số.";
  }

  if (!/[!@#]/.test(password)) {
    return "Mật khẩu phải có ít nhất 1 ký tự đặc biệt: !, @ hoặc #.";
  }

  return "";
}

function checkGmailRule(gmail: string) {
  const value = String(gmail || "").trim().toLowerCase();

  if (!value) {
    return "Vui lòng nhập Gmail xác thực.";
  }

  if (value.includes(" ")) {
    return "Gmail không được có khoảng trắng.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Gmail chưa đúng định dạng.";
  }

  if (!value.endsWith("@gmail.com")) {
    return "Gmail xác thực phải là địa chỉ @gmail.com.";
  }

  return "";
}

function titleCaseVietnameseName(value: string) {
  const clean = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi-VN");

  if (!clean) return "";

  return clean.replace(
    /(^|[\s'-])(\p{L})/gu,
    (_match, prefix: string, char: string) => {
      return prefix + char.toLocaleUpperCase("vi-VN");
    }
  );
}

function normalizeGmailForCompare(value: string) {
  return String(value || "").trim().toLowerCase();
}

function safeDecryptGmail(value: string) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  try {
    const decrypted = decryptText(raw);
    return decrypted || raw;
  } catch {
    return raw;
  }
}

async function isGmailAlreadyUsed(gmail: string) {
  const targetGmail = normalizeGmailForCompare(gmail);
  const rows = await getStaffRows();

  return rows.some((staff) => {
    const staffGmail = normalizeGmailForCompare(safeDecryptGmail(staff.gmail));
    return staffGmail === targetGmail;
  });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const maNV = normalizeCode(form.get("maNV"));
    const staffNameRaw = normalizeText(form.get("staffName"));
    const staffName = titleCaseVietnameseName(staffNameRaw);

    const password = normalizeText(form.get("password"));
    const confirmPassword = normalizeText(form.get("confirmPassword"));

    const questionType = normalizeText(form.get("questionType"));
    const customQuestion = normalizeText(form.get("customQuestion"));
    const answer = normalizeText(form.get("answer"));
    const gmail = normalizeText(form.get("gmail")).toLowerCase();

    const captchaToken = normalizeText(form.get("captchaToken"));
    const captchaAnswer = normalizeText(form.get("captchaAnswer"));

    const captchaOK = verifyCaptchaAnswer(captchaToken, captchaAnswer);

    if (!captchaOK) {
      return redirectRegister(
        req,
        "error",
        "Captcha không đúng hoặc đã hết hạn. Vui lòng thử lại."
      );
    }

    const question = questionType === "custom" ? customQuestion : questionType;

    if (
      !maNV ||
      !staffName ||
      !password ||
      !confirmPassword ||
      !question ||
      !answer ||
      !gmail
    ) {
      return redirectRegister(
        req,
        "error",
        "Vui lòng nhập đầy đủ Mã nhân viên, Tên nhân viên, mật khẩu, câu hỏi bảo mật, câu trả lời và Gmail."
      );
    }

    const passwordRuleError = checkPasswordRule(password);

    if (passwordRuleError) {
      return redirectRegister(req, "error", passwordRuleError);
    }

    if (password !== confirmPassword) {
      return redirectRegister(req, "error", "Mật khẩu xác nhận chưa khớp.");
    }

    const gmailRuleError = checkGmailRule(gmail);

    if (gmailRuleError) {
      return redirectRegister(req, "error", gmailRuleError);
    }

    const existedStaff = await findStaffByMaNV(maNV);

    if (existedStaff) {
      return redirectRegister(
        req,
        "error",
        "Mã nhân viên này đã tồn tại trên hệ thống."
      );
    }

    const gmailUsed = await isGmailAlreadyUsed(gmail);

    if (gmailUsed) {
      return redirectRegister(
        req,
        "error",
        "Gmail này đã được dùng để tạo tài khoản khác. Vui lòng sử dụng Gmail khác."
      );
    }

    await createStandbyAccount({
      maNV,
      staffName,
      passwordHash: hashPassword(password),
      encryptedQuestion: encryptText(question),
      answerHash: hashPassword(answer),
      encryptedGmail: encryptText(gmail),
    });

    try {
      await sendNewStaffAccountMail({
        staffName,
        maNV,
        gmail,
        adminUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://vtdd.online"}/admin`,
      });
    } catch (mailErr) {
      console.warn("SEND_NEW_STAFF_MAIL_ERROR:", mailErr);
    }

    return redirectRegister(
      req,
      "success",
      "Đã tạo tài khoản chờ duyệt. Vui lòng liên hệ Admin để được kích hoạt."
    );
  } catch (err: any) {
    return redirectRegister(
      req,
      "error",
      "Lỗi tạo tài khoản: " + (err?.message || "Không tạo được.")
    );
  }
}