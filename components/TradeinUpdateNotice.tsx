"use client";
import { useEffect, useRef, useState } from "react";
import { TRADEIN_RELOAD_SECONDS, type TradeinRefreshReason } from "@/lib/tradein-control";
import styles from "./Tradein.module.css";

export default function TradeinUpdateNotice({ reason }: { reason: TradeinRefreshReason }) {
  const [remaining, setRemaining] = useState(TRADEIN_RELOAD_SECONDS);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus();
    const deadline = Date.now() + TRADEIN_RELOAD_SECONDS * 1000;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) { window.clearInterval(timer); window.location.reload(); }
    }, 200);
    return () => window.clearInterval(timer);
  }, []);
  return <div className={styles.updateOverlay}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="tradein-update-title" aria-describedby="tradein-update-description" className={styles.updateDialog}
      onKeyDown={event => { if (event.key === "Tab") { event.preventDefault(); button.current?.focus(); } }}>
      <span className={styles.updateIcon} aria-hidden="true">↻</span>
      <h2 id="tradein-update-title">{reason === "reopened" ? "Trang tra giá đã mở lại" : "Bảng giá vừa được cập nhật"}</h2>
      <p id="tradein-update-description">Nhấn OK để tải lại trang và dùng bảng giá hiện tại. Trang sẽ tự tải lại sau 7 giây.</p>
      <button ref={button} type="button" onClick={() => window.location.reload()}>OK — Tải lại ({remaining}s)</button>
    </section>
  </div>;
}
