"use client";

import { useEffect, useMemo, useState } from "react";

type PmhStat = {
  menhGia: string;
  count: number;
};

type PincodeRequest = {
  requestId: string;
  createdAt: string;
  flow: "ChienGia" | "NgoaiDS";
  flowLabel: string;
  maST: string;
  maNV: string;
  staffName: string;
  storeName: string;
  imei: string;
  modelCu: string;
  modelMoi: string;
  note: string;
  status: string;
  pinCode: string;
  menhGia: string;
  reason: string;
  admin: string;
  updatedAt: string;
  completedAt: string;
  imageUrls: string[];
};

type PincodeDashboard = {
  requests: PincodeRequest[];
  stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    availablePins: number;
  };
  pmh: {
    all: PmhStat[];
    chienGia: PmhStat[];
    ngoaiDs: PmhStat[];
  };
};

const EMPTY_DASHBOARD: PincodeDashboard = {
  requests: [],
  stats: { total: 0, pending: 0, approved: 0, rejected: 0, availablePins: 0 },
  pmh: { all: [], chienGia: [], ngoaiDs: [] },
};

function number(value: number) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function parsePincodeImport(raw: string) {
  return String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t|,|;/).map((item) => item.trim()))
    .filter((parts) => {
      const first = String(parts[0] || "").toLowerCase();
      return first && first !== "pincode" && first !== "pin";
    })
    .map((parts) => ({ pin: parts[0], menhGia: parts.slice(1).join(" ").trim() }));
}

function statusText(status: string) {
  if (status === "Approved") return "Đã cấp PMH";
  if (status === "Rejected_Soft") return "Cần cập nhật";
  if (status === "Rejected_Hard") return "Từ chối";
  if (status === "Completed") return "Đã hoàn tất";
  return "Chờ duyệt";
}

export default function PincodeAdminTool() {
  const [dashboard, setDashboard] = useState<PincodeDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [importText, setImportText] = useState("");
  const [filter, setFilter] = useState<"ALL" | "Pending" | "Approved" | "Rejected">("Pending");
  const [toast, setToast] = useState("");

  const visibleRequests = useMemo(() => {
    return dashboard.requests.filter((item) => {
      if (filter === "ALL") return true;
      if (filter === "Rejected") return item.status === "Rejected_Hard" || item.status === "Rejected_Soft";
      if (filter === "Approved") return item.status === "Approved" || item.status === "Completed";
      return item.status === filter;
    });
  }, [dashboard.requests, filter]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function loadDashboard(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) setLoading(true);

      const res = await fetch("/api/admin/tools/pincode", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) throw new Error(data?.message || "Không tải được PMH.");

      setDashboard(data.dashboard || EMPTY_DASHBOARD);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      showToast(err?.message || "Không tải được PMH.");
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onReviewDone(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "PINCODE_REVIEW_DONE") return;
      loadDashboard({ silent: true });
    }

    window.addEventListener("message", onReviewDone);
    return () => window.removeEventListener("message", onReviewDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function postAction(body: any) {
    const res = await fetch("/api/admin/tools/pincode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) throw new Error(data?.message || "Không xử lý được thao tác.");
    return data;
  }

  async function importPins() {
    try {
      const items = parsePincodeImport(importText);

      if (items.length === 0) {
        showToast("Chưa có Pincode để nạp.");
        return;
      }

      setBusy("import");
      const data = await postAction({ action: "IMPORT_PINCODES", items });
      setBusy("");

      setImportText("");
      showToast(`Đã nạp ${number(data.imported || 0)} mã PMH.`);
      await loadDashboard({ silent: true });
    } catch (err: any) {
      setBusy("");
      showToast(err?.message || "Không nạp được PMH.");
    }
  }

  function openReview(item: PincodeRequest) {
    const url = `/admin/tools/pincode/${encodeURIComponent(item.requestId)}`;
    const popup = window.open(url, `pmh-review-${item.requestId}`, "popup=yes,width=1180,height=840");

    if (popup) {
      popup.focus();
      return;
    }

    window.open(url, "_blank");
  }

  return (
    <section className="pmh-admin-tool">
      <style>{STYLE}</style>

      <div className="pmh-head">
        <div>
          <span>Công cụ PMH</span>
          <h3>Quản trị Pincode & thẩm định hồ sơ</h3>
          <p>Dữ liệu dùng sheet mới: Data_Staff, PMH và Data_PincodeAudit.</p>
        </div>
        <button type="button" onClick={() => loadDashboard()} disabled={loading}>
          {loading ? "Đang tải..." : "Tải lại"}
        </button>
      </div>

      <div className="pmh-metrics">
        <div><span>Chờ duyệt</span><b>{number(dashboard.stats.pending)}</b></div>
        <div><span>Đã cấp</span><b>{number(dashboard.stats.approved)}</b></div>
        <div><span>Bị từ chối</span><b>{number(dashboard.stats.rejected)}</b></div>
        <div><span>PMH còn</span><b>{number(dashboard.stats.availablePins)}</b></div>
      </div>

      <div className="pmh-grid">
        <section className="pmh-card">
          <h4>Kho PMH</h4>
          <div className="pmh-stock-columns">
            <div>
              <b>Chiến giá · All</b>
              {(dashboard.pmh.chienGia.length ? dashboard.pmh.chienGia : [{ menhGia: "Chưa có mã", count: 0 }]).map((item) => (
                <p key={`cg-${item.menhGia}`}><span>{item.menhGia}</span><em>{number(item.count)}</em></p>
              ))}
            </div>
            <div>
              <b>Ngoài DS · TCDM</b>
              {(dashboard.pmh.ngoaiDs.length ? dashboard.pmh.ngoaiDs : [{ menhGia: "Chưa có mã", count: 0 }]).map((item) => (
                <p key={`nds-${item.menhGia}`}><span>{item.menhGia}</span><em>{number(item.count)}</em></p>
              ))}
            </div>
          </div>
        </section>

        <section className="pmh-card">
          <h4>Nạp Pincode</h4>
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={"Pincode,Mệnh giá\nPIN_CHIENGIA_001,300K All\nPIN_TCDM_001,300K TCDM"}
          />
          <button type="button" onClick={importPins} disabled={busy === "import"}>
            {busy === "import" ? "Đang nạp..." : "Nạp PMH"}
          </button>
        </section>
      </div>

      <div className="pmh-list-head">
        <h4>Hồ sơ thẩm định</h4>
        <select value={filter} onChange={(event) => setFilter(event.target.value as any)}>
          <option value="Pending">Chờ duyệt</option>
          <option value="Approved">Đã cấp PMH</option>
          <option value="Rejected">Từ chối / cập nhật</option>
          <option value="ALL">Tất cả</option>
        </select>
      </div>

      <div className="pmh-request-list">
        {visibleRequests.length === 0 ? (
          <div className="pmh-empty">Chưa có hồ sơ phù hợp.</div>
        ) : (
          visibleRequests.map((item) => (
            <article className="pmh-request-card" key={item.requestId}>
              <div className="pmh-request-main">
                <div className="pmh-request-top">
                  <span className={`pmh-flow ${item.flow === "ChienGia" ? "gold" : ""}`}>{item.flowLabel}</span>
                  <span className={`pmh-status ${item.status}`}>{statusText(item.status)}</span>
                </div>
                <h5>{item.imei || "Chưa có IMEI/SN"}</h5>
                <p>NV {item.maNV} · {item.staffName || "Chưa rõ tên"} · ST {item.maST || "—"} · {item.createdAt}</p>
              </div>

              <div className="pmh-actions">
                <button type="button" className="approve review" onClick={() => openReview(item)}>
                  Kiểm duyệt yêu cầu
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {toast ? <div className="pmh-toast">{toast}</div> : null}
    </section>
  );
}

const STYLE = `
.pmh-admin-tool { display: grid; gap: 14px; }
.pmh-head { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
.pmh-head span { color: #b45309; font-size: 11px; font-weight: 1000; letter-spacing: .12em; text-transform: uppercase; }
.pmh-head h3 { margin: 6px 0 0; color: #07111f; font-size: 28px; line-height: 1; font-weight: 1000; letter-spacing: -.05em; }
.pmh-head p { margin: 8px 0 0; color: #64748b; font-size: 13px; line-height: 1.4; font-weight: 850; }
.pmh-head button,
.pmh-card button,
.pmh-actions button { min-height: 42px; border: 0; border-radius: 14px; padding: 0 14px; background: #ffd400; color: #07111f; font-size: 12px; font-weight: 1000; cursor: pointer; }
.pmh-head button:disabled,
.pmh-card button:disabled,
.pmh-actions button:disabled { opacity: .55; cursor: not-allowed; }
.pmh-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.pmh-metrics div,
.pmh-card,
.pmh-request-card { border-radius: 20px; background: #fff; border: 1px solid #e2e8f0; box-shadow: 0 12px 30px rgba(15,23,42,.045); }
.pmh-metrics div { min-height: 96px; padding: 14px; }
.pmh-metrics span { color: #64748b; font-size: 10px; font-weight: 1000; letter-spacing: .08em; text-transform: uppercase; }
.pmh-metrics b { display: block; margin-top: 11px; color: #07111f; font-size: 30px; line-height: 1; font-weight: 1000; }
.pmh-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pmh-card { padding: 14px; }
.pmh-card h4,
.pmh-list-head h4 { margin: 0 0 12px; color: #07111f; font-size: 16px; font-weight: 1000; }
.pmh-stock-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pmh-stock-columns > div { padding: 12px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; }
.pmh-stock-columns b { display: block; margin-bottom: 9px; color: #07111f; font-size: 12px; font-weight: 1000; }
.pmh-stock-columns p { margin: 0 0 7px; display: flex; justify-content: space-between; gap: 8px; color: #475569; font-size: 12px; font-weight: 850; }
.pmh-stock-columns em { color: #047857; font-style: normal; font-weight: 1000; }
.pmh-card textarea { width: 100%; min-height: 120px; padding: 12px; border-radius: 16px; border: 1px solid #e2e8f0; resize: vertical; font-size: 13px; font-weight: 800; outline: none; }
.pmh-card button { margin-top: 10px; width: 100%; }
.pmh-list-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
.pmh-list-head select { min-height: 40px; border-radius: 13px; border: 1px solid #e2e8f0; padding: 0 12px; background: #fff; color: #07111f; font-weight: 900; }
.pmh-request-list { display: grid; gap: 10px; }
.pmh-request-card { padding: 14px; display: grid; grid-template-columns: 1fr 190px; gap: 12px; }
.pmh-request-top { display: flex; flex-wrap: wrap; gap: 7px; }
.pmh-flow,
.pmh-status { width: fit-content; padding: 6px 9px; border-radius: 999px; font-size: 9.5px; line-height: 1; font-weight: 1000; letter-spacing: .08em; text-transform: uppercase; }
.pmh-flow { background: #ecfdf5; color: #047857; }
.pmh-flow.gold { background: #fff7ed; color: #c2410c; }
.pmh-status { background: #eff6ff; color: #1d4ed8; }
.pmh-status.Approved { background: #dcfce7; color: #15803d; }
.pmh-status.Rejected_Hard,
.pmh-status.Rejected_Soft { background: #fee2e2; color: #b91c1c; }
.pmh-request-card h5 { margin: 10px 0 0; color: #07111f; font-size: 20px; font-weight: 1000; }
.pmh-request-card p { margin: 7px 0 0; color: #64748b; font-size: 12px; line-height: 1.4; font-weight: 850; }
.pmh-info-grid { margin-top: 10px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.pmh-info-grid div { padding: 10px; border-radius: 14px; background: #f8fafc; border: 1px solid #e2e8f0; }
.pmh-info-grid span { display: block; color: #64748b; font-size: 9.5px; font-weight: 1000; text-transform: uppercase; }
.pmh-info-grid b { display: block; margin-top: 6px; color: #07111f; font-size: 12px; line-height: 1.25; font-weight: 1000; }
.pmh-note { padding: 10px; border-radius: 14px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412 !important; }
.pmh-images { margin-top: 10px; display: flex; gap: 8px; overflow-x: auto; }
.pmh-images img { width: 86px; height: 110px; border-radius: 12px; object-fit: cover; border: 1px solid #e2e8f0; }
.pmh-images em { color: #94a3b8; font-size: 12px; font-style: normal; font-weight: 900; }
.pmh-actions { display: grid; gap: 8px; align-content: center; }
.pmh-actions button { width: 100%; background: #f8fafc; border: 1px solid #e2e8f0; }
.pmh-actions button.approve { background: #07111f; border-color: #07111f; color: #ffd400; }
.pmh-actions button.review { min-height: 54px; }
.pmh-actions button.reject { background: #fee2e2; border-color: #fecaca; color: #991b1b; }
.pmh-final { padding: 12px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; display: grid; gap: 6px; }
.pmh-final span { color: #07111f; font-size: 13px; font-weight: 1000; word-break: break-word; }
.pmh-final small { color: #64748b; font-size: 11px; font-weight: 850; }
.pmh-empty { padding: 24px; border-radius: 20px; background: #fff; border: 1px solid #e2e8f0; color: #64748b; text-align: center; font-weight: 900; }
.pmh-toast { position: fixed; left: 50%; bottom: 18px; z-index: 99999; transform: translateX(-50%); width: min(calc(100% - 24px), 460px); padding: 13px 14px; border-radius: 18px; background: #07111f; color: #fff; font-size: 13px; font-weight: 900; box-shadow: 0 18px 44px rgba(15,23,42,.22); }
@media (max-width: 900px) {
  .pmh-metrics,
  .pmh-grid,
  .pmh-request-card,
  .pmh-info-grid { grid-template-columns: 1fr; }
  .pmh-head { display: grid; }
  .pmh-stock-columns { grid-template-columns: 1fr; }
}
`;
