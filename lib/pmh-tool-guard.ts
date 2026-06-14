import { NextResponse } from "next/server";
import { getSystemSettings } from "@/lib/system-store";
import { getPmhToolAvailability, type ToolAvailability } from "@/lib/tool-settings";

export async function getCurrentPmhToolAvailability() {
  const settings = await getSystemSettings();
  return getPmhToolAvailability(settings);
}

export function getPmhToolClosedMessage(availability: ToolAvailability) {
  return availability.reason || "Công cụ PMH/Pincode đang tạm đóng theo cài đặt Admin.";
}

export function pmhToolClosedJson(
  availability: ToolAvailability,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    {
      success: false,
      code: "PMH_TOOL_CLOSED",
      message: getPmhToolClosedMessage(availability),
      tool: availability,
      ...extra,
    },
    { status: 423 }
  );
}
