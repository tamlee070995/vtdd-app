"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./NavigationFeedback.module.css";

const NavigationContext = createContext({ loading: false });
export const useAppNavigation = () => useContext(NavigationContext);

export default function AppNavigationFeedback({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState<{ from: string; href: string; slow: boolean; skeleton: boolean } | null>(null);
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = useCallback(() => {
    linkRef.current?.removeAttribute("data-opening");
    linkRef.current?.removeAttribute("aria-busy");
    linkRef.current = null;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPending(null);
  }, []);

  useEffect(() => {
    clear();
    window.addEventListener("pageshow", clear);
    window.addEventListener("popstate", clear);
    return () => {
      window.removeEventListener("pageshow", clear);
      window.removeEventListener("popstate", clear);
      timers.current.forEach(clearTimeout);
    };
  }, [pathname, clear]);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname) return;
    clear();
    linkRef.current = link;
    link.setAttribute("data-opening", "true");
    link.setAttribute("aria-busy", "true");
    setPending({ from: pathname, href: url.pathname + url.search + url.hash, slow: false, skeleton: false });
    timers.current.push(setTimeout(() => setPending(value => value && ({ ...value, skeleton: true })), 250));
    timers.current.push(setTimeout(() => setPending(value => value && ({ ...value, slow: true, skeleton: false })), 12000));
  }

  const current = pending?.from === pathname ? pending : null;
  return <NavigationContext.Provider value={{ loading: Boolean(current?.skeleton) }}>
    <div onClickCapture={handleClick}>
      {current && <div className={styles.progress} role="status" aria-label="Đang mở trang"><span /></div>}
      {children}
      {current?.slow && <div className={styles.toast} role="status">
        <span className={styles.message}><strong>Trang đang mở chậm</strong><small>Kiểm tra kết nối và thử lại.</small></span>
        <button type="button" onClick={() => { const href = current.href; clear(); router.push(href); router.refresh(); }}>Thử lại</button>
        <button type="button" onClick={clear} aria-label="Đóng thông báo">×</button>
      </div>}
    </div>
  </NavigationContext.Provider>;
}
