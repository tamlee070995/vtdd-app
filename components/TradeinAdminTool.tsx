"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "./Tradein.module.css";

type Summary = { version: string; syncedAt: string; oldCount: number; newCount: number; importedBy: string;
  quality: { incompleteRanges: number; unavailableRanges: number; excludedTablets: number } };
export default function TradeinAdminTool({ canSync }: { canSync: boolean }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const request = useCallback(async (version?: string) => {
    const sync = typeof version === "string";
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/tradein", { cache: "no-store", ...(sync ? {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version }),
      } : {}) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Chưa đọc được trạng thái bảng giá.");
      setSummary(result.summary); setReady(true);
      if (sync) setMessage(result.message);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không đồng bộ được bảng giá."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void request(); }, [request]);
  return <section className={styles.admin} aria-label="Đồng bộ giá thu cũ đổi mới">
    <div className={styles.adminTop}><div><h3>Bảng giá thu cũ đổi mới công khai</h3><p>Đọc giá từ Data_Moi và Data_Cu_PhoneMWG trong Google Sheet đã kết nối. Sau khi đồng bộ thành công, người dùng tra cứu ngay mà không cần đăng nhập.</p></div><Link href="/tra-gia-thu-cu" target="_blank">Mở trang tra giá ↗</Link></div>
    {summary ? <><div className={styles.adminStats}><span><b>{summary.oldCount}</b> máy cũ</span><span><b>{summary.newCount}</b> máy mới</span><span>Cập nhật: <b>{new Date(summary.syncedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false })}</b></span><span>Bởi: <b>{summary.importedBy}</b></span></div>
      {summary.quality.incompleteRanges || summary.quality.unavailableRanges ? <p className={styles.adminNote}>Có {summary.quality.incompleteRanges} cặp thiếu mốc và {summary.quality.unavailableRanges} cặp chưa có giá. Các loại này sẽ không tính trợ giá.</p> : null}
    </> : !loading && ready ? <p className={styles.adminNote}>Chưa đồng bộ bảng giá. Bấm đồng bộ để mở dữ liệu tra cứu.</p> : null}
    <div className={styles.adminActions}><button type="button" disabled={loading || !ready || !canSync} onClick={() => void request(summary?.version || "")}>{loading ? "Đang xử lý…" : "Đồng bộ giá từ Google Sheet"}</button><button type="button" disabled={loading} onClick={() => void request()}>Tải lại trạng thái</button></div>
    {!canSync ? <p className={styles.adminNote}>Cần quyền “Tải lại dữ liệu” để đồng bộ bảng giá.</p> : null}
    <p className={styles.adminNote}>Giá chỉ thay đổi sau khi đồng bộ thành công. Nếu Sheet lỗi hoặc sai cấu trúc, bản giá trước vẫn được giữ lại. Trang này hiện tra giá điện thoại theo bộ code cung cấp.</p>
    {error ? <div className={styles.error} role="alert" style={{ marginTop: 16 }}>{error}</div> : null}
    {message ? <div className={styles.success} role="status">{message}</div> : null}
  </section>;
}
