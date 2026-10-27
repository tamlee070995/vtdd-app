"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { TradeinAccess } from "@/lib/tradein-control";
import styles from "./Tradein.module.css";
import UiNotice from "./UiNotice";
import { clientErrorMessage, requestJson } from "@/lib/client-request";
import { defaultGradeGuide, type TradeinGradeGuide } from "@/lib/tradein-grade-guide";
import { TRADEIN_GRADES } from "@/lib/tradein-pricing";

type Summary = { version: string; syncedAt: string; oldCount: number; newCount: number; importedBy: string;
  quality: { incompleteRanges: number; unavailableRanges: number; excludedTablets: number } };
export default function TradeinAdminTool({ canSync, canManage }: { canSync: boolean; canManage: boolean }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [access, setAccess] = useState<TradeinAccess | null>(null);
  const [lockMessage, setLockMessage] = useState("");
  const [busy, setBusy] = useState("LOAD");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [gradeGuide, setGradeGuide] = useState<TradeinGradeGuide>(defaultGradeGuide());
  const load = useCallback(async () => {
    setBusy("LOAD"); setError(""); setMessage("");
    try {
      const result = await requestJson<{ success: boolean; summary: Summary | null; access: TradeinAccess; gradeGuide: TradeinGradeGuide }>("/api/admin/tradein");
      setSummary(result.summary); setAccess(result.access); setLockMessage(result.access.message);
      setGradeGuide(result.gradeGuide || defaultGradeGuide());
    } catch (reason) { setError(clientErrorMessage(reason, "Chưa đọc được trạng thái bảng giá.")); }
    finally { setBusy(""); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function saveGradeGuide() {
    setBusy("SET_GRADE_GUIDE"); setError(""); setMessage("");
    try {
      const result = await requestJson<{ gradeGuide: TradeinGradeGuide; message: string }>("/api/admin/tradein", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SET_GRADE_GUIDE", ...gradeGuide }) });
      setGradeGuide(result.gradeGuide); setMessage(result.message);
    } catch (reason) { setError(clientErrorMessage(reason, "Chưa lưu được định nghĩa phân loại máy.")); }
    finally { setBusy(""); }
  }
  async function mutate(action: "SYNC" | "SET_ACCESS", locked = false) {
    setBusy(action); setError(""); setMessage("");
    try {
      const result = await requestJson<{ success: boolean; summary: Summary; access: TradeinAccess; message: string }>("/api/admin/tradein", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "SYNC"
        ? { action, version: summary?.version || "" } : { action, revision: access?.revision, locked, message: lockMessage }) }, 120_000);
      if (action === "SYNC") {
        setSummary(result.summary);
        setMessage(access?.locked ? "Đã đồng bộ giá. Bấm “Mở lại trang tra giá” khi bạn sẵn sàng." : "Đã đồng bộ giá. Trang đang mở sẽ nhận thông báo và đếm ngược 7 giây để tải lại.");
      } else { setAccess(result.access); setLockMessage(result.access.message); setMessage(result.message); }
    } catch (reason) { setError(clientErrorMessage(reason, "Không lưu được thay đổi.")); }
    finally { setBusy(""); }
  }
  return <section className={styles.admin} aria-label="Đồng bộ giá thu cũ đổi mới" aria-busy={Boolean(busy)}>
    {busy && <UiNotice tone="loading">{busy === "SYNC" ? "Đang đồng bộ giá từ Google Sheet. Vui lòng chờ kết quả…" : busy === "SET_ACCESS" ? "Đang lưu trạng thái trang tra giá…" : busy === "SET_GRADE_GUIDE" ? "Đang lưu định nghĩa Loại 1–5…" : "Đang tải thông tin bảng giá…"}</UiNotice>}
    {error && <UiNotice onRetry={() => void load()} retryLabel={access ? "Kiểm tra trạng thái" : "Thử lại"} busy={Boolean(busy)}>{error}{access && <p>Chưa xác nhận được kết quả. Kiểm tra trạng thái trước khi thực hiện lại thao tác.</p>}</UiNotice>}
    {message && <UiNotice tone="success">{message}</UiNotice>}
    <div className={styles.adminTop}><div><h3>Bảng giá thu cũ đổi mới công khai</h3><p>Đọc giá từ Data_Moi và Data_Cu_PhoneMWG trong Google Sheet đã kết nối. Sau khi đồng bộ thành công, người dùng tra cứu ngay mà không cần đăng nhập.</p></div><Link href="/tra-gia-thu-cu" target="_blank">Mở trang tra giá ↗</Link></div>
    {summary ? <><div className={styles.adminStats}><span><b>{summary.oldCount}</b> máy cũ</span><span><b>{summary.newCount}</b> máy mới</span><span>Cập nhật: <b>{new Date(summary.syncedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false })}</b></span><span>Bởi: <b>{summary.importedBy}</b></span></div>
      {summary.quality.incompleteRanges || summary.quality.unavailableRanges ? <p className={styles.adminNote}>Có {summary.quality.incompleteRanges} cặp thiếu mốc và {summary.quality.unavailableRanges} cặp chưa có giá. Các loại này sẽ không tính trợ giá.</p> : null}
    </> : !busy && access ? <p className={styles.adminNote}>Chưa đồng bộ bảng giá. Bấm đồng bộ để mở dữ liệu tra cứu.</p> : null}
    <div className={styles.adminActions}><button type="button" disabled={Boolean(busy) || !access || !canSync} onClick={() => void mutate("SYNC")}>{busy === "SYNC" ? "Đang đồng bộ…" : "Đồng bộ giá từ Google Sheet"}</button><button type="button" disabled={Boolean(busy)} onClick={() => void load()}>{busy === "LOAD" ? "Đang đọc thông tin…" : "Làm mới thông tin"}</button></div>
    <p className={styles.adminNote}>“Làm mới thông tin” chỉ đọc lại thời gian đồng bộ và trạng thái khóa trên màn hình Admin; không lấy giá từ Google Sheet.</p>
    {!canSync ? <p className={styles.adminNote}>Cần quyền “Đồng bộ giá Google Sheet” để cập nhật bảng giá.</p> : null}
    <div className={styles.accessPanel}>
      <div className={styles.accessHeading}><h4>Đóng / mở trang tra giá</h4><span className={access?.locked ? styles.closedBadge : styles.openBadge}>{access ? access.locked ? "Đang tạm khóa" : "Đang mở" : "Đang đọc…"}</span></div>
      <label htmlFor="tradein-lock-message">Thông báo cho người tra giá khi tạm khóa</label>
      <textarea id="tradein-lock-message" rows={3} maxLength={300} value={lockMessage} disabled={Boolean(busy) || !canManage} onChange={event => setLockMessage(event.target.value)} />
      <div className={styles.adminActions}><button type="button" disabled={Boolean(busy) || !access || !canManage || !lockMessage.trim()} onClick={() => void mutate("SET_ACCESS", !access?.locked)}>{busy === "SET_ACCESS" ? "Đang lưu…" : access?.locked ? "Mở lại trang tra giá" : "Tạm khóa trang tra giá"}</button>
        {access?.locked && lockMessage !== access.message ? <button type="button" disabled={Boolean(busy) || !canManage || !lockMessage.trim()} onClick={() => void mutate("SET_ACCESS", true)}>Lưu thông báo</button> : null}</div>
      <p className={styles.adminNote}>Khi tạm khóa, phần tra cứu bị ẩn. Bạn có thể đồng bộ giá rồi mở lại trang. Trang đang mở kiểm tra thay đổi mỗi 30 giây; khi có giá mới hoặc được mở lại, người dùng nhận nút OK đếm ngược 7 giây.</p>
      {!canManage ? <p className={styles.adminNote}>Cần quyền “Đóng/mở trang tra giá” để sử dụng chức năng này.</p> : null}
    </div>
    <div className={styles.accessPanel}>
      <div className={styles.accessHeading}><h4>Định nghĩa Loại 1–5</h4></div>
      <p className={styles.adminNote}>Nội dung hiển thị khi người tra giá bấm ⓘ. Nhập tiêu chí theo quy trình đang áp dụng; mỗi loại tối đa 600 ký tự.</p>
      {TRADEIN_GRADES.map(grade => <div className={styles.gradeEditor} key={grade}><label htmlFor={`grade-description-${grade}`}>Loại {grade}</label><textarea id={`grade-description-${grade}`} rows={3} maxLength={600} value={gradeGuide.descriptions[grade]} disabled={Boolean(busy) || !canManage} onChange={event => { const value = event.target.value; setGradeGuide(current => ({ ...current, descriptions: { ...current.descriptions, [grade]: value } })); }} /></div>)}
      <div className={styles.adminActions}><button type="button" disabled={Boolean(busy) || !access || !canManage || TRADEIN_GRADES.some(grade => !gradeGuide.descriptions[grade].trim())} onClick={() => void saveGradeGuide()}>{busy === "SET_GRADE_GUIDE" ? "Đang lưu…" : "Lưu định nghĩa Loại 1–5"}</button></div>
      {!canManage && <p className={styles.adminNote}>Cần quyền quản lý trang tra giá để sửa định nghĩa.</p>}
    </div>
    <p className={styles.adminNote}>Nếu Sheet lỗi hoặc sai cấu trúc, lần đồng bộ không thay bảng giá đang lưu.</p>
  </section>;
}
