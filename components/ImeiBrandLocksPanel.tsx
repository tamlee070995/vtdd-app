"use client";

import { useState } from "react";
import { IMEI_BRANDS, type ImeiBrand, type ImeiBrandLocks } from "@/lib/imei";
import { clientErrorMessage, requestJson } from "@/lib/client-request";
import UiFeedbackDialog from "./UiFeedbackDialog";
import styles from "./ImeiAdminTool.module.css";

export default function ImeiBrandLocksPanel({ policy, onSaved }: { policy: ImeiBrandLocks; onSaved: (policy: ImeiBrandLocks) => void }) {
  const [draft, setDraft] = useState<ImeiBrandLocks | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "loading" | "error" | "success"; text: string } | null>(null);
  const selected = draft || policy;
  const saving = feedback?.tone === "loading";
  const changed = [...selected.lockedBrands].sort().join(",") !== [...policy.lockedBrands].sort().join(",");
  const stale = !!draft && draft.revision !== policy.revision;
  async function save() {
    if (saving || !draft || stale) return;
    setFeedback({ tone: "loading", text: "Đang lưu tình trạng khóa hãng…" });
    try {
      const result = await requestJson<{ success: boolean; policy: ImeiBrandLocks; message: string }>("/api/admin/imei/brand-locks", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: draft.revision, lockedBrands: draft.lockedBrands }),
      });
      onSaved(result.policy); setDraft(null);
      setFeedback({ tone: "success", text: result.message });
    } catch (error) { setFeedback({ tone: "error", text: clientErrorMessage(error) }); }
  }
  return <section className={styles.brandLocks} aria-label="Khóa tạo IMEI máy cũ theo hãng">
    <h3>Khóa tạo IMEI máy cũ theo hãng</h3>
    <p>Đánh dấu hãng cần khóa, rồi bấm Lưu. Bỏ dấu để mở lại. Áp dụng cho mọi người tạo mã IMEI / SN.</p>
    <div className={styles.brandLockChoices}>
      {Object.entries(IMEI_BRANDS).map(([key, label]) => <label key={key}>
        <input type="checkbox" aria-label={label} checked={selected.lockedBrands.includes(key as ImeiBrand)} disabled={saving}
          onChange={event => setDraft({ ...selected, lockedBrands: event.target.checked ? [...selected.lockedBrands, key as ImeiBrand] : selected.lockedBrands.filter(brand => brand !== key) })} />
        <span>{label}<small aria-hidden="true">{selected.lockedBrands.includes(key as ImeiBrand) ? (draft ? "Sẽ khóa" : "Đang khóa") : (draft ? "Sẽ mở" : "Đang mở")}</small></span>
      </label>)}
    </div>
    {stale && <p role="alert">Tình trạng khóa vừa đổi ở phiên khác. Bấm Lấy tình trạng mới rồi chọn lại hãng.</p>}
    <div className={styles.actions}>
      <button type="button" className={styles.primary} disabled={saving || !changed || stale} onClick={() => void save()}>Lưu khóa hãng</button>
      {draft && <button type="button" className={styles.secondary} disabled={saving} onClick={() => setDraft(null)}>{stale ? "Lấy tình trạng mới" : "Bỏ thay đổi"}</button>}
    </div>
    {policy.updatedAt && <p>Lần lưu gần nhứt: {new Date(policy.updatedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · NV {policy.updatedBy}</p>}
    {feedback && <UiFeedbackDialog tone={feedback.tone} onDismiss={() => { if (!saving) setFeedback(null); }} onRetry={feedback.tone === "error" ? () => void save() : undefined}>{feedback.text}</UiFeedbackDialog>}
  </section>;
}
