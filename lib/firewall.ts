export type FirewallDecision = {
  allowed: boolean;
  ip: string;
  user?: string;
  reason: string;
  mode: "allow" | "blacklist" | "whitelist" | "user-blacklist" | "user-whitelist";
};

type HeaderReader = {
  get(name: string): string | null;
};

type Rule = {
  pattern: string;
  reason: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function parseRules(value: unknown): Rule[] {
  return clean(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [patternPart, ...reasonParts] = line.split("|");
      const pattern = clean(patternPart).split(/\s+/)[0] || clean(patternPart);
      const reason = clean(reasonParts.join("|")) || clean(line.slice(pattern.length));
      return { pattern, reason };
    })
    .filter((rule) => rule.pattern);
}

function ipv4ToNumber(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;

  return parts.reduce((acc, part) => (acc << 8) + part, 0) >>> 0;
}

function matchCidr(ip: string, cidr: string) {
  const [base, prefixRaw] = cidr.split("/");
  const prefix = Number(prefixRaw);
  const ipNum = ipv4ToNumber(ip);
  const baseNum = ipv4ToNumber(base);

  if (ipNum === null || baseNum === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  if (prefix === 0) return true;

  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

function wildcardToRegex(pattern: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function ipMatches(ip: string, pattern: string) {
  const target = clean(ip).toLowerCase();
  const rule = clean(pattern).toLowerCase();

  if (!target || !rule) return false;
  if (rule === target) return true;
  if (rule.includes("/")) return matchCidr(target, rule);
  if (rule.includes("*")) return wildcardToRegex(rule).test(target);

  return false;
}

function normalizeUserCode(value: string) {
  return clean(value)
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/^NV/i, "")
    .toUpperCase();
}

function userMatches(user: string, pattern: string) {
  const target = normalizeUserCode(user);
  const rule = normalizeUserCode(pattern);

  if (!target || !rule) return false;
  if (rule === target) return true;
  if (rule.includes("*")) return wildcardToRegex(rule).test(target);

  return false;
}

function findMatchingRule(ip: string, rules: Rule[]) {
  return rules.find((rule) => ipMatches(ip, rule.pattern)) || null;
}

function findMatchingUserRule(user: string, rules: Rule[]) {
  return rules.find((rule) => userMatches(user, rule.pattern)) || null;
}

export function getClientIpFromHeaders(headersList: HeaderReader) {
  const forwarded = headersList.get("forwarded") || "";
  const forwardedFor = forwarded.match(/for="?([^;,"]+)/i)?.[1] || "";

  return (
    headersList.get("cf-connecting-ip") ||
    headersList.get("true-client-ip") ||
    headersList.get("x-real-ip") ||
    headersList.get("x-client-ip") ||
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    forwardedFor ||
    ""
  ).replace(/^\[|\]$/g, "");
}

export function checkFirewallAccess(settings: Record<string, string>, ip: string): FirewallDecision {
  const clientIp = clean(ip) || "unknown";
  const message = clean(settings.FIREWALL_MESSAGE) || "IP của bạn không được phép truy cập hệ thống tra giá.";
  const blacklist = parseRules(settings.FIREWALL_BLACKLIST);
  const whitelist = parseRules(settings.FIREWALL_WHITELIST);
  const blacklisted = findMatchingRule(clientIp, blacklist);

  if (blacklisted) {
    return {
      allowed: false,
      ip: clientIp,
      reason: blacklisted.reason || message,
      mode: "blacklist",
    };
  }

  if (whitelist.length > 0) {
    const whitelisted = findMatchingRule(clientIp, whitelist);

    if (!whitelisted) {
      return {
        allowed: false,
        ip: clientIp,
        reason: message,
        mode: "whitelist",
      };
    }
  }

  return {
    allowed: true,
    ip: clientIp,
    reason: "",
    mode: "allow",
  };
}

export function checkFirewallUserAccess(
  settings: Record<string, string>,
  user: string,
  ip = ""
): FirewallDecision {
  const clientIp = clean(ip) || "unknown";
  const userCode = normalizeUserCode(user);
  const message = clean(settings.FIREWALL_USER_MESSAGE) || "Tài khoản của bạn không được phép truy cập hệ thống tra giá.";
  const blacklist = parseRules(settings.FIREWALL_USER_BLACKLIST);
  const whitelist = parseRules(settings.FIREWALL_USER_WHITELIST);
  const blacklisted = findMatchingUserRule(userCode, blacklist);

  if (blacklisted) {
    return {
      allowed: false,
      ip: clientIp,
      user: userCode,
      reason: blacklisted.reason || message,
      mode: "user-blacklist",
    };
  }

  if (whitelist.length > 0) {
    const whitelisted = findMatchingUserRule(userCode, whitelist);

    if (!whitelisted) {
      return {
        allowed: false,
        ip: clientIp,
        user: userCode,
        reason: message,
        mode: "user-whitelist",
      };
    }
  }

  return {
    allowed: true,
    ip: clientIp,
    user: userCode,
    reason: "",
    mode: "allow",
  };
}
