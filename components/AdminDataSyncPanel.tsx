"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Summary = {
  staff: number;
  stores: number;
  productsNew: number;
  productsOldPhone: number;
  productsOldTablet: number;
  pmhCodes: number;
  pmhAvailable: number;
  pincodeRequests: number;
  pincodePending: number;
  quoteLogs: number;
  adminAudit: number;
};

const EMPTY_SUMMARY: Summary = {
  staff: 0,
  stores: 0,
  productsNew: 0,
  productsOldPhone: 0,
  productsOldTablet: 0,
  pmhCodes: 0,
  pmhAvailable: 0,
  pincodeRequests: 0,
  pincodePending: 0,
  quoteLogs: 0,
  adminAudit: 0,
};

const IMPORT_OPTIONS = [
  { key: "products_new", label: "Data_Moi", desc: "Thay bảng máy mới" },
  { key: "products_old_phone", label: "Data_Cu", desc: "Thay bảng máy cũ điện thoại" },
  { key: "products_old_tablet", label: "Data_Cu_Tablet", desc: "Thay bảng máy cũ tablet" },
  { key: "staff", label: "Data_Staff", desc: "Cập nhật nhân viên" },
  { key: "pmh_codes", label: "PMH", desc: "Nạp thêm mã PMH" },
  { key: "pincode_requests", label: "Data_PincodeAudit", desc: "Khôi phục hồ sơ" },
];

const EXPORT_OPTIONS = [
  { key: "products_new", label: "Data_Moi" },
  { key: "products_old_phone", label: "Data_Cu" },
  { key: "products_old_tablet", label: "Data_Cu_Tablet" },
  { key: "staff", label: "Data_Staff" },
  { key: "pmh_codes", label: "PMH" },
  { key: "pincode_requests", label: "Data_PincodeAudit" },
  { key: "system_settings", label: "System_Settings" },
  { key: "admin_audit", label: "Admin_Audit" },
  { key: "quote_logs", label: "Log_search" },
  { key: "backup", label: "Backup JSON" },
];

const FILE_NAMES: Record<string, string> = {
  products_new: "Data_Moi.csv",
  products_old_phone: "Data_Cu.csv",
  products_old_tablet: "Data_Cu_Tablet.csv",
  staff: "Data_Staff.csv",
  pmh_codes: "PMH.csv",
  pincode_requests: "Data_PincodeAudit.csv",
  system_settings: "System_Settings.csv",
  admin_audit: "Admin_Audit.csv",
  quote_logs: "Log_search.csv",
  backup: "vtdd-backup.json",
};

function number(value: number) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function getFileNameFromResponse(res: Response, target: string) {
  const header = res.headers.get("content-disposition") || "";
  const match = header.match(/filename="?([^"]+)"?/i);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  return FILE_NAMES[target] || "export.csv";
}

export default function AdminDataSyncPanel() {
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [summaryError, setSummaryError] = useState("");
  const [importTarget, setImportTarget] = useState("products_new");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedImport = useMemo(
    () => IMPORT_OPTIONS.find((item) => item.key === importTarget) || IMPORT_OPTIONS[0],
    [importTarget]
  );

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function loadSummary(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) setBusy("summary");
      setSummaryError("");

      const res = await fetch("/api/admin/tools/sync?target=summary", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) throw new Error(data?.message || "Không tải được trạng thái dữ liệu.");

      setSummary({ ...EMPTY_SUMMARY, ...(data.summary || {}) });
      setBusy("");
    } catch (err: any) {
      setBusy("");
      setSummaryError(err?.message || "Không tải được trạng thái dữ liệu.");
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  async function runImport() {
    try {
      if (!file) {
        showToast("Chưa chọn file CSV.");
        return;
      }

      setBusy("import");
      const form = new FormData();
      form.set("target", importTarget);
      form.set("file", file);

      const res = await fetch("/api/admin/tools/sync", {
        method: "POST",
        cache: "no-store",
        body: form,
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) throw new Error(data?.message || "Không import được dữ liệu.");

      setBusy("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      showToast(data.message || "Đã import dữ liệu.");
      await loadSummary({ silent: true });
    } catch (err: any) {
      setBusy("");
      showToast(err?.message || "Không import được dữ liệu.");
    }
  }

  async function runExport(target: string) {
    try {
      setBusy(`export:${target}`);
      const res = await fetch(`/api/admin/tools/sync?target=${encodeURIComponent(target)}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Không export được dữ liệu.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getFileNameFromResponse(res, target);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setBusy("");
    } catch (err: any) {
      setBusy("");
      showToast(err?.message || "Không export được dữ liệu.");
    }
  }

  return (
    <section className="admin-sync-panel">
      <style>{STYLE}</style>

      <div className="sync-head">
        <div>
          <span>Đồng bộ dữ liệu</span>
          <h3>Import / Export CSV</h3>
        </div>
        <button type="button" onClick={() => loadSummary()} disabled={busy === "summary"}>
          {busy === "summary" ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      {summaryError ? <div className="sync-error">{summaryError}</div> : null}

      <div className="sync-metrics">
        <div><span>Data_Moi</span><b>{number(summary.productsNew)}</b></div>
        <div><span>Data_Cu</span><b>{number(summary.productsOldPhone)}</b></div>
        <div><span>Data_Cu_Tablet</span><b>{number(summary.productsOldTablet)}</b></div>
        <div><span>Data_Staff</span><b>{number(summary.staff)}</b></div>
        <div><span>Stores</span><b>{number(summary.stores)}</b></div>
        <div><span>PMH còn</span><b>{number(summary.pmhAvailable)}</b></div>
        <div><span>Hồ sơ PMH</span><b>{number(summary.pincodeRequests)}</b></div>
        <div><span>Log tra giá</span><b>{number(summary.quoteLogs)}</b></div>
      </div>

      <div className="sync-grid">
        <section className="sync-box">
          <div className="sync-box-title">
            <h4>Import từ CSV</h4>
            <small>{selectedImport.desc}</small>
          </div>

          <label>
            <span>Loại dữ liệu</span>
            <select value={importTarget} onChange={(event) => setImportTarget(event.target.value)}>
              {IMPORT_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>File CSV</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,.txt"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>

          <button type="button" onClick={runImport} disabled={busy === "import"}>
            {busy === "import" ? "Đang import..." : `Import ${selectedImport.label}`}
          </button>
        </section>

        <section className="sync-box">
          <div className="sync-box-title">
            <h4>Export dữ liệu</h4>
            <small>CSV mở được bằng Google Sheet</small>
          </div>

          <div className="sync-export-grid">
            {EXPORT_OPTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => runExport(item.key)}
                disabled={busy === `export:${item.key}`}
              >
                {busy === `export:${item.key}` ? "Đang xuất..." : item.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      {toast ? <div className="sync-toast">{toast}</div> : null}
    </section>
  );
}

const STYLE = `
.admin-sync-panel {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 22px;
  background: #fff;
  border: 1px solid #dbe5ef;
  box-shadow: 0 14px 34px rgba(15,23,42,.055);
}
.sync-head {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 12px;
}
.sync-head span {
  color: #047857;
  font-size: 11px;
  font-weight: 1000;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.sync-head h3 {
  margin: 7px 0 0;
  color: #07111f;
  font-size: 26px;
  line-height: 1;
  font-weight: 1000;
}
.sync-head button,
.sync-box button {
  min-height: 40px;
  border: 0;
  border-radius: 14px;
  padding: 0 13px;
  background: #ffd400;
  color: #07111f;
  font-size: 12px;
  font-weight: 1000;
  cursor: pointer;
}
.sync-head button:disabled,
.sync-box button:disabled {
  opacity: .55;
  cursor: not-allowed;
}
.sync-error {
  padding: 12px;
  border-radius: 16px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #991b1b;
  font-size: 12px;
  font-weight: 900;
}
.sync-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.sync-metrics div {
  min-height: 74px;
  padding: 12px;
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.sync-metrics span {
  color: #64748b;
  font-size: 10px;
  font-weight: 1000;
  text-transform: uppercase;
}
.sync-metrics b {
  display: block;
  margin-top: 9px;
  color: #07111f;
  font-size: 24px;
  line-height: 1;
  font-weight: 1000;
}
.sync-grid {
  display: grid;
  grid-template-columns: minmax(260px, .8fr) minmax(0, 1.2fr);
  gap: 10px;
}
.sync-box {
  padding: 14px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.sync-box-title {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: start;
  margin-bottom: 12px;
}
.sync-box-title h4 {
  margin: 0;
  color: #07111f;
  font-size: 17px;
  font-weight: 1000;
}
.sync-box-title small {
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
  text-align: right;
}
.sync-box label {
  display: grid;
  gap: 6px;
  margin-bottom: 10px;
}
.sync-box label span {
  color: #64748b;
  font-size: 10px;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.sync-box select,
.sync-box input {
  width: 100%;
  min-height: 42px;
  border-radius: 14px;
  border: 1px solid #dbe5ef;
  background: #fff;
  color: #07111f;
  padding: 0 11px;
  font-size: 13px;
  font-weight: 900;
}
.sync-box input[type="file"] {
  padding: 10px;
  height: auto;
}
.sync-box > button {
  width: 100%;
}
.sync-export-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.sync-export-grid button {
  width: 100%;
  min-height: 44px;
  background: #07111f;
  color: #ffd400;
}
.sync-export-grid button:last-child {
  grid-column: 1 / -1;
  background: #0f766e;
  color: #fff;
}
.sync-toast {
  position: fixed;
  left: 50%;
  bottom: 18px;
  z-index: 99999;
  transform: translateX(-50%);
  width: min(calc(100% - 24px), 460px);
  padding: 13px 14px;
  border-radius: 18px;
  background: #07111f;
  color: #fff;
  font-size: 13px;
  font-weight: 900;
  text-align: center;
  box-shadow: 0 18px 44px rgba(15,23,42,.22);
}
@media (max-width: 900px) {
  .admin-sync-panel {
    padding: 12px;
    border-radius: 18px;
  }
  .sync-head,
  .sync-box-title {
    display: grid;
  }
  .sync-head h3 {
    font-size: 23px;
  }
  .sync-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .sync-grid,
  .sync-export-grid {
    grid-template-columns: 1fr;
  }
  .sync-box-title small {
    text-align: left;
  }
}
`;
