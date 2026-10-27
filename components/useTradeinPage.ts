"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { TRADEIN_POLL_MS, tradeinRefreshReason, type TradeinRefreshReason, type TradeinStatus } from "@/lib/tradein-control";
import type { TradeinData } from "@/lib/tradein-pricing";
import { clientErrorMessage } from "@/lib/client-request";
import { defaultGradeGuide, type GradeDescriptions } from "@/lib/tradein-grade-guide";

export default function useTradeinPage() {
  const [data, setData] = useState<TradeinData | null>(null);
  const [gradeGuide, setGradeGuide] = useState<GradeDescriptions>(defaultGradeGuide().descriptions);
  const [status, setStatus] = useState<TradeinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [refreshReason, setRefreshReason] = useState<TradeinRefreshReason | null>(null);
  const loadedAt = useRef("");
  const lastStatus = useRef<TradeinStatus | null>(null);
  const receiveStatus = useCallback((next: TradeinStatus) => {
    const reason = tradeinRefreshReason(lastStatus.current, next, loadedAt.current);
    lastStatus.current = next;
    setStatus(next);
    if (next.locked) setRefreshReason(null);
    else if (reason) setRefreshReason(current => current || reason);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    setLoading(true); setError("");
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    void (async () => {
      try {
        const response = await fetch("/api/tradein", { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (stopped) return;
        if (payload.code === "TRADEIN_LOCKED" && payload.status?.locked) { receiveStatus(payload.status); return; }
        if (!response.ok || !payload.success) throw new Error(payload.message || "Chưa tải được bảng giá.");
        // A lock detected during this request takes priority over its price response.
        if (!lastStatus.current?.locked) { loadedAt.current = payload.data.syncedAt; setData(payload.data); setGradeGuide(payload.gradeGuide || defaultGradeGuide().descriptions); }
      } catch (reason) {
        if (!stopped) setError(clientErrorMessage(reason, "Chưa tải được bảng giá."));
      } finally { window.clearTimeout(timeout); if (!stopped) setLoading(false); }
    })();
    return () => { stopped = true; controller.abort(); window.clearTimeout(timeout); };
  }, [receiveStatus, attempt]);

  useEffect(() => {
    let stopped = false, inFlight = false, lastCheck = 0;
    let controller: AbortController | null = null;
    const check = async () => {
      if (stopped || inFlight || document.visibilityState === "hidden" || !navigator.onLine || Date.now() - lastCheck < 5000) return;
      inFlight = true; lastCheck = Date.now();
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 10_000);
      try {
        const response = await fetch("/api/tradein/status", { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!stopped && response.ok && payload.success && typeof payload.status?.locked === "boolean") receiveStatus(payload.status);
      } catch { /* Retry on the next visible check; keep the loaded timestamp on screen. */ }
      finally { window.clearTimeout(timeout); inFlight = false; }
    };
    const wake = () => { void check(); };
    const interval = window.setInterval(wake, TRADEIN_POLL_MS);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);
    wake();
    return () => {
      stopped = true; controller?.abort(); window.clearInterval(interval);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", wake);
    };
  }, [receiveStatus]);
  return { data, gradeGuide, status, loading, error, refreshReason, retry: () => setAttempt(value => value + 1) };
}
