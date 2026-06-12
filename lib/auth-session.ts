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

function b64url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
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

  const encodedPayload = b64url(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `v1.${encodedPayload}.${signature}`;
}

export function verifySignedSessionToken<T extends Record<string, unknown>>(
  token: string,
  expectedKind: SessionKind
) {
  try {
    const [version, encodedPayload, signature] = String(token || "").split(".");

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
