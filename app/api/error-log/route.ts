import { NextRequest, NextResponse } from "next/server";
import { appendErrorLog, getClientIpFromRequest } from "@/lib/ops-store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    await appendErrorLog({
      actor: body?.actor || "client",
      page: body?.page || req.headers.get("referer") || "",
      module: body?.module || "frontend",
      message: body?.message || "",
      stack: body?.stack || "",
      ip: getClientIpFromRequest(req),
      userAgent: req.headers.get("user-agent") || "",
      severity: body?.severity === "warn" || body?.severity === "info" ? body.severity : "error",
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
