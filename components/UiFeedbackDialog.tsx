"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./UiFeedbackDialog.module.css";

export default function UiFeedbackDialog({ tone, children, onDismiss, onRetry, retryLabel = "Thử lại" }: {
  tone: "loading" | "success" | "error";
  children: ReactNode;
  onDismiss: () => void;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement;
    node?.showModal();
    return () => {
      node?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (tone !== "loading") primary.current?.focus({ preventScroll: true });
  }, [tone]);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`}
    onCancel={event => { event.preventDefault(); if (tone !== "loading") onDismiss(); }}>
    <div className={styles.body}>
      <span className={`${styles.icon} ${styles[tone]}`} aria-hidden="true">{tone === "loading" ? <span className="ui-spinner" /> : tone === "success" ? "✓" : "!"}</span>
      <h2 id={`${id}-title`}>{tone === "loading" ? "Đang xử lý" : tone === "success" ? "Đã xong" : "Chưa làm xong"}</h2>
      <div id={`${id}-body`} className={styles.message} role={tone === "error" ? "alert" : "status"}>{children}</div>
      {tone !== "loading" && <div className={styles.actions}>
        {tone === "error" && onRetry && <button type="button" className={styles.secondary} onClick={onDismiss}>Đóng</button>}
        <button ref={primary} type="button" onClick={tone === "error" && onRetry ? onRetry : onDismiss}>{tone === "error" && onRetry ? retryLabel : "Đã hiểu"}</button>
      </div>}
    </div>
  </dialog>;
}
