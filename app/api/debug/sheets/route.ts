import { NextResponse } from "next/server";
import { readSheetRange } from "@/lib/sheets";

export async function GET() {
  try {
    const rows = await readSheetRange("Usdb!A2:C6");

    return NextResponse.json({
      success: true,
      message: "Kết nối Google Sheet OK",
      rowCount: rows.length,
      sample: rows,
    });
  } catch (err: any) {
    console.error("debug sheets error:", err);

    return NextResponse.json({
      success: false,
      message: err?.message || "Không đọc được Google Sheet",
    });
  }
}