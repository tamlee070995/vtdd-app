import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const REGISTER_EMAIL_OTP_COOKIE = "vtdd_register_email_otp";
export const REGISTER_EMAIL_OTP_TTL_SECONDS = 10 * 60;
export const REGISTER_EMAIL_OTP_COOLDOWN_SECONDS = 60;

type RegisterEmailOtpPayload = {
  email: string;
  maNV: string;
  maST: string;
  otpHash: string;
  nonce: string;
  sentAt: number;
  expiresAt: number;
};

type VerifyInput = {
  email: string;
  maNV: string;
  maST: string;
  otp: string;
};

type OtpBucket = {
  count: number;
  resetAt: number;
};

const otpBuckets = new Map<string, OtpBucket>();
let lastOtpCleanupAt = 0;

function getOtpSecret() {
  const secret =
    process.env.REGISTER_EMAIL_OTP_SECRET ||
    process.env.AUTH_SESSION_SECRET ||
    process.env.CAPTCHA_SECRET ||
    process.env.FIELD_ENCRYPTION_KEY ||
    "";

  if (secret.trim().length < 16) {
    throw new Error("Thiếu REGISTER_EMAIL_OTP_SECRET hoặc secret đủ mạnh để ký OTP.");
  }

  return secret;
}

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function b64url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromB64url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function hmac(value: string) {
  return crypto.createHmac("sha256", getOtpSecret()).update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function makeOtpHash(otp: string, payload: Pick<RegisterEmailOtpPayload, "email" | "maNV" | "maST" | "nonce">) {
  return hmac([
    normalizeDigits(otp),
    normalizeEmail(payload.email),
    normalizeDigits(payload.maNV),
    normalizeDigits(payload.maST),
    payload.nonce,
  ].join(":"));
}

function signPayload(payload: RegisterEmailOtpPayload) {
  const encoded = b64url(JSON.stringify(payload));
  return `${encoded}.${hmac(encoded)}`;
}

function parsePayload(token: string) {
  try {
    const [encoded, signature] = String(token || "").split(".");
    if (!encoded || !signature) return null;

    if (!safeEqual(signature, hmac(encoded))) return null;

    const payload = JSON.parse(fromB64url(encoded)) as RegisterEmailOtpPayload;
    if (!payload?.email || !payload?.maNV || !payload?.otpHash || !payload?.nonce) return null;
    if (!Number.isFinite(payload.expiresAt) || Date.now() > payload.expiresAt) return null;

    return payload;
  } catch {
    return null;
  }
}

function readOtpPayload(req: NextRequest) {
  return parsePayload(req.cookies.get(REGISTER_EMAIL_OTP_COOKIE)?.value || "");
}

function cleanOtpBuckets(now: number) {
  if (now - lastOtpCleanupAt < 60 * 1000) return;

  lastOtpCleanupAt = now;
  for (const [key, bucket] of otpBuckets.entries()) {
    if (bucket.resetAt <= now) otpBuckets.delete(key);
  }
}

function consumeOtpBucket(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  cleanOtpBuckets(now);

  const bucket = otpBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    otpBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function checkRegisterEmailOtpRateLimit(input: { ip: string; maNV: string; email: string }) {
  const ip = String(input.ip || "unknown-ip").trim().toLowerCase().slice(0, 120) || "unknown-ip";
  const maNV = normalizeDigits(input.maNV);
  const email = normalizeEmail(input.email);
  const checks: Array<[string, number, number]> = [
    [`register-otp:ip:10m:${ip}`, 20, 10 * 60 * 1000],
  ];

  if (maNV) checks.push([`register-otp:staff:10m:${maNV}`, 4, 10 * 60 * 1000]);
  if (email) checks.push([`register-otp:email:10m:${email}`, 4, 10 * 60 * 1000]);

  return checks.every(([key, limit, windowMs]) => consumeOtpBucket(key, limit, windowMs))
    ? ""
    : "Bạn đã yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau ít phút.";
}

export function getRegisterEmailOtpCooldown(req: NextRequest, input: { email: string; maNV: string; maST: string }) {
  const payload = readOtpPayload(req);
  if (!payload) return 0;

  const sameTarget =
    payload.email === normalizeEmail(input.email) &&
    payload.maNV === normalizeDigits(input.maNV) &&
    payload.maST === normalizeDigits(input.maST);

  if (!sameTarget) return 0;

  const remainMs = payload.sentAt + REGISTER_EMAIL_OTP_COOLDOWN_SECONDS * 1000 - Date.now();
  return Math.max(0, Math.ceil(remainMs / 1000));
}

export function generateRegisterEmailOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export function createRegisterEmailOtpToken(input: { email: string; maNV: string; maST: string; otp: string }) {
  const now = Date.now();
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload: RegisterEmailOtpPayload = {
    email: normalizeEmail(input.email),
    maNV: normalizeDigits(input.maNV),
    maST: normalizeDigits(input.maST),
    nonce,
    sentAt: now,
    expiresAt: now + REGISTER_EMAIL_OTP_TTL_SECONDS * 1000,
    otpHash: "",
  };

  payload.otpHash = makeOtpHash(input.otp, payload);
  return signPayload(payload);
}

export function verifyRegisterEmailOtp(req: NextRequest, input: VerifyInput) {
  const payload = readOtpPayload(req);
  if (!payload) return false;

  const email = normalizeEmail(input.email);
  const maNV = normalizeDigits(input.maNV);
  const maST = normalizeDigits(input.maST);
  const otp = normalizeDigits(input.otp);

  if (!email || !maNV || !maST || !otp) return false;
  if (payload.email !== email || payload.maNV !== maNV || payload.maST !== maST) return false;

  const inputHash = makeOtpHash(otp, payload);
  return safeEqual(inputHash, payload.otpHash);
}

export function setRegisterEmailOtpCookie(res: NextResponse, token: string) {
  res.cookies.set(REGISTER_EMAIL_OTP_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REGISTER_EMAIL_OTP_TTL_SECONDS,
  });
}

export function clearRegisterEmailOtpCookie(res: NextResponse) {
  res.cookies.set(REGISTER_EMAIL_OTP_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
