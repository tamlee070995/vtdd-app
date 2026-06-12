import crypto from "node:crypto";

function getCloudinaryEnv() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  const folder = String(process.env.CLOUDINARY_FOLDER || "vtdd").trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Thiếu cấu hình Cloudinary để upload ảnh.");
  }

  return { cloudName, apiKey, apiSecret, folder };
}

function signCloudinaryUpload(params: Record<string, string | number>, apiSecret: string) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto.createHash("sha1").update(payload + apiSecret).digest("hex");
}

function safePublicId(name: string) {
  return String(name || "pincode-file")
    .replace(/\.[^/.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function uploadDataUrlToCloudinary(dataUrl: string, options?: { folder?: string; name?: string }) {
  const data = String(dataUrl || "");

  if (!data.startsWith("data:image/")) {
    throw new Error("Chỉ hỗ trợ upload ảnh dạng PNG/JPG/WEBP.");
  }

  if (data.length > 8_000_000) {
    throw new Error("Ảnh quá lớn. Vui lòng nén hoặc chọn ảnh nhỏ hơn.");
  }

  const { cloudName, apiKey, apiSecret, folder } = getCloudinaryEnv();
  const timestamp = Math.floor(Date.now() / 1000);
  const targetFolder = options?.folder || `${folder}/pincode`;
  const publicId = `${safePublicId(options?.name || "pincode")}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const signParams = {
    folder: targetFolder,
    public_id: publicId,
    timestamp,
  };
  const signature = signCloudinaryUpload(signParams, apiSecret);
  const uploadForm = new FormData();

  uploadForm.append("file", data);
  uploadForm.append("api_key", apiKey);
  uploadForm.append("timestamp", String(timestamp));
  uploadForm.append("signature", signature);
  uploadForm.append("folder", targetFolder);
  uploadForm.append("public_id", publicId);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: uploadForm,
  });
  const json = await uploadRes.json().catch(() => null);

  if (!uploadRes.ok || !json?.secure_url) {
    throw new Error(json?.error?.message || "Cloudinary không upload được ảnh.");
  }

  return String(json.secure_url);
}
