"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IMEI_BRANDS, imeiPrefix, validImeiRequestId, type ImeiBrand, type ImeiIssue } from "@/lib/imei";
import { clientErrorMessage, requestJson } from "@/lib/client-request";
import UiNotice from "@/components/UiNotice";
import UiFeedbackDialog from "@/components/UiFeedbackDialog";
import styles from "./ImeiAdminTool.module.css";

type Access = { canView: boolean; canCreate: boolean; canCancelOwn: boolean; canManageAll: boolean };
type Directory = { success: boolean; items: ImeiIssue[]; page: number; pages: number; total: number; access: Access };
type Pending = { requestId: string; brand: ImeiBrand };
type Feedback = { tone: "loading" | "error" | "success"; text: string; retry?: () => void };
const labels = { active: "Đã cấp", cancelled: "Đã hủy", pending: "Chưa xong", conflict: "Chưa cấp" };
const date = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
function newRequestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function post(body: object) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch("/api/admin/imei", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (data?.code === "STAFF_SETUP_REQUIRED") window.location.assign("/admin/setup");
    if (!response.ok || !data?.success) throw Object.assign(new Error(data?.message || "Chưa nhận được kết quả. Xin thử lại đúng lượt này."), { code: data?.code });
    return data as { success: true; item: ImeiIssue; message: string };
  } finally { clearTimeout(timer); }
}

export default function ImeiAdminTool({ actor }: { actor: string }) {
  const [brand, setBrand] = useState<ImeiBrand>("samsung");
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [page, setPage] = useState(1), [search, setSearch] = useState(""), [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null), [restored, setRestored] = useState(false);
  const [result, setResult] = useState<ImeiIssue | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [cancel, setCancel] = useState<ImeiIssue | null>(null), [reason, setReason] = useState("");
  const busy = useRef(false), sequence = useRef({ value: 0 }), confirmation = useRef<HTMLDialogElement>(null), copyField = useRef<HTMLInputElement>(null);
  const storageKey = `vtdd-imei-pending-${actor}`;
  const access = directory?.access;
  const load = useCallback(async () => {
    const state = sequence.current, current = ++state.value;
    setLoading(true); setLoadError("");
    try {
      const data = await requestJson<Directory>(`/api/admin/imei?page=${page}&q=${encodeURIComponent(query)}`);
      if (state.value === current) {
        setDirectory(data); if (data.page > data.pages) setPage(data.pages);
        setResult(previous => previous ? data.items.find(item => item.actor === previous.actor && item.requestId === previous.requestId) || previous : null);
      }
    } catch (error) { if (state.value === current) setLoadError(clientErrorMessage(error)); }
    finally { if (state.value === current) setLoading(false); }
  }, [page, query]);
  useEffect(() => { const state = sequence.current; void load(); return () => { state.value++; }; }, [load]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && validImeiRequestId(saved.requestId) && Object.hasOwn(IMEI_BRANDS, saved.brand)) { setPending(saved); setBrand(saved.brand); }
    } catch { /* Storage may be unavailable in a private browsing session. */ }
    setRestored(true);
  }, [storageKey]);
  useEffect(() => {
    if (!cancel) return;
    const dialog = confirmation.current; dialog?.showModal();
    return () => dialog?.close();
  }, [cancel]);
  function remember(value: Pending | null) {
    setPending(value);
    try { if (value) localStorage.setItem(storageKey, JSON.stringify(value)); else localStorage.removeItem(storageKey); } catch { /* The in-memory request ID is still retained. */ }
  }
  async function generate(retry?: Pending) {
    if (busy.current || !access?.canCreate) return;
    const next = retry || pending || { requestId: newRequestId(), brand };
    busy.current = true; remember(next); setBrand(next.brand);
    setFeedback({ tone: "loading", text: "Đang cấp mã và ghi vào sổ…" });
    try {
      const response = await post({ action: "GENERATE", ...next });
      remember(null); setResult(response.item);
      setFeedback({ tone: "success", text: response.message });
      void load();
    } catch (error) {
      const collision = (error as { code?: string })?.code === "IMEI_COLLISION";
      if (collision) remember(null);
      setFeedback({ tone: "error", text: clientErrorMessage(error), ...(!collision ? { retry: () => { void generate(next); } } : {}) });
      void load();
    } finally { busy.current = false; }
  }
  async function applyCancellation() {
    if (busy.current || !cancel || !reason.trim()) return;
    const target = cancel, note = reason.trim();
    busy.current = true; setCancel(null);
    setFeedback({ tone: "loading", text: "Đang hủy lượt cấp…" });
    try {
      const response = await post({ action: "CANCEL", requestId: target.requestId, actor: target.actor, reason: note });
      if (result?.requestId === target.requestId && result.actor === target.actor) setResult(response.item);
      setFeedback({ tone: "success", text: response.message }); void load();
    } catch (error) {
      setFeedback({ tone: "error", text: clientErrorMessage(error), retry: () => { setFeedback(null); setCancel(target); setReason(note); } }); void load();
    } finally { busy.current = false; }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setFeedback({ tone: "success", text: "Đã sao chép mã." }); }
    catch { copyField.current?.focus(); copyField.current?.select(); setFeedback({ tone: "error", text: "Chưa sao chép được. Xin chọn dãy số rồi sao chép bằng tay." }); }
  }
  let prefix = "";
  try { prefix = imeiPrefix(brand, actor); } catch { /* Explain an unsupported employee code inline. */ }
  return <div className={styles.tool}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>SỔ MÃ NỘI BỘ</span><h2>Tạo IMEI</h2><p>Mã 15 số có kiểm tra Luhn. Mã đã hủy có thể cấp lại.</p></div><span className={styles.badge}>Luhn ✓</span></header>
    {loadError && <UiNotice onRetry={() => void load()} busy={loading}>{loadError}</UiNotice>}
    {loading && !directory && <UiNotice tone="loading">Đang tải sổ mã…</UiNotice>}
    {access && <>
      <section className={styles.generator} aria-label="Tạo mã mới">
        <div><label htmlFor="imei-brand">Máy mới hãng</label><select id="imei-brand" value={brand} disabled={!access.canCreate || !!pending || feedback?.tone === "loading"} onChange={event => setBrand(event.target.value as ImeiBrand)}>
          {Object.entries(IMEI_BRANDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select><p className={styles.syntax}>{prefix ? <>Đầu mã <b>{prefix}</b> + {14 - prefix.length} số ngẫu nhiên + 1 số Luhn</> : "Mã nhân viên phải gồm 1–13 số để tạo mã theo tài khoản."}</p></div>
        <button className={styles.primary} type="button" disabled={!restored || !prefix || !access.canCreate || feedback?.tone === "loading"} onClick={() => void generate()}>{pending ? "Tiếp tục lượt chưa xong" : "Tạo mã"}</button>
        {!access.canCreate && <p className={styles.hint}>Bạn được xem sổ mã. Xin liên lạc Admin nếu cần quyền tạo mã.</p>}
      </section>
      {pending && <UiNotice>Một lượt tạo chưa nhận được kết quả. Bấm “Tiếp tục lượt chưa xong” để kiểm tra và nhận lại đúng mã.</UiNotice>}
      {result?.imei && <section className={styles.result} aria-label="Kết quả cấp mã"><div><span>{labels[result.status]} · {IMEI_BRANDS[result.brand]}</span><input ref={copyField} aria-label="Mã IMEI vừa cấp" readOnly value={result.imei} onFocus={event => event.currentTarget.select()} /></div><button type="button" className={styles.primary} disabled={result.status !== "active"} onClick={() => void copy(result.imei!)}>Sao chép</button></section>}
      <section className={styles.history} aria-label="Lịch sử cấp mã">
        <div className={styles.historyTop}><div><h3>Lịch sử cấp mã <span>{directory.total}</span></h3><p>{access.canManageAll ? "Toàn bộ sổ mã" : "Các lượt cấp của bạn"}</p></div><button className={styles.secondary} type="button" disabled={loading} onClick={() => void load()}>Tải lại lịch sử</button></div>
        <form className={styles.search} onSubmit={event => { event.preventDefault(); setPage(1); if (search === query) void load(); else setQuery(search); }}><input aria-label="Tìm IMEI" placeholder="Nhập đủ 15 số để tìm mã" inputMode="numeric" value={search} maxLength={15} onChange={event => setSearch(event.target.value.replace(/\D/g, ""))} /><button className={styles.secondary}>Tìm mã</button>{query && <button type="button" className={styles.secondary} onClick={() => { setSearch(""); setQuery(""); setPage(1); }}>Xem hết</button>}</form>
        <div className={styles.items} aria-busy={loading}>
          {!directory.items.length && <p className={styles.empty}>{query ? "Không tìm thấy mã trong phạm vi bạn được xem." : "Chưa có lượt cấp mã."}</p>}
          {directory.items.map(item => <article className={styles.item} key={`${item.actor}-${item.requestId}`}>
            <div className={styles.itemMain}><div className={styles.itemTop}><strong className={styles.number}>{item.imei || "Chưa cấp mã"}</strong><span className={styles.status} data-status={item.status}>{labels[item.status]}</span></div>
              <p>{IMEI_BRANDS[item.brand]} · {date(item.createdAt)}</p>{access.canManageAll && <p>{item.actorName} · NV {item.actor}</p>}
              {item.cancelledAt && <p className={styles.cancellation}>Hủy: {date(item.cancelledAt)} · NV {item.cancelledBy}<br />{item.reason}</p>}
            </div>
            <div className={styles.actions}>
              {item.status === "active" && <button type="button" className={styles.secondary} onClick={() => void copy(item.imei!)}>Sao chép</button>}
              {item.status === "pending" && item.actor === actor && access.canCreate && <button type="button" className={styles.secondary} disabled={!!pending && pending.requestId !== item.requestId} onClick={() => void generate({ requestId: item.requestId, brand: item.brand })}>Tiếp tục</button>}
              {item.status === "active" && (access.canManageAll || (access.canCancelOwn && item.actor === actor)) && <button type="button" className={styles.danger} onClick={() => { setCancel(item); setReason(""); }}>Hủy mã</button>}
            </div>
          </article>)}
        </div>
        <nav className={styles.pagination} aria-label="Trang lịch sử"><button type="button" className={styles.secondary} disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span>Trang {directory.page} / {directory.pages}</span><button type="button" className={styles.secondary} disabled={loading || page >= directory.pages} onClick={() => setPage(page + 1)}>Sau</button></nav>
      </section>
    </>}
    {cancel && <dialog ref={confirmation} className={styles.dialog} onCancel={() => setCancel(null)} aria-labelledby="imei-cancel-title"><form onSubmit={event => { event.preventDefault(); void applyCancellation(); }}><h2 id="imei-cancel-title">Hủy lượt cấp mã?</h2><strong className={styles.number}>{cancel.imei}</strong><p>Mã sẽ được phép cấp lại. Lịch sử lượt cấp này vẫn được giữ.</p><label htmlFor="imei-cancel-reason">Lý do hủy</label><textarea id="imei-cancel-reason" required maxLength={300} autoFocus value={reason} onChange={event => setReason(event.target.value)} /><div className={styles.dialogActions}><button type="button" className={styles.secondary} onClick={() => setCancel(null)}>Trở lại</button><button className={styles.danger} disabled={!reason.trim()}>Hủy mã</button></div></form></dialog>}
    {feedback && <UiFeedbackDialog tone={feedback.tone} onDismiss={() => { if (feedback.tone !== "loading") setFeedback(null); }} onRetry={feedback.retry}>{feedback.text}</UiFeedbackDialog>}
  </div>;
}
