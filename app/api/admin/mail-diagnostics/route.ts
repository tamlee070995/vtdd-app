import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import {
  getMailDiagnosticsSnapshot,
  getPublicMailError,
  sendDiagnosticMail,
  verifyMailConnection,
} from "@/lib/mail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeEmail(value: any) {
  const email = String(value || "").trim().toLowerCase().replace(/^mailto:/i, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

export async function GET(req: NextRequest) {
  const { response } = await requireAdminApi(req, { module: "tcdm", action: "settings-write" });
  if (response) return response;

  try {
    const url = new URL(req.url);
    const shouldSend = url.searchParams.get("send") === "1";
    const to = normalizeEmail(url.searchParams.get("to") || "tamlee070995@gmail.com");

    if (shouldSend) {
      if (!to) {
        return NextResponse.json(
          { success: false, message: "Email nhận test chưa đúng định dạng." },
          { status: 400 }
        );
      }

      const report = await sendDiagnosticMail(to);

      return NextResponse.json({
        success: true,
        message: `Đã gửi email test đến ${to}.`,
        config: getMailDiagnosticsSnapshot(),
        report,
      });
    }

    const verify = await verifyMailConnection();

    return NextResponse.json({
      success: true,
      config: getMailDiagnosticsSnapshot(),
      verify,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        config: getMailDiagnosticsSnapshot(),
        message: getPublicMailError(err),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { response } = await requireAdminApi(req, { module: "tcdm", action: "settings-write" });
  if (response) return response;

  try {
    const body = await req.json().catch(() => ({}));
    const to = normalizeEmail(body.to || "tamlee070995@gmail.com");

    if (!to) {
      return NextResponse.json(
        { success: false, message: "Email nhận test chưa đúng định dạng." },
        { status: 400 }
      );
    }

    const report = await sendDiagnosticMail(to);

    return NextResponse.json({
      success: true,
      message: `Đã gửi email test đến ${to}.`,
      config: getMailDiagnosticsSnapshot(),
      report,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        config: getMailDiagnosticsSnapshot(),
        message: getPublicMailError(err),
      },
      { status: 500 }
    );
  }
}
