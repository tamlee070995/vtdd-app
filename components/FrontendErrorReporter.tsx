"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function sendFrontendError(payload: Record<string, unknown>) {
  try {
    fetch("/api/error-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Ignore logging failures.
  }
}

export default function FrontendErrorReporter() {
  const pathname = usePathname();

  useEffect(() => {
    function onError(event: ErrorEvent) {
      sendFrontendError({
        module: "frontend",
        page: pathname || window.location.pathname,
        message: event.message,
        stack: event.error?.stack || "",
      });
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason: any = event.reason;
      sendFrontendError({
        module: "frontend",
        page: pathname || window.location.pathname,
        message: reason?.message || String(reason || "Unhandled promise rejection"),
        stack: reason?.stack || "",
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [pathname]);

  return null;
}
