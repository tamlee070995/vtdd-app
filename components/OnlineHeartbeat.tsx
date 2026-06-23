"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type OnlinePageKey = "home" | "staff" | "customer";

function getPageKey(pathname: string): OnlinePageKey | "" {
  const path = pathname || "/";

  if (path === "/") return "home";
  if (path.startsWith("/staff")) return "staff";
  if (path.startsWith("/khach-hang")) return "customer";

  return "";
}

function getVisitorId() {
  try {
    const key = "vtdd_online_visitor_id";
    const existing = window.localStorage.getItem(key);

    if (existing) return existing;

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    window.localStorage.setItem(key, id);
    return id;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function detectDevice() {
  const ua = navigator.userAgent || "";
  if (/ipad|tablet/i.test(ua)) return "Tablet";
  if (/mobile|iphone|android/i.test(ua)) return "Mobile";
  return "May tinh";
}

export default function OnlineHeartbeat() {
  const pathname = usePathname();
  const activePageRef = useRef<OnlinePageKey | "">("");
  const visitorIdRef = useRef("");

  useEffect(() => {
    visitorIdRef.current = getVisitorId();
  }, []);

  useEffect(() => {
    const page = getPageKey(pathname || "/");
    activePageRef.current = page;

    if (!page) return;

    let stopped = false;

    async function sendHeartbeat(eventType: "heartbeat" | "leave" = "heartbeat") {
      try {
        const visitorId = visitorIdRef.current || getVisitorId();

        if (!visitorId || !activePageRef.current) return;

        if (eventType === "leave" && navigator.sendBeacon) {
          const payload = new Blob(
            [
              JSON.stringify({
                page: activePageRef.current,
                visitorId,
                eventType,
                path: window.location.pathname,
                device: detectDevice(),
              }),
            ],
            { type: "application/json" }
          );

          navigator.sendBeacon("/api/online/heartbeat", payload);
          return;
        }

        await fetch("/api/online/heartbeat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
          cache: "no-store",
          body: JSON.stringify({
            page: activePageRef.current,
            visitorId,
            eventType,
            path: window.location.pathname,
            device: detectDevice(),
          }),
          keepalive: eventType === "leave",
        });
      } catch {
        // Không chặn UI nếu heartbeat lỗi.
      }
    }

    sendHeartbeat("heartbeat");

    const timer = window.setInterval(() => {
      if (!stopped) sendHeartbeat("heartbeat");
    }, 25000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        sendHeartbeat("heartbeat");
      }
    }

    function handleBeforeUnload() {
      sendHeartbeat("leave");
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      sendHeartbeat("leave");
    };
  }, [pathname]);

  return null;
}
