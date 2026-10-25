"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import styles from "./NavigationFeedback.module.css";

export default function HomeNavigationFeedback({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [notice, setNotice] = useState<{ label: string; slow: boolean } | null>(null);
  const selectedLink = useRef<HTMLAnchorElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    selectedLink.current?.removeAttribute("data-opening");
    selectedLink.current?.removeAttribute("aria-busy");
    selectedLink.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const dismiss = useCallback(() => {
    clearPending();
    setNotice(null);
  }, [clearPending]);

  useEffect(() => {
    // Reset when this page is restored from browser history as well as on navigation.
    window.addEventListener("pageshow", dismiss);
    window.addEventListener("popstate", dismiss);
    return () => {
      window.removeEventListener("pageshow", dismiss);
      window.removeEventListener("popstate", dismiss);
      clearPending();
    };
  }, [pathname, dismiss, clearPending]);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin) return;
    if (destination.pathname === window.location.pathname) return;

    clearPending();
    selectedLink.current = link;
    link.setAttribute("data-opening", "true");
    link.setAttribute("aria-busy", "true");
    const label = (link.querySelector("b")?.textContent || link.textContent || "Trang đã chọn").replace(/\s+/g, " ").trim();
    setNotice({ label, slow: false });
    timer.current = setTimeout(() => {
      clearPending();
      setNotice({ label, slow: true });
    }, 10000);
  }

  return <div onClickCapture={handleClick}>
    {children}
    {notice && <div className={styles.toast} role="status" aria-live="polite" aria-atomic="true">
      {!notice.slow && <span className={styles.spinner} aria-hidden="true" />}
      <span className={styles.message}><strong>{notice.slow ? "Trang đang mở chậm" : "Đang mở…"}</strong><small>{notice.slow ? "Bạn có thể chạm lại mục để thử." : notice.label}</small></span>
      {notice.slow && <button type="button" onClick={dismiss} aria-label="Đóng thông báo">×</button>}
    </div>}
  </div>;
}
