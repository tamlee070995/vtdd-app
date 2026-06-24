"use client";

import { useEffect, useState } from "react";

const BOOT_SPLASH_KEY = "vtdd-app-boot-splash-seen-v1";

export default function AppBootSplash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(BOOT_SPLASH_KEY) === "1") return;
      sessionStorage.setItem(BOOT_SPLASH_KEY, "1");
    } catch {
      // If storage is unavailable, still keep the splash short and non-blocking.
    }

    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 950);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <main className="vtdd-app-loading vtdd-app-loading-overlay" role="status" aria-live="polite">
      <section className="vtdd-app-loading-card" aria-label="Đang tải VTDD App">
        <div className="vtdd-app-loading-logo">
          <img src="/mwg-logo.svg" alt="Viễn Thông Di Động" />
        </div>
        <h1>Viễn Thông Di Động</h1>
        <strong>VTDD App</strong>
        <p>Đang khởi động hệ thống</p>
        <div className="vtdd-app-loading-bar" aria-hidden="true">
          <span />
        </div>
      </section>
    </main>
  );
}
