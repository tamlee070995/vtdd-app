"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canCancelImei, imeiCancelUntil, imeiCodeLength, IMEI_BRANDS, IMEI_CANCEL_CONTACT, imeiPrefix, isAppleSerial, validImeiRequestId, type ImeiBrand, type ImeiIssue } from "@/lib/imei";
import { clientErrorMessage, requestJson } from "@/lib/client-request";
import UiNotice from "@/components/UiNotice";
import UiFeedbackDialog from "@/components/UiFeedbackDialog";
import styles from "./ImeiAdminTool.module.css";
import ImeiBrandLocksPanel from "./ImeiBrandLocksPanel";
import { imeiBrandLockedMessage, type ImeiBrandLocks } from "@/lib/imei";

type Access = { canView: boolean; canCreate: boolean; canCancelOwn: boolean; canManageAll: boolean; canReport: boolean; canManageBrandLocks: boolean };
type Directory = { success: boolean; items: ImeiIssue[]; page: number; pages: number; total: number; access: Access; serverTime: number; policy: ImeiBrandLocks };
type Pending = { requestId: string; brand: ImeiBrand; recipient?: string; storeCode?: string };
type Feedback = { tone: "loading" | "error" | "success"; text: string; retry?: () => void };
const labels = { active: "Đã cấp", cancelled: "Đã hủy", pending: "Chưa xong", conflict: "Chưa cấp" };
const date = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
function cancelTimeLeft(item: ImeiIssue, now: number) {
  const seconds = Math.max(0, Math.ceil((imeiCancelUntil(item.createdAt) - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
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
    return data as { success: true; item: ImeiIssue; message: string; serverTime: number };
  } finally { clearTimeout(timer); }
}

export default function ImeiAdminTool({ actor }: { actor: string }) {
  const [assigning,setAssigning]=useState(false),[recipient,setRecipient]=useState(""),[storeCode,setStoreCode]=useState("");
  const assignment=useRef<HTMLDialogElement>(null);
  const [filters,setFilters]=useState({from:"",to:"",employee:"",store:"",brand:"",status:""});
  const [applied,setApplied]=useState(filters);
  const filterQuery=new URLSearchParams(applied).toString();
  const [brand, setBrand] = useState<ImeiBrand>("samsung");
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [policy, setPolicy] = useState<ImeiBrandLocks | null>(null), [policyError, setPolicyError] = useState("");
  const [page, setPage] = useState(1), [search, setSearch] = useState(""), [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null), [restored, setRestored] = useState(false);
  const [result, setResult] = useState<ImeiIssue | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [cancel, setCancel] = useState<ImeiIssue | null>(null), [reason, setReason] = useState("");
  const [now, setNow] = useState(0);
  const clock = useRef<{ server: number; received: number } | null>(null);
  const busy = useRef(false), sequence = useRef({ value: 0 }), confirmation = useRef<HTMLDialogElement>(null), copyField = useRef<HTMLInputElement>(null);
  const storageKey = `vtdd-imei-pending-${actor}`;
  const access = directory?.access;
  const visibleItems = directory?.items.filter(item => directory.access.canReport || item.status !== "cancelled") || [];
  const syncClock = useCallback((serverTime: number) => {
    if (!Number.isFinite(serverTime)) return;
    clock.current = { server: serverTime, received: performance.now() }; setNow(serverTime);
  }, []);
  const load = useCallback(async () => {
    const state = sequence.current, current = ++state.value;
    setLoading(true); setLoadError("");
    try {
      const data = await requestJson<Directory>(`/api/admin/imei?page=${page}&q=${encodeURIComponent(query)}&${filterQuery}`);
      if (state.value === current) {
        syncClock(data.serverTime);
        setPolicy(data.policy); setPolicyError("");
        setDirectory(data); if (data.page > data.pages) setPage(data.pages);
        setResult(previous => previous ? data.items.find(item => item.actor === previous.actor && item.requestId === previous.requestId) || previous : null);
      }
    } catch (error) { if (state.value === current) setLoadError(clientErrorMessage(error)); }
    finally { if (state.value === current) setLoading(false); }
  }, [page, query, syncClock, filterQuery]);
  useEffect(() => { const state = sequence.current; void load(); return () => { state.value++; }; }, [load]);
  const refreshPolicy = useCallback(async () => {
    try {
      const data = await requestJson<{ success: boolean; policy: ImeiBrandLocks; access: Access }>("/api/admin/imei/brand-locks");
      setPolicy(data.policy); setPolicyError("");
      setDirectory(previous => previous ? { ...previous, access: data.access } : previous);
    } catch (error) { setPolicyError(clientErrorMessage(error)); }
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refreshPolicy(); }, 30000);
    return () => clearInterval(timer);
  }, [refreshPolicy]);
  useEffect(() => {
    const timer = window.setInterval(() => { const anchor = clock.current; if (anchor) setNow(anchor.server + performance.now() - anchor.received); }, 1000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);
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
  useEffect(()=>{if(assigning)assignment.current?.showModal();else assignment.current?.close();},[assigning]);
  async function exportExcel(){
    setFeedback({tone:"loading",text:"Đang xuất Excel theo bộ lọc…"});
    try{const response=await fetch('/api/admin/imei/export?q='+encodeURIComponent(query)+'&'+filterQuery,{cache:"no-store"});
    if(!response.ok){const data=await response.json();throw new Error(data.message||"Chưa xuất được Excel.")}
    const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download='so-imei-sn.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);setFeedback(null);
    }catch(e){setFeedback({tone:"error",text:clientErrorMessage(e)})}
  }
  function remember(value: Pending | null) {
    setPending(value);
    try { if (value) localStorage.setItem(storageKey, JSON.stringify(value)); else localStorage.removeItem(storageKey); } catch { /* The in-memory request ID is still retained. */ }
  }
  async function generate(retry?: Pending) {
    if (busy.current || !access?.canCreate) return;
    const selectedBrand = (retry || pending)?.brand || brand;
    if (!policy || policyError || (policy.lockedBrands.includes(selectedBrand) && !(retry || pending))) {
      setFeedback({ tone: "error", text: policy?.lockedBrands.includes(selectedBrand) ? imeiBrandLockedMessage(selectedBrand) : "Chưa đọc được tình trạng khóa hãng. Xin tải lại rồi thử lại." }); return;
    }
    if(!(retry||pending)?.recipient || !(retry||pending)?.storeCode){setAssigning(true);return;}
    const next = retry || pending || { requestId: newRequestId(), brand };
    busy.current = true; remember(next); setBrand(next.brand);
    setFeedback({ tone: "loading", text: "Đang cấp mã và ghi vào sổ…" });
    try {
      const response = await post({ action: "GENERATE", ...next });
      syncClock(response.serverTime);
      remember(null); setResult(response.item);
      setFeedback({ tone: "success", text: response.message });
      void load();
    } catch (error) {
      const collision = ["IMEI_COLLISION", "IMEI_RULE_CHANGED", "IMEI_BRAND_LOCKED"].includes((error as { code?: string })?.code || "");
      if (collision) remember(null);
      setFeedback({ tone: "error", text: clientErrorMessage(error), ...(!collision ? { retry: () => { void generate(next); } } : {}) });
      void load();
    } finally { busy.current = false; }
  }
  async function applyCancellation() {
    if (busy.current || !cancel || !reason.trim()) return;
    const anchor = clock.current;
    const checkedAt = anchor ? anchor.server + performance.now() - anchor.received : now;
    if (!access || !canCancelImei(cancel, actor, access, checkedAt)) {
      setCancel(null); setFeedback({ tone: "error", text: IMEI_CANCEL_CONTACT }); return;
    }
    const target = cancel, note = reason.trim();
    busy.current = true; setCancel(null);
    setFeedback({ tone: "loading", text: "Đang hủy lượt cấp…" });
    try {
      const response = await post({ action: "CANCEL", requestId: target.requestId, actor: target.actor, reason: note });
      syncClock(response.serverTime);
      if (result?.requestId === target.requestId && result.actor === target.actor) setResult(response.item);
      setFeedback({ tone: "success", text: response.message }); void load();
    } catch (error) {
      const expired = (error as { code?: string })?.code === "IMEI_CANCEL_EXPIRED";
      setFeedback({ tone: "error", text: clientErrorMessage(error), ...(!expired ? { retry: () => { setFeedback(null); setCancel(target); setReason(note); } } : {}) }); void load();
    } finally { busy.current = false; }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setFeedback({ tone: "success", text: "Đã sao chép mã." }); }
    catch { copyField.current?.focus(); copyField.current?.select(); setFeedback({ tone: "error", text: "Chưa sao chép được. Xin chọn dãy số rồi sao chép bằng tay." }); }
  }
  let prefix = "";
  try { prefix = imeiPrefix(brand, actor); } catch { /* Explain an unsupported employee code inline. */ }
  const serial = isAppleSerial(brand);
  const brandLocked = policy?.lockedBrands.includes(brand) || false;
  return <div className={styles.tool}>
    <header className={styles.heading}><div className={styles.headingTitle}><span className={styles.eyebrow}>SỔ MÃ NỘI BỘ</span><h2>Tạo IMEI / SN</h2></div>
      <div className={styles.headingActions}><span className={styles.badge}>{serial ? "SN Apple" : "Luhn ✓"}</span>
        {policy && access?.canManageBrandLocks && <ImeiBrandLocksPanel policy={policy} onSaved={next => { setPolicy(next); setPolicyError(""); }} />}
      </div>
    </header>
    <p className={styles.intro}>Đối với máy cũ không lấy được IMEI thì không quan tâm Hãng nào. Chọn <b>Hãng</b> máy mới đổi lên thuộc các trường hợp dưới đây:</p>
    {loadError && <UiNotice onRetry={() => void load()} busy={loading}>{loadError}</UiNotice>}
    {loading && !directory && <UiNotice tone="loading">Đang tải sổ mã…</UiNotice>}
    {access && <>
      {policyError && <UiNotice onRetry={() => void refreshPolicy()}>{policyError}</UiNotice>}
      <section className={styles.generator} aria-label="Tạo mã mới">
        <div><label htmlFor="imei-brand">Máy mới hãng</label><select id="imei-brand" value={brand} disabled={!!pending || !policy || !!policyError || feedback?.tone === "loading"} onChange={event => setBrand(event.target.value as ImeiBrand)}>
          {Object.entries(IMEI_BRANDS).map(([key, label]) => <option key={key} value={key} disabled={policy?.lockedBrands.includes(key as ImeiBrand)}>{policy?.lockedBrands.includes(key as ImeiBrand) ? imeiBrandLockedMessage(key as ImeiBrand) : label}</option>)}
        </select><p className={styles.syntax}>{prefix ? serial ? <>SN {imeiCodeLength(brand)} ký tự: <b>{prefix}</b> + {imeiCodeLength(brand) - prefix.length} ký tự ngẫu nhiên (số và chữ). Không dùng O và I.</> : <>Đầu mã <b>{prefix}</b> + {14 - prefix.length} số ngẫu nhiên + 1 số Luhn</> : "Mã nhân viên phải gồm 1–13 số để tạo mã theo tài khoản."}</p></div>
        <button className={styles.primary} type="button" disabled={!restored || !prefix || !access.canCreate || !policy || !!policyError || (brandLocked && !pending) || feedback?.tone === "loading"} onClick={() => void generate()}>{pending ? "Tiếp tục lượt chưa xong" : "Tạo mã"}</button>
        {!access.canCreate && <p className={styles.hint}>Bạn được xem sổ mã. Xin liên lạc Admin nếu cần quyền tạo mã.</p>}
      </section>
      {pending && <UiNotice>Một lượt tạo chưa nhận được kết quả. Bấm “Tiếp tục lượt chưa xong” để kiểm tra và nhận lại đúng mã.</UiNotice>}
      {result?.imei && (access?.canReport || result.status !== "cancelled") && <section className={styles.result} aria-label="Kết quả cấp mã"><div><span>{labels[result.status]} · {isAppleSerial(result.brand) ? "SN" : "IMEI"} · {IMEI_BRANDS[result.brand]}</span><input ref={copyField} aria-label={isAppleSerial(result.brand) ? "SN vừa cấp" : "Mã IMEI vừa cấp"} readOnly value={result.imei} onFocus={event => event.currentTarget.select()} /></div><button type="button" className={styles.primary} disabled={result.status !== "active"} onClick={() => void copy(result.imei!)}>Sao chép</button></section>}
      <section className={styles.history} aria-label="Lịch sử cấp mã">
        <div className={styles.historyTop}><div><h3>Lịch sử cấp mã {access.canReport && <span>{directory.total}</span>}</h3><p>{access.canReport ? "Toàn bộ sổ mã" : "Các lượt cấp của bạn"}</p></div><button className={styles.secondary} type="button" disabled={loading} onClick={() => void load()}>Tải lại lịch sử</button></div>
        {access.canReport && <form className={styles.search} onSubmit={e=>{e.preventDefault();setPage(1);setApplied({...filters});}}>
          <label>Từ ngày<input type="date" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/></label>
          <label>Đến ngày<input type="date" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/></label>
          <label>Nhân viên tạo / User nhận<input value={filters.employee} onChange={e=>setFilters({...filters,employee:e.target.value})}/></label>
          <label>Mã siêu thị<input value={filters.store} onChange={e=>setFilters({...filters,store:e.target.value})}/></label>
          <label>Hãng<select value={filters.brand} onChange={e=>setFilters({...filters,brand:e.target.value})}><option value="">Tất cả hãng</option>{Object.entries(IMEI_BRANDS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <label>Tình trạng<select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">Tất cả</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <button className={styles.secondary}>Áp dụng bộ lọc</button><button type="button" className={styles.secondary} onClick={()=>void exportExcel()}>Xuất Excel theo bộ lọc</button>
        </form>}
        <form className={styles.search} onSubmit={event => { event.preventDefault(); setPage(1); if (search === query) void load(); else setQuery(search); }}><input aria-label="Tìm IMEI hoặc SN" placeholder="Nhập đầy đủ IMEI hoặc SN" autoCapitalize="characters" spellCheck={false} value={search} maxLength={15} onChange={event => setSearch(event.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())} /><button className={styles.secondary}>Tìm mã</button>{query && <button type="button" className={styles.secondary} onClick={() => { setSearch(""); setQuery(""); setPage(1); }}>Xem hết</button>}</form>
        <div className={styles.items} aria-busy={loading}>
          {!visibleItems.length && <p className={styles.empty}>{query ? "Không tìm thấy mã trong phạm vi bạn được xem." : "Trang này không có lượt cấp mã đang hiển thị."}</p>}
          {visibleItems.map(item => <article className={styles.item} key={`${item.actor}-${item.requestId}`}>
            <div className={styles.itemMain}><div className={styles.itemTop}><strong className={styles.number}>{item.imei || "Chưa cấp mã"}</strong><span className={styles.status} data-status={item.status}>{labels[item.status]}</span></div>
              <p>{isAppleSerial(item.brand) ? "SN" : "IMEI"} · {IMEI_BRANDS[item.brand]} · {date(item.createdAt)}</p>{access.canReport && <p>{item.actorName} · NV {item.actor}</p>}
              <p>User nhận: {item.recipient || "Chưa ghi nhận"} · Siêu thị: {item.storeCode || "Chưa ghi nhận"}</p>
              {item.cancelledAt && <p className={styles.cancellation}>Hủy: {date(item.cancelledAt)} · NV {item.cancelledBy}<br />{item.reason}</p>}
              {item.status === "active" && item.actor === actor && access.canCancelOwn && !access.canManageAll && <p className={styles.cancelWindow} data-expired={!canCancelImei(item, actor, access, now)}>{canCancelImei(item, actor, access, now) ? `Còn ${cancelTimeLeft(item, now)} để hủy` : IMEI_CANCEL_CONTACT}</p>}
            </div>
            <div className={styles.actions}>
              {item.status === "active" && <button type="button" className={styles.secondary} onClick={() => void copy(item.imei!)}>Sao chép</button>}
              {item.status === "pending" && item.actor === actor && access.canCreate && <button type="button" className={styles.secondary} disabled={!!pending && pending.requestId !== item.requestId} onClick={() => void generate({ requestId: item.requestId, brand: item.brand })}>Tiếp tục</button>}
              {item.status === "active" && (access.canManageAll || (access.canCancelOwn && item.actor === actor)) && <button type="button" className={styles.danger} disabled={!canCancelImei(item, actor, access, now)} onClick={() => { setCancel(item); setReason(""); }}>Hủy mã</button>}
            </div>
          </article>)}
        </div>
        <nav className={styles.pagination} aria-label="Trang lịch sử"><button type="button" className={styles.secondary} disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span>Trang {directory.page} / {directory.pages}</span><button type="button" className={styles.secondary} disabled={loading || page >= directory.pages} onClick={() => setPage(page + 1)}>Sau</button></nav>
      </section>
    </>}
    {assigning && <dialog ref={assignment} className={styles.dialog} onCancel={()=>setAssigning(false)} aria-labelledby="imei-recipient-title"><form onSubmit={e=>{e.preventDefault();if(!recipient.trim()||!storeCode.trim())return;setAssigning(false);void generate({requestId:pending?.requestId || newRequestId(),brand:pending?.brand || brand,recipient:recipient.trim(),storeCode:storeCode.trim()});}}><h2 id="imei-recipient-title">Nhân viên nhận IMEI / SN</h2><label>User nhận mã<input autoFocus required maxLength={50} pattern="[a-zA-Z0-9_.@-]+" value={recipient} onChange={e=>setRecipient(e.target.value)}/></label><label>Mã siêu thị<input required inputMode="numeric" pattern="[0-9]+" maxLength={15} value={storeCode} onChange={e=>setStoreCode(e.target.value)}/></label><div className={styles.dialogActions}><button type="button" className={styles.secondary} onClick={()=>setAssigning(false)}>Trở lại</button><button className={styles.primary}>Tạo mã</button></div></form></dialog>}
    {cancel && <dialog ref={confirmation} className={styles.dialog} onCancel={() => setCancel(null)} aria-labelledby="imei-cancel-title"><form onSubmit={event => { event.preventDefault(); void applyCancellation(); }}><h2 id="imei-cancel-title">Hủy lượt cấp mã?</h2><strong className={styles.number}>{cancel.imei}</strong><p>Mã sẽ được phép cấp lại. Lịch sử lượt cấp này vẫn được giữ.</p>{access && !canCancelImei(cancel, actor, access, now) && <p role="alert">{IMEI_CANCEL_CONTACT}</p>}<label htmlFor="imei-cancel-reason">Lý do hủy</label><textarea id="imei-cancel-reason" required maxLength={300} autoFocus value={reason} onChange={event => setReason(event.target.value)} /><div className={styles.dialogActions}><button type="button" className={styles.secondary} onClick={() => setCancel(null)}>Trở lại</button><button className={styles.danger} disabled={!reason.trim() || !access || !canCancelImei(cancel, actor, access, now)}>Hủy mã</button></div></form></dialog>}
    {feedback && <UiFeedbackDialog tone={feedback.tone} onDismiss={() => { if (feedback.tone !== "loading") setFeedback(null); }} onRetry={feedback.retry}>{feedback.text}</UiFeedbackDialog>}
  </div>;
}
