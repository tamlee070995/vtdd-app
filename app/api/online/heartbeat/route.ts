import { NextRequest, NextResponse } from "next/server";
import { removeOnlineSession, touchOnlineSession } from "@/lib/online-store";

export const dynamic = "force-dynamic";

function clean(value: any) {
  return String(value ?? "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const page = clean(body.page);
    const visitorId = clean(body.visitorId);
    const eventType = clean(body.eventType || "heartbeat");

    if (!page || !visitorId) {
      return NextResponse.json(
        {
          success: false,
          message: "Thiếu page hoặc visitorId.",
        },
        { status: 400 }
      );
    }

    const online =
      eventType === "leave"
        ? removeOnlineSession({ page, visitorId })
        : touchOnlineSession({
            page,
            visitorId,
            userAgent: req.headers.get("user-agent") || "",
          });

    return NextResponse.json({
      success: true,
      online,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Không ghi nhận được trạng thái online.",
      },
      { status: 500 }
    );
  }
}
