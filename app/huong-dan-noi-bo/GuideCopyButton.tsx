"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function GuideCopyButton() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className={styles.copyButton} type="button" onClick={handleCopy}>
      <span aria-hidden="true">▣</span>
      {copied ? "Đã copy" : "Copy"}
    </button>
  );
}
