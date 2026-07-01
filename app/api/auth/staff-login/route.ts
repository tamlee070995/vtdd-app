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
import { checkFirewallUserAccess, getClientIpFromHeaders } from "@/lib/firewall";
import { findStaffByMaNV, staffHasCheckinToolAccess } from "@/lib/staff-store";
import { getSystemSettings } from "@/lib/system-store";

export const dynamic = "force-dynamic";

type LoginPayload = {
  maNV: string;
  password: string;
  nextPath: string;
  wantsJson: boolean;
};

function getSafeNextPath(req: NextRequest, nextValue?: unknown) {
  const fromBody = typeof nextValue === "string" ? nextValue.trim() : "";
  const fromQuery = new URL(req.url).searchParams.get("next") || "";
  const raw = fromBody || fromQuery;

  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/staff";
  }

  try {
    const target = new URL(raw, req.url);
    const current = new URL(req.url);
    if (target.origin !== current.origin) {
      return "/staff";
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/staff";
  }
}

function redirectLogin(
  req: NextRequest,
  message: string,
  nextPath?: string,
  wantsJson = false,
  status = 400
) {
  if (wantsJson) {
    const res = NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

    clearStaffSessionCookies(res);
    return res;
  }

  const url = new URL("/login", req.url);
  url.searchParams.set("error", message);
  if (nextPath && nextPath !== "/staff") {
    url.searchParams.set("next", nextPath);
  }

  const res = NextResponse.redirect(url, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
    },
  });

  clearStaffSessionCookies(res);
  return res;
}

async function readLoginPayload(req: NextRequest): Promise<LoginPayload> {
  const contentType = req.headers.get("content-type") || "";
  const accept = req.headers.get("accept") || "";
  const acceptsJson = accept.toLowerCase().includes("application/json");

  if (contentType.toLowerCase().includes("application/json")) {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    return {
      maNV: normalizeCode(body?.maNV),
      password: normalizeText(body?.password),
      nextPath: getSafeNextPath(req, body?.next),
      wantsJson: true,
    };
  }

  const form = await req.formData();

  return {
    maNV: normalizeCode(form.get("maNV")),
    password: normalizeText(form.get("password")),
    nextPath: getSafeNextPath(req, form.get("next")),
    wantsJson: acceptsJson,
  };
}

function isCheckinNextPath(nextPath: string) {
  return (
    nextPath === "/cong-cu-ho-tro/check-in" ||
    nextPath.startsWith("/cong-cu-ho-tro/check-in?")
  );
}

export async function POST(req: NextRequest) {
  let nextPath = getSafeNextPath(req);
  let wantsJson = false;

  try {
    const payload = await readLoginPayload(req);
    nextPath = payload.nextPath;
    wantsJson = payload.wantsJson;

    const maNV = payload.maNV;
    const password = payload.password;

    if (!maNV || !password) {
      return redirectLogin(req, "Vui lòng nhập Mã nhân viên và Mật khẩu.", nextPath, wantsJson);
    }

    const staff = await findStaffByMaNV(maNV);

    if (!staff) {
      return redirectLogin(
        req,
        "Tài khoản chưa tồn tại trên hệ thống. Vui lòng kiểm tra lại mã nhân viên hoặc tạo tài khoản mới và liên hệ admin duyệt để sử dụng.",
        nextPath,
        wantsJson,
        404
      );
    }

    if (String(staff.status || "").toLowerCase() === "standby") {
      return redirectLogin(
        req,
        "Tài khoản chưa được duyệt sử dụng, vui lòng liên hệ Admin.",
        nextPath,
        wantsJson,
        403
      );
    }

    if (!verifyPassword(password, staff.password)) {
      return redirectLogin(req, "Mật khẩu không đúng. Vui lòng kiểm tra lại.", nextPath, wantsJson, 401);
    }

    if (!isCheckinNextPath(nextPath)) {
      const settings = await getSystemSettings();
      const userFirewall = checkFirewallUserAccess(
        settings,
        staff.maNV,
        getClientIpFromHeaders(req.headers)
      );

      if (!userFirewall.allowed) {
        return redirectLogin(req, userFirewall.reason, nextPath, wantsJson, 403);
      }
    }

    if (!staff.maST) {
      return redirectLogin(
        req,
        "Tài khoản chưa có Mã siêu thị, vui lòng liên hệ Admin.",
        nextPath,
        wantsJson,
        403
      );
    }

    if (isCheckinNextPath(nextPath) && !staffHasCheckinToolAccess(staff)) {
      return redirectLogin(
        req,
        "Tài khoản chưa được Admin cấp quyền dùng công cụ Check-in.",
        nextPath,
        wantsJson,
        403
      );
    }

    const gmail = decryptText(staff.gmail);
    const securityQuestion = decryptText(staff.securityQuestion);
    const forceSetup = shouldForceStaffSetup(staff, gmail, securityQuestion);

    const url = new URL(nextPath, req.url);

    const res = wantsJson
      ? NextResponse.json(
          {
            success: true,
            redirectTo: `${url.pathname}${url.search}${url.hash}`,
          },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          }
        )
      : NextResponse.redirect(url, {
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
    console.error("STAFF_LOGIN_ERROR:", err?.message || err);
    return redirectLogin(
      req,
      "Lỗi hệ thống đăng nhập. Vui lòng thử lại sau.",
      nextPath,
      wantsJson,
      500
    );
  }
}
