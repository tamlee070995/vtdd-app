"use client";

import { useEffect } from "react";

export default function AdminLoginKeyBridge() {
  useEffect(() => {
    const maNV = document.getElementById("admin-maNV") as HTMLInputElement | null;
    const password = document.getElementById("admin-password") as HTMLInputElement | null;

    if (!maNV || !password) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        password?.focus();
      }
    }

    maNV.addEventListener("keydown", handleKeyDown);

    return () => {
      maNV.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
