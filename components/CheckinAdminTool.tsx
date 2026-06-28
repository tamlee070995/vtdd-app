"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CheckinCustomer = {
  id: string;
  stt: number | null;
  sdt: string;
  tenKH: string;
  maSO: string;
  checkedIn: boolean;
  checkinTime: string;
};

type CheckinDashboard = {
  total: number;
  checkedIn: number;
  waiting: number;
  firstCheckin: string;
  latestCheckin: string;
};

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmText: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
} | null;

const EMPTY_DASHBOARD: CheckinDashboard = {
  total: 0,
  checkedIn: 0,
  waiting: 0,
  firstCheckin: "",
  latestCheckin: "",
};

function number(value: number) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function CheckinAdminTool() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<CheckinCustomer[]>([]);
  const [dashboard, setDashboard] = useState<CheckinDashboard>(EMPTY_DASHBOARD);
  const [query, setQuery] = useState("");
  const [replaceImport, setReplaceImport] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);

  const visibleRows = useMemo(() => {
    const needle = normalize(query);
    return rows
      .filter((row) => {
        if (!needle) return true;
        return normalize(`${row.sdt} ${row.tenKH} ${row.maSO}`).includes(needle);
      })
      .slice(0, 200);
  }, [query, rows]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function loadData(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) setLoading(true);
      const res = await fetch("/api/admin/tools/checkin", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Không tải được dữ liệu Check-in.");

      setRows(Array.isArray(data.rows) ? data.rows : []);
      setDashboard(data.dashboard || EMPTY_DASHBOARD);
      setNotice(String(data.message || ""));
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      const message = err?.message || "Không tải được dữ liệu Check-in.";
      setRows([]);
      setDashboard(EMPTY_DASHBOARD);
      setNotice(message);
      showToast(message);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function postToggle(row: CheckinCustomer, checkedIn: boolean) {
    setBusy(`toggle-${row.id}`);
    const res = await fetch("/api/admin/tools/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      cache: "no-store",
      body: JSON.stringify({ action: "TOGGLE_CHECKIN", id: row.id, checkedIn }),
    });
    const data = await res.json().catch(() => null);
    setBusy("");

    if (!res.ok || !data?.success) throw new Error(data?.message || "Không cập nhật được Check-in.");
    showToast(data.message || "Đã cập nhật Check-in.");
    await loadData({ silent: true });
  }

  function askToggle(row: CheckinCustomer, checkedIn: boolean) {
    setConfirmDialog({
      title: checkedIn ? "Xác nhận check-in" : "Bỏ check-in khách hàng",
      message: checkedIn
        ? `Bạn muốn check-in cho khách hàng ${row.tenKH || row.sdt || row.maSO} chứ?`
        : `Bạn muốn bỏ check-in của khách hàng ${row.tenKH || row.sdt || row.maSO} chứ?`,
      confirmText: checkedIn ? "Check-in" : "Bỏ check-in",
      danger: !checkedIn,
      onConfirm: () => postToggle(row, checkedIn),
    });
  }

  async function runConfirmAction() {
    const action = confirmDialog?.onConfirm;
    setConfirmDialog(null);
    try {
      await action?.();
    } catch (err: any) {
      setBusy("");
      showToast(err?.message || "Không xử lý được Check-in.");
    }
  }

  async function importCsv() {
    try {
      const file = fileRef.current?.files?.[0];
      if (!file) {
        showToast("Chưa chọn file CSV Check-in.");
        return;
      }

      const form = new FormData();
      form.set("file", file);
      form.set("replace", replaceImport ? "1" : "0");

      setBusy("import");
      const res = await fetch("/api/admin/tools/checkin", {
        method: "POST",
        cache: "no-store",
        body: form,
      });
      const data = await res.json().catch(() => null);
      setBusy("");

      if (!res.ok || !data?.success) throw new Error(data?.message || "Không import được Check-in.");
      if (fileRef.current) fileRef.current.value = "";
      showToast(data.message || "Đã import danh sách Check-in.");
      await loadData({ silent: true });
    } catch (err: any) {
      setBusy("");
      showToast(err?.message || "Không import được Check-in.");
    }
  }

  function exportCsv() {
    window.location.href = "/api/admin/tools/checkin?export=csv";
  }

  return (
    <section className="checkin-admin-tool">
      <style>{STYLE}</style>

      <div className="checkin-admin-head">
        <div>
          <span>EVENT CHECK-IN</span>
          <h3>Quản trị Check-in khách hàng</h3>
          <p>Import danh sách khách, check-in tại quầy và xếp STT tự động theo thời gian đến.</p>
        </div>
        <button type="button" onClick={() => loadData()} disabled={loading}>
          {loading ? "Đang tải..." : "Tải lại"}
        </button>
      </div>

      <div className="checkin-metrics">
        <div><span>Tổng khách</span><b>{number(dashboard.total)}</b></div>
        <div><span>Đã check-in</span><b>{number(dashboard.checkedIn)}</b></div>
        <div><span>Chưa check-in</span><b>{number(dashboard.waiting)}</b></div>
        <div><span>Khách mới nhất</span><b>{dashboard.latestCheckin || "—"}</b></div>
      </div>

      {notice ? (
        <div className="checkin-admin-notice" role="status">
          <b>Chưa sẵn sàng dữ liệu Check-in</b>
          <span>{notice}</span>
          <small>Nếu chưa tạo bảng, mở Supabase SQL Editor và chạy file database/checkin_customers.sql trong source code.</small>
        </div>
      ) : null}

      <div className="checkin-admin-grid">
        <section className="checkin-card">
          <h4>Import danh sách</h4>
          <p>CSV cần có header: <b>STT, SDT, TenKH, MaSO</b>. Có thể để trống STT, hệ thống sẽ tự đánh số sau khi check-in.</p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" />
          <label className="checkin-replace">
            <input type="checkbox" checked={replaceImport} onChange={(event) => setReplaceImport(event.target.checked)} />
            <span>Thay bằng danh sách mới, xóa dữ liệu cũ trước khi import</span>
          </label>
          <button type="button" onClick={importCsv} disabled={busy === "import"}>
            {busy === "import" ? "Đang import..." : "Import CSV"}
          </button>
        </section>

        <section className="checkin-card">
          <h4>Export dữ liệu</h4>
          <p>Tải file CSV gồm STT, số điện thoại, tên khách, mã SO và thời gian check-in để đối soát sau event.</p>
          <div className="checkin-export-box">
            <span>Khách đầu tiên</span>
            <b>{dashboard.firstCheckin || "Chưa có"}</b>
          </div>
          <button type="button" className="dark" onClick={exportCsv}>
            Export CSV
          </button>
        </section>
      </div>

      <div className="checkin-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm nhanh SDT, tên khách hoặc mã SO..."
        />
        <span>Hiển thị {number(visibleRows.length)} / {number(rows.length)} khách</span>
      </div>

      <div className="checkin-table">
        <div className="checkin-row head">
          <span>STT</span>
          <span>Khách hàng</span>
          <span>SDT</span>
          <span>Mã SO</span>
          <span>Thời gian</span>
          <span>Thao tác</span>
        </div>

        {visibleRows.length === 0 ? (
          <div className="checkin-empty">Chưa có khách hàng phù hợp.</div>
        ) : (
          visibleRows.map((row) => (
            <div className={`checkin-row ${row.checkedIn ? "done" : ""}`} key={row.id}>
              <span>{row.stt || "—"}</span>
              <span><b>{row.tenKH || "Chưa có tên"}</b></span>
              <span>{row.sdt || "—"}</span>
              <span>{row.maSO || "—"}</span>
              <span>{row.checkinTime || "Chưa check-in"}</span>
              <span>
                <button
                  type="button"
                  className={row.checkedIn ? "undo" : ""}
                  onClick={() => askToggle(row, !row.checkedIn)}
                  disabled={busy === `toggle-${row.id}`}
                >
                  {row.checkedIn ? "Bỏ check-in" : "Check-in"}
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      {confirmDialog ? (
        <div className="checkin-confirm-layer" role="alertdialog" aria-modal="true" aria-labelledby="checkinConfirmTitle">
          <div className="checkin-confirm-card">
            <span>{confirmDialog.danger ? "Cần xác nhận" : "Xác nhận check-in"}</span>
            <h4 id="checkinConfirmTitle">{confirmDialog.title}</h4>
            <p>{confirmDialog.message}</p>
            <div>
              <button type="button" className="ghost" onClick={() => setConfirmDialog(null)}>Hủy</button>
              <button type="button" className={confirmDialog.danger ? "danger" : "primary"} onClick={runConfirmAction}>
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="checkin-toast">{toast}</div> : null}
    </section>
  );
}

const STYLE = `
.checkin-admin-tool { display: grid; gap: 14px; }
.checkin-admin-head { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
.checkin-admin-head span { color: #0f766e; font-size: 11px; font-weight: 1000; letter-spacing: .12em; text-transform: uppercase; }
.checkin-admin-head h3 { margin: 6px 0 0; color: #07111f; font-size: 28px; line-height: 1; font-weight: 1000; letter-spacing: -.04em; }
.checkin-admin-head p { margin: 8px 0 0; color: #64748b; font-size: 13px; line-height: 1.45; font-weight: 850; }
.checkin-admin-head button,
.checkin-card button,
.checkin-row button { min-height: 42px; border: 0; border-radius: 14px; padding: 0 14px; background: #ffd400; color: #07111f; font-size: 12px; font-weight: 1000; cursor: pointer; }
.checkin-admin-head button:disabled,
.checkin-card button:disabled,
.checkin-row button:disabled { opacity: .58; cursor: not-allowed; }
.checkin-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.checkin-metrics div,
.checkin-card,
.checkin-table { border-radius: 20px; background: #fff; border: 1px solid #e2e8f0; box-shadow: 0 12px 30px rgba(15,23,42,.045); }
.checkin-metrics div { min-height: 96px; padding: 14px; }
.checkin-metrics span { color: #64748b; font-size: 10px; font-weight: 1000; letter-spacing: .08em; text-transform: uppercase; }
.checkin-metrics b { display: block; margin-top: 11px; color: #07111f; font-size: 28px; line-height: 1; font-weight: 1000; word-break: break-word; }
.checkin-admin-notice { padding: 14px; border-radius: 18px; border: 1px solid #fed7aa; background: linear-gradient(135deg, #fff7ed, #fff); color: #9a3412; display: grid; gap: 6px; }
.checkin-admin-notice b { color: #9a3412; font-size: 12px; font-weight: 1000; letter-spacing: .08em; text-transform: uppercase; }
.checkin-admin-notice span { color: #7c2d12; font-size: 13px; line-height: 1.45; font-weight: 900; }
.checkin-admin-notice small { color: #a16207; font-size: 12px; line-height: 1.45; font-weight: 850; }
.checkin-admin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.checkin-card { padding: 14px; display: grid; gap: 10px; align-content: start; }
.checkin-card h4 { margin: 0; color: #07111f; font-size: 17px; font-weight: 1000; }
.checkin-card p { margin: 0; color: #64748b; font-size: 13px; line-height: 1.45; font-weight: 850; }
.checkin-card input[type="file"] { min-height: 48px; padding: 12px; border-radius: 16px; border: 1px solid #dbe5ef; background: #f8fafc; color: #07111f; font-weight: 850; }
.checkin-replace { min-height: 42px; padding: 10px 12px; border-radius: 16px; display: flex; align-items: center; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; font-size: 12px; line-height: 1.35; font-weight: 900; }
.checkin-replace input { width: 18px; height: 18px; accent-color: #ffd400; }
.checkin-card button.dark { background: #07111f; color: #ffd400; }
.checkin-export-box { padding: 13px; border-radius: 16px; background: #ecfdf5; border: 1px solid #bbf7d0; display: grid; gap: 6px; }
.checkin-export-box span { color: #047857; font-size: 10px; font-weight: 1000; letter-spacing: .08em; text-transform: uppercase; }
.checkin-export-box b { color: #07111f; font-size: 18px; font-weight: 1000; }
.checkin-toolbar { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
.checkin-toolbar input { width: 100%; min-height: 48px; padding: 0 14px; border-radius: 16px; border: 1px solid #dbe5ef; background: #fff; color: #07111f; outline: none; font-size: 14px; font-weight: 850; }
.checkin-toolbar span { color: #64748b; font-size: 12px; font-weight: 900; white-space: nowrap; }
.checkin-table { overflow: hidden; }
.checkin-row { display: grid; grid-template-columns: 72px 1.3fr 1fr 1fr 1.2fr 150px; gap: 8px; align-items: center; padding: 11px 12px; border-top: 1px solid #e2e8f0; color: #334155; font-size: 13px; font-weight: 850; }
.checkin-row:first-child { border-top: 0; }
.checkin-row.head { background: #f8fafc; color: #64748b; font-size: 10px; font-weight: 1000; letter-spacing: .08em; text-transform: uppercase; }
.checkin-row.done { background: linear-gradient(135deg, rgba(236,253,245,.85), rgba(255,255,255,.95)); }
.checkin-row b { color: #07111f; font-weight: 1000; }
.checkin-row button { width: 100%; }
.checkin-row button.undo { background: #fee2e2; color: #991b1b; }
.checkin-empty { padding: 24px; color: #64748b; text-align: center; font-weight: 900; }
.checkin-confirm-layer { position: fixed; inset: 0; z-index: 99998; display: grid; place-items: center; padding: 18px; background: rgba(15,23,42,.56); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.checkin-confirm-card { width: min(100%, 420px); padding: 22px; border-radius: 24px; border: 1px solid #e2e8f0; background: #fff; box-shadow: 0 28px 84px rgba(15,23,42,.30); }
.checkin-confirm-card > span { display: inline-flex; width: fit-content; padding: 8px 11px; border-radius: 999px; background: #07111f; color: #ffd400; font-size: 10px; line-height: 1; font-weight: 1000; letter-spacing: .08em; text-transform: uppercase; }
.checkin-confirm-card h4 { margin: 16px 0 0; color: #07111f; font-size: 24px; line-height: 1.08; font-weight: 1000; letter-spacing: -.04em; }
.checkin-confirm-card p { margin: 10px 0 0; color: #475569; font-size: 14px; line-height: 1.45; font-weight: 850; }
.checkin-confirm-card div { margin-top: 18px; display: grid; grid-template-columns: .8fr 1fr; gap: 10px; }
.checkin-confirm-card button { min-height: 48px; border-radius: 16px; border: 0; font-size: 12px; font-weight: 1000; letter-spacing: .04em; text-transform: uppercase; cursor: pointer; }
.checkin-confirm-card button.ghost { border: 1px solid #dbe3ef; background: #fff; color: #07111f; }
.checkin-confirm-card button.primary { background: #ffd400; color: #07111f; }
.checkin-confirm-card button.danger { background: #dc2626; color: #fff; }
.checkin-toast { position: fixed; left: 50%; bottom: 18px; z-index: 99999; transform: translateX(-50%); width: min(calc(100% - 24px), 460px); padding: 13px 14px; border-radius: 18px; background: #07111f; color: #fff; font-size: 13px; font-weight: 900; text-align: center; box-shadow: 0 18px 44px rgba(15,23,42,.22); }
@media (max-width: 980px) {
  .checkin-admin-head,
  .checkin-metrics,
  .checkin-admin-grid,
  .checkin-toolbar { grid-template-columns: 1fr; display: grid; }
  .checkin-row { grid-template-columns: 54px 1fr; gap: 7px 10px; align-items: start; }
  .checkin-row.head { display: none; }
  .checkin-row span:nth-child(3)::before { content: "SDT: "; color: #64748b; font-weight: 1000; }
  .checkin-row span:nth-child(4)::before { content: "Mã SO: "; color: #64748b; font-weight: 1000; }
  .checkin-row span:nth-child(5)::before { content: "Thời gian: "; color: #64748b; font-weight: 1000; }
  .checkin-row span:nth-child(6) { grid-column: 1 / -1; }
}
`;
