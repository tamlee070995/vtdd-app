"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CheckinCustomer = {
  id: string;
  stt: number | null;
  sdt: string;
  tenKH: string;
  maSO: string;
  checkedIn: boolean;
  checkinTime: string;
};

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmText: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
} | null;

function number(value: number) {
  return Number(value || 0).toLocaleString("vi-VN");
}

export default function CheckinToolApp() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<CheckinCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);

  const checkedCount = useMemo(() => customers.filter((item) => item.checkedIn).length, [customers]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function searchCustomers(value: string) {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (value.trim()) params.set("q", value.trim());
      const res = await fetch(`/api/tools/checkin?${params.toString()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Không tìm được dữ liệu Check-in.");

      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      setNotice(String(data.message || ""));
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      const message = err?.message || "Không tìm được dữ liệu Check-in.";
      setCustomers([]);
      setNotice(message);
      showToast(message);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      searchCustomers(query);
    }, 180);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function postToggle(row: CheckinCustomer, checkedIn: boolean) {
    setBusy(`toggle-${row.id}`);
    const res = await fetch("/api/tools/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      cache: "no-store",
      body: JSON.stringify({ id: row.id, checkedIn }),
    });
    const data = await res.json().catch(() => null);
    setBusy("");

    if (!res.ok || !data?.success) throw new Error(data?.message || "Không cập nhật được check-in.");
    showToast(data.message || "Đã cập nhật check-in.");
    await searchCustomers(query);
  }

  function askToggle(row: CheckinCustomer, checkedIn: boolean) {
    setConfirmDialog({
      title: checkedIn ? "Xác nhận check-in" : "Bỏ check-in",
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
      showToast(err?.message || "Không xử lý được check-in.");
    }
  }

  return (
    <main className="checkin-page">
      <style>{STYLE}</style>

      <header className="checkin-topbar">
        <Link className="checkin-brand" href="/cong-cu-ho-tro" aria-label="Về cổng hỗ trợ">
          <span className="checkin-logo"><img src="/mwg-logo.svg" alt="MWG" /></span>
          <span>
            <strong>Viễn Thông Di Động</strong>
            <small>Event Check-in</small>
          </span>
        </Link>
        <div className="checkin-actions">
          <Link className="checkin-home" href="/cong-cu-ho-tro">Danh mục</Link>
          <form action="/api/auth/staff-logout" method="POST">
            <input type="hidden" name="next" value="/cong-cu-ho-tro" />
            <button className="checkin-logout" type="submit">Đăng xuất</button>
          </form>
        </div>
      </header>

      <section className="checkin-hero">
        <span>EVENT ACCESS</span>
        <h1>Check-in khách hàng</h1>
        <p>Tìm nhanh theo số điện thoại, tên khách hàng hoặc mã SO. STT được xếp tự động theo thời gian khách đến.</p>
      </section>

      <section className="checkin-search-card">
        <div className="checkin-search-head">
          <div>
            <span>Quick Search</span>
            <h2>Tìm khách tham gia event</h2>
          </div>
          <b>{loading ? "Đang tìm..." : `${number(customers.length)} kết quả`}</b>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nhập SDT, tên khách hoặc mã SO..."
          inputMode="search"
          autoFocus
        />

        <div className="checkin-mini-stats">
          <span>Đã check-in trong kết quả: <b>{number(checkedCount)}</b></span>
          <span>Gợi ý: nhập từng ký tự để lọc nhanh.</span>
        </div>
      </section>

      {notice ? (
        <section className="checkin-notice" role="status">
          <b>Chưa sẵn sàng dữ liệu</b>
          <span>{notice}</span>
        </section>
      ) : null}

      <section className="checkin-results">
        {customers.length === 0 ? (
          <div className="checkin-empty">
            <b>{notice ? "Chưa có danh sách khách" : query.trim() ? "Không tìm thấy khách hàng" : "Nhập thông tin để tìm khách"}</b>
            <span>{notice || (query.trim() ? "Kiểm tra lại SDT, tên khách hoặc mã SO." : "Dữ liệu sẽ hiển thị ngay khi bạn nhập.")}</span>
          </div>
        ) : (
          customers.map((row) => (
            <article className={`checkin-customer ${row.checkedIn ? "done" : ""}`} key={row.id}>
              <div className="checkin-stt">{row.stt || "—"}</div>
              <div className="checkin-customer-info">
                <div>
                  <span>{row.checkedIn ? "Đã check-in" : "Chưa check-in"}</span>
                  <h3>{row.tenKH || "Chưa có tên khách"}</h3>
                </div>
                <p>
                  <b>SDT:</b> {row.sdt || "—"} <i /> <b>Mã SO:</b> {row.maSO || "—"}
                </p>
                {row.checkinTime ? <small>Thời gian: {row.checkinTime}</small> : null}
              </div>
              <button
                type="button"
                className={row.checkedIn ? "undo" : ""}
                onClick={() => askToggle(row, !row.checkedIn)}
                disabled={busy === `toggle-${row.id}`}
              >
                {row.checkedIn ? "Bỏ check-in" : "Check-in"}
              </button>
            </article>
          ))
        )}
      </section>

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
    </main>
  );
}

const STYLE = `
.checkin-page {
  min-height: 100dvh;
  padding: 22px;
  background:
    radial-gradient(circle at 8% 0%, rgba(255, 212, 0, .22), transparent 30%),
    radial-gradient(circle at 94% 12%, rgba(16, 185, 129, .14), transparent 32%),
    #eef3f8;
  color: #07111f;
  font-family: Roboto, Arial, sans-serif;
}
.checkin-topbar {
  width: min(100%, 1120px);
  min-height: 76px;
  margin: 0 auto;
  padding: 10px 18px;
  border-radius: 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  background: #07111f;
  box-shadow: 0 24px 76px rgba(15,23,42,.16);
}
.checkin-brand { min-width: 0; display: inline-flex; align-items: center; gap: 13px; color: #fff; text-decoration: none; }
.checkin-logo { width: 54px; height: 54px; border-radius: 17px; display: grid; place-items: center; overflow: hidden; background: #ffd400; }
.checkin-logo img { width: 100%; height: 100%; object-fit: contain; }
.checkin-brand strong { display: block; color: #fff; font-size: 24px; line-height: 1; font-weight: 1000; }
.checkin-brand small { display: block; margin-top: 4px; color: rgba(255,255,255,.72); font-size: 11px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
.checkin-actions {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 9px;
}
.checkin-actions form { margin: 0; }
.checkin-home,
.checkin-logout {
  min-height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 1000;
  font-family: inherit;
  text-transform: uppercase;
}
.checkin-home {
  background: #ffd400;
  color: #07111f;
  text-decoration: none;
}
.checkin-logout {
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.08);
  color: #fff;
  cursor: pointer;
}
.checkin-hero,
.checkin-search-card,
.checkin-results { width: min(100%, 1120px); margin: 16px auto 0; }
.checkin-hero {
  padding: clamp(24px, 4vw, 46px);
  border-radius: 30px;
  background: radial-gradient(circle at 90% 10%, rgba(255,212,0,.45), transparent 32%), linear-gradient(135deg, #07111f, #020617);
  color: #fff;
  box-shadow: 0 24px 76px rgba(15,23,42,.14);
}
.checkin-hero > span {
  width: fit-content;
  padding: 8px 12px;
  border-radius: 999px;
  display: inline-flex;
  background: rgba(255,255,255,.1);
  color: #ffd400;
  font-size: 11px;
  font-weight: 1000;
  letter-spacing: .14em;
}
.checkin-hero h1 { max-width: 760px; margin: 16px 0 0; color: #fff; font-size: clamp(42px, 6vw, 74px); line-height: .92; font-weight: 1000; letter-spacing: -.07em; }
.checkin-hero p { max-width: 680px; margin: 16px 0 0; color: rgba(255,255,255,.76); font-size: 15px; line-height: 1.55; font-weight: 850; }
.checkin-search-card {
  padding: 18px;
  border-radius: 26px;
  display: grid;
  gap: 14px;
  background: #fff;
  border: 1px solid #dbe5ef;
  box-shadow: 0 20px 54px rgba(15,23,42,.08);
}
.checkin-search-head { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
.checkin-search-head span { color: #0f766e; font-size: 11px; font-weight: 1000; letter-spacing: .12em; text-transform: uppercase; }
.checkin-search-head h2 { margin: 6px 0 0; color: #07111f; font-size: 26px; line-height: 1; font-weight: 1000; }
.checkin-search-head b { min-height: 34px; padding: 0 12px; border-radius: 999px; display: inline-flex; align-items: center; background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 1000; white-space: nowrap; }
.checkin-search-card input {
  width: 100%;
  min-height: 58px;
  padding: 0 16px;
  border-radius: 18px;
  border: 1px solid #dbe5ef;
  background: #f8fafc;
  color: #07111f;
  outline: none;
  font-size: 16px;
  font-weight: 900;
}
.checkin-mini-stats { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; color: #64748b; font-size: 12px; font-weight: 900; }
.checkin-mini-stats b { color: #07111f; }
.checkin-notice {
  width: min(100%, 1120px);
  margin: 16px auto 0;
  padding: 16px;
  border-radius: 22px;
  border: 1px solid #fed7aa;
  background: linear-gradient(135deg, #fff7ed, #ffffff);
  color: #9a3412;
  box-shadow: 0 16px 42px rgba(154,52,18,.08);
}
.checkin-notice b { display: block; color: #9a3412; font-size: 12px; font-weight: 1000; text-transform: uppercase; letter-spacing: .08em; }
.checkin-notice span { display: block; margin-top: 6px; color: #7c2d12; font-size: 14px; line-height: 1.45; font-weight: 850; }
.checkin-results { display: grid; gap: 10px; }
.checkin-customer,
.checkin-empty {
  border-radius: 24px;
  background: #fff;
  border: 1px solid #dbe5ef;
  box-shadow: 0 14px 36px rgba(15,23,42,.055);
}
.checkin-customer {
  padding: 14px;
  display: grid;
  grid-template-columns: auto 1fr 150px;
  gap: 13px;
  align-items: center;
}
.checkin-customer.done {
  border-color: #bbf7d0;
  background: linear-gradient(135deg, #fff, #ecfdf5);
}
.checkin-stt {
  width: 52px;
  height: 52px;
  border-radius: 17px;
  display: grid;
  place-items: center;
  background: #07111f;
  color: #ffd400;
  font-size: 15px;
  font-weight: 1000;
}
.checkin-customer-info { min-width: 0; display: grid; gap: 6px; }
.checkin-customer-info > div { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.checkin-customer-info span {
  padding: 6px 9px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
  font-size: 10px;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.checkin-customer.done .checkin-customer-info span { background: #dcfce7; color: #15803d; }
.checkin-customer-info h3 { margin: 0; color: #07111f; font-size: 22px; line-height: 1; font-weight: 1000; }
.checkin-customer-info p { margin: 0; color: #475569; font-size: 13px; line-height: 1.45; font-weight: 850; }
.checkin-customer-info i { display: inline-block; width: 6px; }
.checkin-customer-info small { color: #64748b; font-size: 12px; font-weight: 900; }
.checkin-customer button {
  width: 100%;
  min-height: 48px;
  border: 0;
  border-radius: 16px;
  background: #ffd400;
  color: #07111f;
  font-size: 12px;
  font-weight: 1000;
  cursor: pointer;
}
.checkin-customer button.undo { background: #fee2e2; color: #991b1b; }
.checkin-customer button:disabled { opacity: .58; cursor: not-allowed; }
.checkin-empty { min-height: 180px; display: grid; place-items: center; text-align: center; padding: 24px; }
.checkin-empty b { color: #07111f; font-size: 22px; font-weight: 1000; }
.checkin-empty span { display: block; margin-top: 8px; color: #64748b; font-size: 13px; font-weight: 850; }
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
@media (max-width: 720px) {
  .checkin-page { padding: 10px; }
  .checkin-topbar { min-height: 62px; border-radius: 22px; padding: 10px; }
  .checkin-logo { width: 42px; height: 42px; border-radius: 14px; }
  .checkin-brand strong { font-size: 18px; }
  .checkin-brand small { font-size: 10px; }
  .checkin-actions { gap: 6px; }
  .checkin-home,
  .checkin-logout { min-height: 38px; padding: 0 10px; font-size: 10px; }
  .checkin-hero { border-radius: 26px; padding: 22px; }
  .checkin-hero h1 { font-size: 42px; letter-spacing: -.04em; }
  .checkin-search-head { display: grid; }
  .checkin-customer { grid-template-columns: auto 1fr; }
  .checkin-customer button { grid-column: 1 / -1; }
}
`;
