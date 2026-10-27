"use client";

import type { ReactNode } from "react";

export default function UiNotice({ tone = "error", children, onRetry, retryLabel = "Thử lại", busy = false }: {
  tone?: "error" | "success" | "loading" | "info"; children: ReactNode; onRetry?: () => void; retryLabel?: string; busy?: boolean;
}) {
  return <div className={`ui-notice ui-notice-${tone}`} role={tone === "error" ? "alert" : "status"} aria-atomic="true">
    <span className={tone === "loading" ? "ui-spinner" : "ui-notice-icon"} aria-hidden="true">{tone === "loading" ? "" : tone === "success" ? "✓" : tone === "error" ? "!" : "i"}</span>
    <div className="ui-notice-text">{children}</div>
    {onRetry && <button className="ui-button ui-button-secondary" type="button" disabled={busy} onClick={onRetry}>{busy ? "Đang tải…" : retryLabel}</button>}
  </div>;
}
