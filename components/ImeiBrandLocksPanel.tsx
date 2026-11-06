"use client";

import { useEffect, useRef, useState } from "react";
import { IMEI_BRANDS, type ImeiBrand, type ImeiBrandLocks } from "@/lib/imei";
import { clientErrorMessage, requestJson } from "@/lib/client-request";
import UiFeedbackDialog from "./UiFeedbackDialog";
import styles from "./ImeiAdminTool.module.css";

export default function ImeiBrandLocksPanel({ policy, onSaved }: { policy: ImeiBrandLocks; onSaved: (policy: ImeiBrandLocks) => void }) {
  const [open, setOpen] = useState(false), [discard, setDiscard] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<ImeiBrandLocks | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "loading" | "error" | "success"; text: string } | null>(null);
  const selected = draft || policy;
  const saving = feedback?.tone === "loading";
  const changed = [...selected.lockedBrands].sort().join(",") !== [...policy.lockedBrands].sort().join(",");
  const stale = !!draft && draft.revision !== policy.revision;
  useEffect(() => {
    if (!open) return;
    const node = dialog.current, previous = document.activeElement;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    node?.showModal();
    return () => {
      node?.close();
      document.documentElement.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);
  function close() {
    if (saving) return;
    if (draft && (changed || stale)) { setDiscard(true); return; }
    setDraft(null); setOpen(false);
  }
  function discardClose() { setDraft(null); setDiscard(false); setOpen(false); }
  async function save() {
    if (saving || !draft || stale) return;
    setFeedback({ tone: "loading", text: "Đang lưu tình trạng khóa hãng…" });
    try {
      const result = await requestJson<{ success: boolean; policy: ImeiBrandLocks; message: string }>("/api/admin/imei/brand-locks", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: draft.revision, lockedBrands: draft.lockedBrands }),
      });
      onSaved(result.policy); setDraft(null); setOpen(false);
      setFeedback({ tone: "success", text: result.message });
    } catch (error) { setFeedback({ tone: "error", text: clientErrorMessage(error) }); }
  }
  return <>
    <button type="button" className={`${styles.secondary} ${styles.manageBrands}`} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { setDraft(null); setDiscard(false); setOpen(true); }}>
      <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M2 5h5m4 0h7M2 10h9m4 0h3M2 15h3m4 0h9M8 2v6m4-1v6m-6-1v6" /></svg>
      Quản lý hãng
    </button>
    {open && <dialog ref={dialog} className={styles.brandDrawer} aria-labelledby="imei-brand-manager-title" onCancel={event => { event.preventDefault(); close(); }}>
      <header className={styles.brandDrawerHeader}>
        <div><span className={styles.eyebrow}>QUẢN LÝ SỔ MÃ</span><h2 id="imei-brand-manager-title">Quản lý hãng</h2></div>
        <button type="button" className={styles.secondary} aria-label="Đóng quản lý hãng" disabled={saving} onClick={close}>×</button>
      </header>
      <div className={styles.brandDrawerBody}>
    <p>Đánh dấu hãng cần khóa tạo mã. Bỏ dấu để mở lại.</p>
    <div className={styles.brandLockChoices}>
      {Object.entries(IMEI_BRANDS).map(([key, label]) => <label key={key}>
        <span>{label}<small aria-hidden="true">{selected.lockedBrands.includes(key as ImeiBrand) ? (draft ? "Sẽ khóa" : "Đang khóa") : (draft ? "Sẽ mở" : "Đang mở")}</small></span>
        <input type="checkbox" aria-label={label} checked={selected.lockedBrands.includes(key as ImeiBrand)} disabled={saving}
          onChange={event => setDraft({ ...selected, lockedBrands: event.target.checked ? [...selected.lockedBrands, key as ImeiBrand] : selected.lockedBrands.filter(brand => brand !== key) })} />
      </label>)}
    </div>
    {stale && <p role="alert">Tình trạng khóa vừa đổi ở phiên khác. Bấm Lấy tình trạng mới rồi chọn lại hãng.</p>}
    {stale && <button type="button" className={styles.secondary} disabled={saving} onClick={() => setDraft(null)}>Lấy tình trạng mới</button>}
    {policy.updatedAt && <p>Lần lưu gần nhứt: {new Date(policy.updatedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · NV {policy.updatedBy}</p>}
      </div>
      <footer className={styles.brandDrawerFooter}>
        {discard ? <><p>Bỏ các thay đổi chưa lưu?</p><button type="button" className={styles.secondary} onClick={() => setDiscard(false)}>Tiếp tục chỉnh</button><button type="button" className={styles.primary} onClick={discardClose}>Bỏ thay đổi</button></> : <>
          <button type="button" className={styles.secondary} disabled={saving} onClick={close}>Trở lại</button>
          <button type="button" className={styles.primary} disabled={saving || !changed || stale} onClick={() => void save()}>Lưu thay đổi</button>
        </>}
      </footer>
    </dialog>}
    {feedback && <UiFeedbackDialog tone={feedback.tone} onDismiss={() => { if (!saving) setFeedback(null); }} onRetry={feedback.tone === "error" ? () => void save() : undefined}>{feedback.text}</UiFeedbackDialog>}
  </>;
}
