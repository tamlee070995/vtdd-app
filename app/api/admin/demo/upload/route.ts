import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { isSameOriginRequest } from "@/lib/request-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const { response } = await requireAdminApi(req, { module: "demo", write: true });
  if (response) return response;
  if (!isSameOriginRequest(req)) return NextResponse.json({ success: false, message: "Yêu cầu không hợp lệ." }, { status: 403 });
  if (Number(req.headers.get("content-length") || 0) > 4300000) return NextResponse.json({ success: false, message: "Tệp tối đa 4MB. Với tệp lớn hơn, vui lòng dùng liên kết." }, { status: 413 });
  try {
    const data = await req.formData();
    const file = data.get("file");
    if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024) return NextResponse.json({ success: false, message: "Vui lòng chọn tệp từ 1 byte đến 4MB." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = file.name.toLowerCase().split(".").pop() || "";
    const header = Buffer.from(bytes.slice(0, 12));
    const image = (file.type === "image/png" && header.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
      || (["image/jpeg", "image/jpg"].includes(file.type) && header[0] === 255 && header[1] === 216)
      || (file.type === "image/webp" && header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP")
      || (file.type === "image/gif" && /^GIF8[79]a/.test(header.toString("ascii")));
    const document = (ext === "pdf" && header.toString("ascii", 0, 5) === "%PDF-")
      || (["zip", "apk", "docx", "xlsx"].includes(ext) && header[0] === 80 && header[1] === 75);
    if (!image && !document) return NextResponse.json({ success: false, message: "Hỗ trợ ảnh PNG/JPG/WebP/GIF và tệp PDF/ZIP/APK/DOCX/XLSX hợp lệ." }, { status: 400 });
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud || !apiKey || !secret) throw new Error("Chưa có cấu hình lưu tệp. Bạn vẫn có thể dán liên kết HTTPS.");
    const params = { folder: `${process.env.CLOUDINARY_FOLDER || "vtdd"}/demo`, public_id: `${randomUUID()}${image ? "" : "." + ext}`, timestamp: Math.floor(Date.now() / 1000) };
    const signature = createHash("sha1").update(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("&") + secret).digest("hex");
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", apiKey);
    form.append("signature", signature);
    Object.entries(params).forEach(([key, value]) => form.append(key, String(value)));
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${image ? "image" : "raw"}/upload`, { method: "POST", body: form });
    const result = await res.json();
    if (!res.ok || !result.secure_url) throw new Error(result.error?.message || "Không tải được tệp.");
    return NextResponse.json({ success: true, url: result.secure_url, location: result.secure_url, name: file.name, kind: image ? "image" : "file" });
  } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Không tải được tệp." }, { status: 500 }); }
}
