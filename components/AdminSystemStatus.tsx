"use client";

import { useCallback, useEffect, useState } from "react";
import { clientErrorMessage, requestJson } from "@/lib/client-request";
import UiNotice from "./UiNotice";

type Health = { generatedAt: string; supabase?: { ok: boolean; message: string }; mail?: { ok: boolean; message: string }; telegram?: { ok: boolean; message: string }; recentErrors?: Array<{ id: string; time: string; module: string; message: string }> };
export default function AdminSystemStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await requestJson<{ success: boolean; health: Health }>("/api/admin/ops"); setHealth(data.health); }
    catch (reason) { setError(clientErrorMessage(reason)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <section aria-label="Tình trạng hệ thống" aria-busy={loading}>
    <div className="admin-system-heading"><h2>Tình trạng hệ thống</h2><p>Kiểm tra kết nối và các lỗi gần đây.</p>
      <button className="ui-button ui-button-secondary" type="button" disabled={loading} onClick={() => void load()}>{loading ? "Đang kiểm tra…" : "Làm mới trạng thái"}</button></div>
    {loading && <UiNotice tone="loading">Đang kiểm tra hệ thống…</UiNotice>}
    {error && <UiNotice onRetry={() => void load()} busy={loading}>{error}</UiNotice>}
    {health && <><p style={{ marginTop: 16, fontSize: 13, color: "#596577" }}>Kiểm tra lúc: {new Date(health.generatedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
      <div className="admin-system-grid">{([ ["supabase", "Dữ liệu"], ["mail", "Email"], ["telegram", "Telegram"] ] as const).map(([key, label]) => <article key={key}><h3>{label}</h3><b>{health[key]?.ok ? "Sẵn sàng" : "Cần kiểm tra"}</b><p>{health[key]?.message || "Chưa có thông tin."}</p></article>)}</div>
      <h3>Lỗi gần đây</h3>{health.recentErrors?.length ? <ul className="admin-system-log">{health.recentErrors.slice(0, 10).map((item, index) => <li key={item.id || index}><b>{item.module || "Website"}</b> · {item.time}<br />{item.message}</li>)}</ul> : <p>Chưa ghi nhận lỗi gần đây.</p>}</>}
  </section>;
}
