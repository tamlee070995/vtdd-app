"use client";

import { useEffect } from "react";

// Use the visible viewport so a mobile keyboard cannot cover form dialogs.
export default function MobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    let frame = 0;
    let restingHeight = window.innerHeight;
    let restingWidth = window.innerWidth;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = viewport?.height || window.innerHeight;
        document.documentElement.style.setProperty("--ui-visual-height", `${height}px`);
        document.documentElement.style.setProperty("--ui-visual-top", `${viewport?.offsetTop || 0}px`);
        const target = document.activeElement;
        const editing = target instanceof HTMLElement && target.matches('input:not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]');
        if (!editing || Math.abs(window.innerWidth - restingWidth) > 80) { restingHeight = window.innerHeight; restingWidth = window.innerWidth; }
        const keyboard = editing && Math.max(restingHeight, window.innerHeight) - height > 120 && (viewport?.scale || 1) < 1.2;
        document.body.toggleAttribute("data-keyboard-open", keyboard);
        if (keyboard && target instanceof HTMLElement) {
          const rect = target.getBoundingClientRect();
          if (rect.bottom > height + (viewport?.offsetTop || 0) - 16) target.scrollIntoView({ block: "nearest", behavior: "auto" });
        }
      });
    };
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.body.removeAttribute("data-keyboard-open");
    };
  }, []);
  return null;
}
