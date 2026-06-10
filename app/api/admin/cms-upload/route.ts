import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { requireAdminApi, type AdminModuleKey } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CMS_MODULES = new Set(["quy-trinh-thu-cu", "may-moi", "may-cu", "demo"]);

function getExt(file: File) {
  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();

  if (type === "image/png" || name.endsWith(".png")) return "png";
  if (type === "image/jpeg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (type === "image/webp" || name.endsWith(".webp")) return "webp";
  if (type === "image/gif" || name.endsWith(".gif")) return "gif";

  return "";
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const slug = String(form.get("slug") || "").trim();

    if (!CMS_MODULES.has(slug)) {
      return NextResponse.json(
        { success: false, message: "Hạng mục CMS không hợp lệ." },
        { status: 400 }
      );
    }

    const { response } = await requireAdminApi(req, {
      write: true,
      module: slug as AdminModuleKey,
    });

    if (response) return response;

    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Không nhận được file ảnh." },
        { status: 400 }
      );
    }

    const ext = getExt(file);

    if (!ext) {
      return NextResponse.json(
        { success: false, message: "Chỉ hỗ trợ ảnh PNG, JPG, WEBP hoặc GIF." },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "Ảnh quá nặng. Vui lòng dùng ảnh dưới 5MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), "public", "uploads", "cms", slug);
    await mkdir(dir, { recursive: true });

    const filename = `${Date.now()}-${randomUUID()}.${ext}`;
    const fullPath = path.join(dir, filename);
    await writeFile(fullPath, buffer);

    return NextResponse.json({
      success: true,
      location: `/uploads/cms/${slug}/${filename}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không upload được ảnh CMS." },
      { status: 500 }
    );
  }
}
