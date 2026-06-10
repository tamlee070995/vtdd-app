import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireAdminApi } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isValidImage(file: File) {
  const type = String(file.type || "").toLowerCase();

  return [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
  ].includes(type);
}

function getCloudinaryEnv() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  const folder = String(process.env.CLOUDINARY_FOLDER || "vtdd-cms").trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Thiếu CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY hoặc CLOUDINARY_API_SECRET."
    );
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    folder,
  };
}

function signCloudinaryUpload(
  params: Record<string, string | number>,
  apiSecret: string
) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(payload + apiSecret)
    .digest("hex");
}

function safePublicId(originalName: string) {
  const name = String(originalName || "cms-image")
    .replace(/\.[^/.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${name || "cms-image"}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export async function POST(req: NextRequest) {
  const { response } = await requireAdminApi(req);

  if (response) return response;

  try {
    const { cloudName, apiKey, apiSecret, folder } = getCloudinaryEnv();

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "Không tìm thấy file ảnh.",
        },
        { status: 400 }
      );
    }

    if (!isValidImage(file)) {
      return NextResponse.json(
        {
          success: false,
          message: "Chỉ hỗ trợ PNG, JPG, JPEG, WEBP hoặc GIF.",
        },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          message: "Ảnh quá lớn. Vui lòng dùng ảnh dưới 10MB.",
        },
        { status: 400 }
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = safePublicId(file.name || "cms-image");

    const signParams = {
      folder,
      public_id: publicId,
      timestamp,
    };

    const signature = signCloudinaryUpload(signParams, apiSecret);

    const uploadForm = new FormData();
    uploadForm.append("file", file);
    uploadForm.append("api_key", apiKey);
    uploadForm.append("timestamp", String(timestamp));
    uploadForm.append("signature", signature);
    uploadForm.append("folder", folder);
    uploadForm.append("public_id", publicId);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: uploadForm,
      }
    );

    const data = await uploadRes.json().catch(() => null);

    if (!uploadRes.ok || !data?.secure_url) {
      throw new Error(
        data?.error?.message || "Cloudinary không upload được ảnh."
      );
    }

    return NextResponse.json({
      success: true,
      location: data.secure_url,
      url: data.secure_url,
      publicId: data.public_id,
      width: data.width,
      height: data.height,
      format: data.format,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to upload image: " +
          (err?.message || "Không upload được ảnh."),
      },
      { status: 500 }
    );
  }
}