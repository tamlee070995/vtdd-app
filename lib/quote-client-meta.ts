export type QuoteClientMeta = {
  userAgent: string;
  deviceLabel: string;
  networkType: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function detectDeviceLabel(userAgent: unknown) {
  const ua = clean(userAgent).toLowerCase();
  if (!ua) return "Không rõ";
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("android")) return "Android";
  if (ua.includes("windows") || ua.includes("macintosh") || ua.includes("linux")) return "Máy tính";
  return "Không rõ";
}

export function normalizeNetworkType(value: unknown) {
  const raw = clean(value);
  const v = raw.toLowerCase();

  if (!v) return "Không rõ";
  if (v.includes("wifi") || v.includes("wi-fi")) return "WiFi";
  if (v.includes("5g")) return "5G";
  if (v.includes("4g")) return "4G";
  if (v.includes("3g")) return "3G";
  if (v.includes("2g")) return "2G";
  if (v.includes("cell")) return "4G/5G";
  if (v.includes("ethernet")) return "WiFi";

  return raw;
}

function stripVietnamese(value: unknown) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function normalizeNetworkTypeForDevice(deviceLabel: unknown, networkType: unknown) {
  const device = stripVietnamese(deviceLabel);
  const normalizedNetwork = normalizeNetworkType(networkType);
  const network = clean(normalizedNetwork).toLowerCase();
  const isDesktop =
    device.includes("may tinh") ||
    device.includes("desktop") ||
    device.includes("windows") ||
    device.includes("macintosh") ||
    device.includes("linux");

  if (!isDesktop) return normalizedNetwork;

  if (network.includes("wifi") || network.includes("wi-fi")) return "WiFi";
  if (network.includes("lan") || network.includes("ethernet")) return "LAN";
  if (["2g", "3g", "4g", "5g", "4g/5g"].includes(network)) return "WiFi/LAN";

  return normalizedNetwork || "WiFi/LAN";
}

export function packQuoteClientMeta(meta: Partial<QuoteClientMeta>) {
  const userAgent = clean(meta.userAgent);
  const deviceLabel = clean(meta.deviceLabel) || detectDeviceLabel(userAgent);
  const networkType = normalizeNetworkTypeForDevice(deviceLabel, meta.networkType);

  return JSON.stringify({
    ua: userAgent,
    device: deviceLabel,
    network: networkType,
  });
}

export function parseQuoteClientMeta(rawValue: unknown): QuoteClientMeta {
  const raw = clean(rawValue);

  if (!raw) {
    return {
      userAgent: "",
      deviceLabel: "Không rõ",
      networkType: "Không rõ",
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const userAgent = clean(parsed?.ua || parsed?.userAgent);

    return {
      userAgent,
      deviceLabel: clean(parsed?.device || parsed?.deviceLabel) || detectDeviceLabel(userAgent),
      networkType: normalizeNetworkTypeForDevice(
        clean(parsed?.device || parsed?.deviceLabel) || detectDeviceLabel(userAgent),
        parsed?.network || parsed?.networkType
      ),
    };
  } catch {
    const parts = raw.split("|").map((item) => item.trim()).filter(Boolean);

    if (parts.length >= 3) {
      return {
        deviceLabel: clean(parts[0]) || detectDeviceLabel(parts.slice(2).join("|")),
        networkType: normalizeNetworkTypeForDevice(
          clean(parts[0]) || detectDeviceLabel(parts.slice(2).join("|")),
          parts[1]
        ),
        userAgent: parts.slice(2).join("|"),
      };
    }

    return {
      userAgent: raw,
      deviceLabel: detectDeviceLabel(raw),
      networkType: "Không rõ",
    };
  }
}
