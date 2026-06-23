import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createSignedSessionToken, verifySignedSessionToken } from "@/lib/auth-session";
import { decryptText, isDefaultPasswordStored } from "@/lib/staff-security";
import { findStaffByMaNV, type StaffRow } from "@/lib/staff-store";

export const STAFF_SESSION_COOKIE = "vtdd_staff_session";

export const STAFF_COOKIES = [
  STAFF_SESSION_COOKIE,
  "vtdd_staff_nv",
  "vtdd_staff_st",
  "vtdd_staff_name",
  "vtdd_staff_store_name",
  "vtdd_staff_department",
  "vtdd_staff_gmail",
  "vtdd_staff_force_setup",
];

const STAFF_SESSION_MAX_AGE = 60 * 60 * 12;
const LEGACY_STAFF_IDENTITY_COOKIES = STAFF_COOKIES.filter((name) => name !== STAFF_SESSION_COOKIE);

type StaffSessionData = {
  maST?: string;
  staffName?: string;
};

export type CurrentStaffSession = {
  maNV: string;
  maST: string;
  staffName: string;
  storeName: string;
  department: string;
  gmail: string;
  securityQuestion: string;
  forceSetup: boolean;
  mustChangePassword: boolean;
  staff: StaffRow;
};

function safeDecrypt(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const decrypted = decryptText(raw);
    if (decrypted) return decrypted;
    return raw.startsWith("enc:v1:") ? "" : raw;
  } catch {
    return raw.startsWith("enc:v1:") ? "" : raw;
  }
}

function hasConfiguredSecureValue(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (raw.startsWith("enc:v1:")) return raw.split(":").length >= 5;
  return true;
}

export function shouldForceStaffSetup(staff: StaffRow, gmail: string, securityQuestion: string) {
  const needSetupFlag = String(staff.needSetup || "").trim().toLowerCase();
  const needSetupByFlag = needSetupFlag === "1" || needSetupFlag === "true" || needSetupFlag === "yes";
  const hasGmail = Boolean(gmail) || hasConfiguredSecureValue(staff.gmail);
  const hasSecurityQuestion = Boolean(securityQuestion) || hasConfiguredSecureValue(staff.securityQuestion);
  const hasSecurityAnswer = Boolean(String(staff.securityAnswer || "").trim());
  const needSetupByMissingSecurity = !hasGmail || !hasSecurityQuestion || !hasSecurityAnswer;
  const needSetupByFlagStillRelevant = needSetupByFlag && needSetupByMissingSecurity;

  return (
    needSetupByFlagStillRelevant ||
    needSetupByMissingSecurity ||
    shouldForceStaffPasswordChange(staff)
  );
}

function hasOldPlainPassword(staff: StaffRow) {
  const raw = String(staff.password || "").trim();
  return Boolean(raw) && !raw.startsWith("pwd:v1:");
}

export function shouldForceStaffPasswordChange(staff: StaffRow) {
  return isDefaultPasswordStored(staff.password) || hasOldPlainPassword(staff);
}

function clearCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function setStaffSessionCookies(
  res: NextResponse,
  data: {
    maNV: string;
    maST: string;
    staffName: string;
    storeName?: string;
    department?: string;
    gmail?: string;
    forceSetup?: boolean;
  }
) {
  const sessionToken = createSignedSessionToken<StaffSessionData>(
    "staff",
    data.maNV,
    STAFF_SESSION_MAX_AGE
  );

  res.cookies.set(STAFF_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STAFF_SESSION_MAX_AGE,
  });

  LEGACY_STAFF_IDENTITY_COOKIES.forEach((name) => clearCookie(res, name));
}

export function clearStaffSessionCookies(res: NextResponse) {
  for (const name of STAFF_COOKIES) {
    res.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

async function buildCurrentStaff(maNV: string) {
  const staff = await findStaffByMaNV(maNV);

  if (!staff) return null;
  if (String(staff.status || "").trim().toLowerCase() !== "active") return null;
  if (!staff.maST) return null;

  const gmail = safeDecrypt(staff.gmail);
  const securityQuestion = safeDecrypt(staff.securityQuestion);

  return {
    maNV: staff.maNV,
    maST: staff.maST,
    staffName: staff.staffName || "Nhân viên",
    storeName: staff.storeName || "",
    department: staff.department || "",
    gmail,
    securityQuestion,
    forceSetup: shouldForceStaffSetup(staff, gmail, securityQuestion),
    mustChangePassword: shouldForceStaffPasswordChange(staff),
    staff,
  };
}

export async function getCurrentStaffFromRequest(req: NextRequest) {
  const token = req.cookies.get(STAFF_SESSION_COOKIE)?.value || "";
  const payload = verifySignedSessionToken<StaffSessionData>(token, "staff");

  if (!payload) return null;

  return buildCurrentStaff(payload.sub);
}

export async function getCurrentStaffFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value || "";
  const payload = verifySignedSessionToken<StaffSessionData>(token, "staff");

  if (!payload) return null;

  const current = await buildCurrentStaff(payload.sub);

  return current;
}
