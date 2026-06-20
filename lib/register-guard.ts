import { NextRequest } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitInput = {
  ip: string;
  maNV: string;
  gmail: string;
};

type TrapInput = {
  honeypot: string;
  formStartedAt: string;
};

type TurnstileResult = {
  ok: boolean;
  message?: string;
};

const buckets = new Map<string, Bucket>();
let lastCleanupAt = 0;

const MIN_FORM_AGE_MS = 2500;
const MAX_FORM_AGE_MS = 45 * 60 * 1000;
const CLOCK_SKEW_MS = 30 * 1000;
const TOO_MANY_REQUESTS_MESSAGE =
  "Hệ thống nhận quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau ít phút.";

function cleanExpiredBuckets(now: number) {
  if (now - lastCleanupAt < 60 * 1000) return;

  lastCleanupAt = now;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function normalizeRateKey(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._:-]/g, "")
    .slice(0, 120);
}

function consumeBucket(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  cleanExpiredBuckets(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  return true;
}

export function getRegisterClientIp(req: NextRequest) {
  const headers = req.headers;
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    forwardedFor,
    headers.get("x-client-ip"),
  ];

  return normalizeRateKey(candidates.find(Boolean) || "unknown-ip") || "unknown-ip";
}

export function checkRegisterTrap(input: TrapInput) {
  const honeypot = String(input.honeypot || "").trim();

  if (honeypot) {
    return "Không thể gửi yêu cầu lúc này. Vui lòng tải lại trang và thử lại.";
  }

  const startedAt = Number(input.formStartedAt || 0);

  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    return "Phiên đăng ký không hợp lệ. Vui lòng tải lại trang và thử lại.";
  }

  const elapsedMs = Date.now() - startedAt;

  if (elapsedMs < -CLOCK_SKEW_MS) {
    return "Thời gian trên thiết bị chưa đồng bộ. Vui lòng kiểm tra lại giờ máy và thử lại.";
  }

  if (elapsedMs < MIN_FORM_AGE_MS) {
    return "Thao tác đăng ký quá nhanh. Vui lòng chờ vài giây rồi gửi lại.";
  }

  if (elapsedMs > MAX_FORM_AGE_MS) {
    return "Phiên đăng ký đã hết hạn. Vui lòng tải lại trang và nhập lại.";
  }

  return "";
}

export function checkRegisterRateLimit(input: RateLimitInput) {
  const ip = normalizeRateKey(input.ip || "unknown-ip");
  const maNV = normalizeRateKey(input.maNV);
  const gmail = normalizeRateKey(input.gmail);
  const checks: Array<[string, number, number]> = [
    [`register:ip:10m:${ip}`, 30, 10 * 60 * 1000],
    [`register:ip:1h:${ip}`, 90, 60 * 60 * 1000],
  ];

  if (maNV) {
    checks.push(
      [`register:staff:1h:${maNV}`, 4, 60 * 60 * 1000],
      [`register:staff:1d:${maNV}`, 8, 24 * 60 * 60 * 1000]
    );
  }

  if (gmail) {
    checks.push(
      [`register:gmail:1h:${gmail}`, 4, 60 * 60 * 1000],
      [`register:gmail:1d:${gmail}`, 8, 24 * 60 * 60 * 1000]
    );
  }

  const allowed = checks.every(([key, limit, windowMs]) => {
    return consumeBucket(key, limit, windowMs);
  });

  return allowed ? "" : TOO_MANY_REQUESTS_MESSAGE;
}

export async function verifyRegisterTurnstile(
  token: string,
  remoteIp: string
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY || "";

  if (!secret) {
    return { ok: true };
  }

  if (!token) {
    return {
      ok: false,
      message: "Vui lòng xác thực chống spam trước khi tạo tài khoản.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
    });

    if (remoteIp && remoteIp !== "unknown-ip") {
      body.set("remoteip", remoteIp);
    }

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);

    if (res.ok && data?.success) {
      return { ok: true };
    }
  } catch {
    // Fail closed when Turnstile is configured but cannot be verified.
  } finally {
    clearTimeout(timeout);
  }

  return {
    ok: false,
    message: "Không xác thực được chống spam. Vui lòng tải lại trang và thử lại.",
  };
}
