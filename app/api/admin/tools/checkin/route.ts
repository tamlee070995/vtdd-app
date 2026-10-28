import { NextResponse } from "next/server";
function retired() { return NextResponse.json({ success:false, code:"FEATURE_RETIRED", message:"Công cụ này đã ngừng sử dụng." }, { status:410, headers:{"Cache-Control":"no-store"} }); }
export const GET=retired; export const POST=retired; export const PATCH=retired; export const DELETE=retired;
