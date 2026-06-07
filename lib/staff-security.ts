import crypto from "crypto";

const PASSWORD_PREFIX = "pwd:v1";
const ENC_PREFIX = "enc:v1";

function getSecretKey() {
  const raw = process.env.FIELD_ENCRYPTION_KEY || "";

  if (!raw || raw.length < 16) {
    throw new Error("Thiếu FIELD_ENCRYPTION_KEY trong .env.local");
  }

  return crypto.createHash("sha256").update(raw).digest();
}

export function normalizeCode(value: any) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .replace(/\.0$/, "");
}

export function normalizeText(value: any) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");

  return `${PASSWORD_PREFIX}:${salt}:${hash}`;
}

export function verifyPassword(input: string, stored: string) {
  const password = normalizeText(input);
  const value = normalizeText(stored);

  if (!value) return false;

  // Hỗ trợ dữ liệu cũ đang lưu plain text như 123123
  if (!value.startsWith(PASSWORD_PREFIX + ":")) {
    return password === value;
  }

  const parts = value.split(":");
  const salt = parts[2];
  const oldHash = parts[3];

  if (!salt || !oldHash) return false;

  const newHash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");

  return crypto.timingSafeEqual(Buffer.from(oldHash), Buffer.from(newHash));
}

export function encryptText(value: any) {
  const text = normalizeText(value);
  if (!text) return "";

  const key = getSecretKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return `${ENC_PREFIX}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptText(value: any) {
  const text = normalizeText(value);

  if (!text) return "";

  // Hỗ trợ dữ liệu cũ đang lưu plain text
  if (!text.startsWith(ENC_PREFIX + ":")) {
    return text;
  }

  try {
    const parts = text.split(":");
    const iv = Buffer.from(parts[2], "hex");
    const tag = Buffer.from(parts[3], "hex");
    const encrypted = Buffer.from(parts[4], "hex");

    const key = getSecretKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

export function isDefaultPasswordStored(stored: string) {
  const defaultPassword = process.env.DEFAULT_STAFF_PASSWORD || "123123";
  return verifyPassword(defaultPassword, stored);
}