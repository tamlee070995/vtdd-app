import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { findStaffByMaNV, getStaffRows } from "@/lib/staff-store";
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

const SHEET_NAME = "Data_Staff";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function redirectRegister(
  req: NextRequest,
  type: "error" | "success",
  message: string
) {
  const url = new URL("/register", req.url);
  url.searchParams.set(type, message);

  return NextResponse.redirect(url, { status: 303 });
}

function getSpreadsheetId() {
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("Thiếu SPREADSHEET_ID trong biến môi trường.");
  }

  return spreadsheetId;
}

function getGoogleAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Thiếu GOOGLE_CLIENT_EMAIL hoặc GOOGLE_PRIVATE_KEY trong biến môi trường.");
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: SCOPES,
  });
}

async function getSheetsClient() {
  return google.sheets({
    version: "v4",
    auth: getGoogleAuth(),
  });
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

async function appendStandbyAccount(data: {
  maNV: string;
  staffName: string;
  maST: string;
  passwordHash: string;
  encryptedQuestion: string;
  answerHash: string;
  encryptedGmail: string;
}) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME}!A:O`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          data.maNV, // A - MÃ NHÂN VIÊN
          data.staffName, // B - TÊN NHÂN VIÊN
          data.maST, // C - MÃ SIÊU THỊ
          "", // D - TÊN SIÊU THỊ
          "", // E - TÊN PHÒNG BAN
          data.passwordHash, // F - MẬT KHẨU
          data.encryptedQuestion, // G - CÂU HỎI BẢO MẬT
          data.answerHash, // H - CÂU TRẢ LỜI BẢO MẬT
          data.encryptedGmail, // I - GMAIL
          "Standby", // J - TRẠNG THÁI
          "", // K - RESET_OTP_HASH
          "", // L - RESET_OTP_EXPIRES
          "", // M - RESET_OTP_DAY
          "", // N - RESET_OTP_COUNT
          "1", // O - NEED_SETUP
        ],
      ],
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const maNV = normalizeCode(form.get("maNV"));
    const maST = normalizeCode(form.get("maST"));
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
      !maST ||
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
        "Vui lòng nhập đầy đủ Mã nhân viên, Mã siêu thị, Tên nhân viên, mật khẩu, câu hỏi bảo mật, câu trả lời và Gmail."
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

    await appendStandbyAccount({
      maNV,
      maST,
      staffName,
      passwordHash: hashPassword(password),
      encryptedQuestion: encryptText(question),
      answerHash: hashPassword(answer),
      encryptedGmail: encryptText(gmail),
    });

    try {
      await sendNewStaffAccountMail({
        maNV,
        staffName,
        gmail,
        adminUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://vienthongdidong.com"}/admin`,
      });

      console.log("SEND_NEW_STAFF_ACCOUNT_MAIL_OK", {
        maNV,
        maST,
        staffName,
        gmail,
      });
    } catch (mailErr) {
      console.error("SEND_NEW_STAFF_ACCOUNT_MAIL_ERROR", mailErr);
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
