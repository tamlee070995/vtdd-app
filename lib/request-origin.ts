// Next may use an internal hostname in req.url behind a reverse proxy.
export function isSameOriginRequest(req: { headers: Headers; url: string }) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const source = new URL(origin);
    const target = new URL(req.url);
    const host = req.headers.get("host") || target.host;
    const protocol = (req.headers.get("x-forwarded-proto") || target.protocol.replace(/:$/, "")).split(",")[0].trim();
    return source.host === host && source.protocol === protocol + ":";
  } catch { return false; }
}
