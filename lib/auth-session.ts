import crypto from "crypto";

export type SessionKind = "admin" | "staff";

export type SignedSessionPayload<T extends Record<string, unknown> = Record<string, unknown>> = {
  kind: SessionKind;
  sub: string;
  iat: number;
  exp: number;
  nonce: string;
  data?: T;
};

function getSessionSecret() {
  const secret =
    process.env.AUTH_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.FIELD_ENCRYPTION_KEY ||
    process.env.CAPTCHA_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.GOOGLE_PRIVATE_KEY ||
    "";

  if (secret.trim().length < 16) {
    throw new Error("Missing AUTH_SESSION_SECRET or another strong session secret.");
  }

  return secret;
}

function fromB64url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function getEncryptionKey() {
  return crypto.createHash("sha256").update(getSessionSecret()).digest();
}

function encryptPayload(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  cipher.setAAD(Buffer.from("vtdd-session-v2"));

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `v2.${iv.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
}

function decryptPayload(ivText: string, encryptedText: string, tagText: string) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivText, "base64url")
  );
  decipher.setAAD(Buffer.from("vtdd-session-v2"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSignedSessionToken<T extends Record<string, unknown>>(
  kind: SessionKind,
  subject: string,
  maxAgeSeconds: number,
  data?: T
) {
  const now = Date.now();
  const payload: SignedSessionPayload<T> = {
    kind,
    sub: String(subject || "").trim(),
    iat: now,
    exp: now + maxAgeSeconds * 1000,
    nonce: crypto.randomBytes(16).toString("base64url"),
    data,
  };

  if (!payload.sub) {
    throw new Error("Cannot create a session without a subject.");
  }

  return encryptPayload(JSON.stringify(payload));
}

export function verifySignedSessionToken<T extends Record<string, unknown>>(
  token: string,
  expectedKind: SessionKind
) {
  try {
    const parts = String(token || "").split(".");
    const [version] = parts;

    if (version === "v2") {
      const [, iv, encryptedPayload, tag] = parts;
      if (!iv || !encryptedPayload || !tag) return null;

      const payload = JSON.parse(decryptPayload(iv, encryptedPayload, tag)) as SignedSessionPayload<T>;

      if (
        payload.kind !== expectedKind ||
        !payload.sub ||
        !Number.isFinite(payload.exp) ||
        Date.now() > payload.exp
      ) {
        return null;
      }

      return payload;
    }

    const [, encodedPayload, signature] = parts;

    if (version !== "v1" || !encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = sign(encodedPayload);

    if (!safeEqual(signature, expectedSignature)) {
      return null;
    }

    const payload = JSON.parse(fromB64url(encodedPayload)) as SignedSessionPayload<T>;

    if (
      payload.kind !== expectedKind ||
      !payload.sub ||
      !Number.isFinite(payload.exp) ||
      Date.now() > payload.exp
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
