"use client";

import Link from "next/link";
import { useTransition } from "react";

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [pending, startTransition] = useTransition();
  return <main className="ui-error-page"><section className="ui-error-card" role="alert"><span className="ui-error-mark" aria-hidden="true">!</span><h1>Chưa tải được trang</h1><p>Kết nối hoặc hệ thống đang gián đoạn. Bạn có thể thử tải lại trang này.</p><div className="ui-error-actions"><button className="ui-button" disabled={pending} onClick={() => startTransition(reset)}>{pending ? "Đang tải lại…" : "Thử lại"}</button><Link className="ui-button ui-button-secondary" href="/">Về trang chủ</Link></div></section></main>;
}
