import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createSignedSessionToken, verifySignedSessionToken } from "@/lib/auth-session";
import { decryptText } from "@/lib/staff-security";
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
  staff: StaffRow;
};

function safeDecrypt(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    return decryptText(raw) || raw;
  } catch {
    return raw;
  }
}

export function shouldForceStaffSetup(staff: StaffRow, gmail: string, securityQuestion: string) {
  const needSetupFlag = String(staff.needSetup || "").trim().toLowerCase();
  const needSetupByFlag = needSetupFlag === "1" || needSetupFlag === "true" || needSetupFlag === "yes";
  const needSetupByMissingSecurity = !gmail || !securityQuestion || !staff.securityAnswer;

  return (
    needSetupByFlag ||
    needSetupByMissingSecurity
  );
}

function setCookie(res: NextResponse, name: string, value: string, maxAge = STAFF_SESSION_MAX_AGE) {
  res.cookies.set(name, encodeURIComponent(value || ""), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
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
    STAFF_SESSION_MAX_AGE,
    {
      maST: data.maST,
      staffName: data.staffName,
    }
  );

  res.cookies.set(STAFF_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STAFF_SESSION_MAX_AGE,
  });

  setCookie(res, "vtdd_staff_nv", data.maNV);
  setCookie(res, "vtdd_staff_st", data.maST);
  setCookie(res, "vtdd_staff_name", data.staffName || "Nhân viên");
  setCookie(res, "vtdd_staff_store_name", data.storeName || "");
  setCookie(res, "vtdd_staff_department", data.department || "");
  setCookie(res, "vtdd_staff_gmail", data.gmail || "");
  setCookie(res, "vtdd_staff_force_setup", data.forceSetup ? "1" : "0");
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
