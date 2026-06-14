type SelectOptions = {
  select?: string;
  filters?: Record<string, string>;
  order?: string;
  limit?: number;
  offset?: number;
};

type WriteOptions = {
  onConflict?: string;
  returning?: "minimal" | "representation";
};

function cleanUrl(value: string) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "");
}

function deriveSupabaseUrlFromDatabaseUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname;

    if (host.startsWith("db.") && host.endsWith(".supabase.co")) {
      const projectRef = host.split(".")[1];
      return projectRef ? `https://${projectRef}.supabase.co` : "";
    }

    const username = decodeURIComponent(url.username || "");
    const match = username.match(/^postgres\.([a-z0-9-]+)$/i);
    if (match?.[1]) return `https://${match[1]}.supabase.co`;
  } catch {
    return "";
  }

  return "";
}

function getConfig() {
  const supabaseUrl =
    cleanUrl(process.env.SUPABASE_URL || "") ||
    cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || "") ||
    cleanUrl(deriveSupabaseUrlFromDatabaseUrl(process.env.DATABASE_URL || ""));

  const serviceKey =
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() ||
    String(process.env.SUPABASE_SECRET_KEY || "").trim() ||
    String(process.env.SERVICE_ROLE_KEY || "").trim() ||
    String(process.env.service_role_key || "").trim() ||
    String(process.env.SUPABASE_SERVICE_KEY || "").trim() ||
    String(process.env.SUPABASE_ANON_KEY || "").trim() ||
    String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!supabaseUrl || !serviceKey) return null;
  return { supabaseUrl, serviceKey };
}

function hasSupabaseEnvHint() {
  return Boolean(
    cleanUrl(process.env.SUPABASE_URL || "") ||
      cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || "") ||
      cleanUrl(deriveSupabaseUrlFromDatabaseUrl(process.env.DATABASE_URL || "")) ||
      String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() ||
      String(process.env.SUPABASE_SECRET_KEY || "").trim() ||
      String(process.env.SERVICE_ROLE_KEY || "").trim() ||
      String(process.env.service_role_key || "").trim() ||
      String(process.env.SUPABASE_SERVICE_KEY || "").trim() ||
      String(process.env.SUPABASE_ANON_KEY || "").trim() ||
      String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim()
  );
}

export function isSupabaseConfigured() {
  return Boolean(getConfig()) || hasSupabaseEnvHint();
}

function encodeFilter(value: string) {
  return encodeURIComponent(value);
}

function buildQuery(options: SelectOptions = {}) {
  const params = new URLSearchParams();
  params.set("select", options.select || "*");

  Object.entries(options.filters || {}).forEach(([key, value]) => {
    params.set(key, value);
  });

  if (options.order) params.set("order", options.order);
  if (typeof options.limit === "number") params.set("limit", String(options.limit));
  if (typeof options.offset === "number") params.set("offset", String(options.offset));

  return params.toString();
}

async function rawRequest(tablePath: string, init: RequestInit = {}) {
  const config = getConfig();
  if (!config) throw new Error("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.");

  const res = await fetch(`${config.supabaseUrl}/rest/v1/${tablePath}`, {
    ...init,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Supabase request failed: ${res.status}`);
  }

  return res;
}

async function request<T>(tablePath: string, init: RequestInit = {}): Promise<T> {
  const res = await rawRequest(tablePath, init);

  if (res.status === 204) return null as T;
  return (await res.json().catch(() => null)) as T;
}

export function eq(value: unknown) {
  return `eq.${encodeFilter(String(value ?? ""))}`;
}

export function neq(value: unknown) {
  return `neq.${encodeFilter(String(value ?? ""))}`;
}

export function notIsNull() {
  return "not.is.null";
}

export async function selectRows<T>(table: string, options: SelectOptions = {}) {
  return request<T[]>(`${table}?${buildQuery(options)}`);
}

export async function selectAllRows<T>(table: string, options: Omit<SelectOptions, "limit" | "offset"> = {}) {
  const pageSize = 1000;
  const rows: T[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const page = await selectRows<T>(table, { ...options, limit: pageSize, offset });
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

export async function insertRows<T>(table: string, rows: Record<string, unknown>[], options: WriteOptions = {}) {
  if (rows.length === 0) return [] as T[];

  const params = new URLSearchParams();
  if (options.onConflict) params.set("on_conflict", options.onConflict);
  const prefer = [
    options.onConflict ? "resolution=merge-duplicates" : "",
    `return=${options.returning || "representation"}`,
  ].filter(Boolean).join(",");

  return request<T[]>(`${table}${params.toString() ? `?${params.toString()}` : ""}`, {
    method: "POST",
    headers: { Prefer: prefer },
    body: JSON.stringify(rows),
  });
}

export async function updateRows<T>(
  table: string,
  filters: Record<string, string>,
  patch: Record<string, unknown>,
  options: WriteOptions = {}
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => params.set(key, value));

  return request<T[]>(`${table}?${params.toString()}`, {
    method: "PATCH",
    headers: { Prefer: `return=${options.returning || "representation"}` },
    body: JSON.stringify(patch),
  });
}

export async function deleteRows<T>(
  table: string,
  filters: Record<string, string>,
  options: WriteOptions = {}
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => params.set(key, value));

  return request<T[]>(`${table}?${params.toString()}`, {
    method: "DELETE",
    headers: { Prefer: `return=${options.returning || "minimal"}` },
  });
}

export async function countRows(table: string, filters: Record<string, string> = {}) {
  const params = new URLSearchParams();
  params.set("select", "*");
  Object.entries(filters).forEach(([key, value]) => params.set(key, value));
  params.set("limit", "0");

  const res = await rawRequest(`${table}?${params.toString()}`, {
    method: "GET",
    headers: { Prefer: "count=exact" },
  });
  const contentRange = res.headers.get("content-range") || "";
  const total = Number(contentRange.split("/")[1] || "0");
  return Number.isFinite(total) ? total : 0;
}
