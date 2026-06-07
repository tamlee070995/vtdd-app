import crypto from "crypto";

function getCaptchaSecret() {
  const secret = process.env.CAPTCHA_SECRET || process.env.FIELD_ENCRYPTION_KEY || "";

  if (!secret || secret.length < 16) {
    throw new Error("Thiếu CAPTCHA_SECRET trong .env.local");
  }

  return secret;
}

function b64url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromB64url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function hmac(value: string) {
  return crypto
    .createHmac("sha256", getCaptchaSecret())
    .update(value)
    .digest("hex");
}

export function createCaptchaChallenge() {
  const a = Math.floor(2 + Math.random() * 8);
  const b = Math.floor(2 + Math.random() * 8);
  const answer = String(a + b);

  const nonce = crypto.randomBytes(12).toString("hex");
  const expiresAt = Date.now() + 10 * 60 * 1000;

  const payload = {
    nonce,
    expiresAt,
    answerHash: hmac(`${nonce}:${answer}`),
  };

  const rawPayload = JSON.stringify(payload);
  const encodedPayload = b64url(rawPayload);
  const signature = hmac(encodedPayload);

  return {
    question: `${a} + ${b} = ?`,
    token: `${encodedPayload}.${signature}`,
  };
}

export function verifyCaptchaAnswer(token: string, answer: string) {
  try {
    const cleanToken = String(token || "").trim();
    const cleanAnswer = String(answer || "").trim();

    if (!cleanToken || !cleanAnswer) return false;

    const [encodedPayload, signature] = cleanToken.split(".");

    if (!encodedPayload || !signature) return false;

    const expectedSignature = hmac(encodedPayload);

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    ) {
      return false;
    }

    const payload = JSON.parse(fromB64url(encodedPayload));

    if (!payload?.nonce || !payload?.expiresAt || !payload?.answerHash) {
      return false;
    }

    if (Date.now() > Number(payload.expiresAt)) {
      return false;
    }

    const inputHash = hmac(`${payload.nonce}:${cleanAnswer}`);

    return crypto.timingSafeEqual(
      Buffer.from(inputHash),
      Buffer.from(payload.answerHash)
    );
  } catch {
    return false;
  }
}