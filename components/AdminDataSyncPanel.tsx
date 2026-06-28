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

type ImportPreview = {
  target: string;
  label: string;
  mode: "replace" | "upsert" | "append";
  currentRows: number;
  validRows: number;
  uniqueRows: number;
  willInsert: number;
  willUpdate: number;
  willReplace: number;
  willSkip: number;
  warnings: string[];
  samples: Record<string, string>[];
};

type DataQualityIssue = {
  label: string;
  value: number;
  severity: "ok" | "warn" | "danger";
  samples?: string[];
};

type DataQualitySection = {
  key: string;
  title: string;
  total: number;
  issues: DataQualityIssue[];
};

type DataQualityReport = {
  generatedAt: string;
  sections: DataQualitySection[];
};

type BackupStatus = {
  enabled: boolean;
  schedule: string;
  fileName: string;
  dailyFileName?: string;
  exists: boolean;
  bytes: number;
  updatedAtVN: string;
  nextRunAtVN: string;
  lastError: string;
  history?: Array<{
    fileName?: string;
    dailyFileName?: string;
    createdAt?: string;
    createdAtVN?: string;
    bytes?: number;
    trigger?: string;
  }>;
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

function formatBytes(value: number) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
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
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [quality, setQuality] = useState<DataQualityReport | null>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupImportFile, setBackupImportFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

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
    loadBackupStatus();
  }, []);

  async function loadBackupStatus() {
    try {
      const res = await fetch("/api/admin/tools/sync?target=backup-status", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        setBackupStatus(data.backup || null);
      }
    } catch {
      setBackupStatus(null);
    }
  }

  async function loadQuality() {
    try {
      setBusy("quality");
      const res = await fetch("/api/admin/tools/sync?target=quality", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) throw new Error(data?.message || "Khong kiem tra duoc chat luong du lieu.");

      setQuality(data.quality || null);
      setBusy("");
      showToast("Da kiem tra chat luong du lieu.");
    } catch (err: any) {
      setBusy("");
      showToast(err?.message || "Khong kiem tra duoc chat luong du lieu.");
    }
  }

  async function runPreviewImport() {
    try {
      if (!file) {
        showToast("Chua chon file CSV.");
        return;
      }

      setBusy("preview");
      setPreview(null);
      const form = new FormData();
      form.set("target", importTarget);
      form.set("file", file);
      form.set("preview", "1");

      const res = await fetch("/api/admin/tools/sync", {
        method: "POST",
        cache: "no-store",
        body: form,
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) throw new Error(data?.message || "Khong xem truoc duoc file import.");

      setPreview(data.preview || null);
      setBusy("");
      showToast("Da tao ban xem truoc import.");
    } catch (err: any) {
      setBusy("");
      showToast(err?.message || "Khong xem truoc duoc file import.");
    }
  }

  async function runImport() {
    try {
      if (!file) {
        showToast("Chưa chọn file CSV.");
        return;
      }

      if (!preview || preview.target !== importTarget) {
        await runPreviewImport();
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
      setPreview(null);
      setQuality(null);
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
      if (target === "backup") await loadBackupStatus();
    } catch (err: any) {
      setBusy("");
      showToast(err?.message || "Không export được dữ liệu.");
    }
  }

  async function downloadBackupFile(fileName?: string) {
    const safeName = String(fileName || backupStatus?.fileName || "vtdd-backup.json").trim() || "vtdd-backup.json";

    try {
      setBusy(`backup-download:${safeName}`);
      const params = new URLSearchParams({
        target: "backup-file",
        file: safeName,
      });
      const res = await fetch(`/api/admin/tools/sync?${params.toString()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Không tải được file backup.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getFileNameFromResponse(res, "backup");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setBusy("");
    } catch (err: any) {
      setBusy("");
      showToast(err?.message || "Không tải được file backup.");
    }
  }

  async function runBackupRestore() {
    try {
      if (!backupImportFile) {
        showToast("Chưa chọn file backup JSON.");
        return;
      }

      setBusy("backup-restore");
      const form = new FormData();
      form.set("target", "backup_restore");
      form.set("file", backupImportFile);

      const res = await fetch("/api/admin/tools/sync", {
        method: "POST",
        cache: "no-store",
        body: form,
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) throw new Error(data?.message || "Không khôi phục được backup.");

      setBusy("");
      setBackupImportFile(null);
      if (backupFileInputRef.current) backupFileInputRef.current.value = "";
      showToast(data.message || "Đã khôi phục dữ liệu từ backup.");
      await loadSummary({ silent: true });
      await loadBackupStatus();
    } catch (err: any) {
      setBusy("");
      showToast(err?.message || "Không khôi phục được backup.");
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
        <div className="sync-head-actions">
          <button type="button" onClick={() => loadQuality()} disabled={busy === "quality"}>
            {busy === "quality" ? "Đang kiểm tra..." : "Kiểm tra dữ liệu"}
          </button>
        <button type="button" onClick={() => loadSummary()} disabled={busy === "summary"}>
          {busy === "summary" ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

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
            <select
              value={importTarget}
              onChange={(event) => {
                setImportTarget(event.target.value);
                setPreview(null);
              }}
            >
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
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setPreview(null);
              }}
            />
          </label>

          {preview ? (
            <div className="sync-preview-card">
              <div className="sync-preview-head">
                <span>Xem trước import</span>
                <b>{preview.label}</b>
              </div>
              <div className="sync-preview-metrics">
                <div><span>Hiện có</span><b>{number(preview.currentRows)}</b></div>
                <div><span>Dòng hợp lệ</span><b>{number(preview.validRows)}</b></div>
                <div><span>Thêm mới</span><b>{number(preview.willInsert)}</b></div>
                <div><span>Cập nhật</span><b>{number(preview.willUpdate)}</b></div>
                <div><span>Thay thế</span><b>{number(preview.willReplace)}</b></div>
                <div><span>Bỏ qua</span><b>{number(preview.willSkip)}</b></div>
              </div>
              {preview.warnings.length > 0 ? (
                <div className="sync-preview-warnings">
                  {preview.warnings.map((item, index) => (
                    <p key={`${item}-${index}`}>{item}</p>
                  ))}
                </div>
              ) : (
                <p className="sync-preview-ok">File hợp lệ, có thể import.</p>
              )}
              {preview.samples.length > 0 ? (
                <div className="sync-preview-samples">
                  {preview.samples.map((item, index) => (
                    <div key={`sample-${index}`}>
                      {Object.entries(item).map(([key, value]) => (
                        <span key={key}>{key}: <b>{value || "-"}</b></span>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <button type="button" onClick={runPreviewImport} disabled={busy === "preview" || busy === "import"}>
            {busy === "preview" ? "Đang xem trước..." : "Xem trước import"}
          </button>

          <button type="button" className="sync-confirm-import" onClick={runImport} disabled={busy === "import" || !preview}>
            {busy === "import" ? "Đang import..." : `Import ${selectedImport.label}`}
          </button>
        </section>

        <section className="sync-box">
          <div className="sync-box-title">
            <h4>Export dữ liệu</h4>
            <small>CSV mở được bằng Google Sheet</small>
          </div>

          <div className="sync-auto-backup">
            <div className="sync-auto-backup-head">
              <span>Auto backup</span>
              <b>{backupStatus?.schedule || "06:00 - mỗi 3 giờ - chốt 23:00"}</b>
            </div>
            <p>Backup JSON lưu đầy đủ dữ liệu, gồm tài khoản nhân viên, Gmail, mật khẩu mã hóa và cấu hình hệ thống: <strong>{backupStatus?.fileName || "vtdd-backup.json"}</strong></p>
            <small>
              {backupStatus?.exists
                ? `Lần gần nhất: ${backupStatus.updatedAtVN || "-"} • ${formatBytes(backupStatus.bytes)}`
                : "Chưa có file backup tự động. File sẽ được tạo theo lịch từ 06:00 và chốt lúc 23:00."}
            </small>
            <div className="sync-backup-actions">
              <button
                type="button"
                className="sync-backup-download sync-backup-manual"
                onClick={() => runExport("backup")}
                disabled={busy === "export:backup"}
              >
                {busy === "export:backup" ? "Đang tạo backup..." : "Tạo backup tay"}
              </button>
              {backupStatus?.exists ? (
                <button
                  type="button"
                  className="sync-backup-download sync-backup-latest"
                  onClick={() => downloadBackupFile(backupStatus.fileName || "vtdd-backup.json")}
                  disabled={busy === `backup-download:${backupStatus.fileName || "vtdd-backup.json"}`}
                >
                  {busy === `backup-download:${backupStatus.fileName || "vtdd-backup.json"}` ? "Đang tải..." : "Tải backup mới nhất"}
                </button>
              ) : null}
            </div>
            <small>Lần kế tiếp: {backupStatus?.nextRunAtVN || "Theo lịch 06:00, mỗi 3 giờ và chốt 23:00"}</small>
            {backupStatus?.lastError ? <em>{backupStatus.lastError}</em> : null}
            <div className="sync-backup-restore">
              <label>
                <span>Import lại file backup JSON</span>
                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => setBackupImportFile(event.target.files?.[0] || null)}
                />
              </label>
              <button
                type="button"
                className="sync-backup-restore-button"
                onClick={runBackupRestore}
                disabled={busy === "backup-restore" || !backupImportFile}
              >
                {busy === "backup-restore" ? "Đang khôi phục..." : "Import backup JSON"}
              </button>
              <small>Thao tác này sẽ thay dữ liệu hiện tại bằng dữ liệu trong file backup.</small>
            </div>
            {backupStatus?.history?.length ? (
              <div className="sync-backup-history">
                {backupStatus.history.slice(0, 7).map((item) => {
                  const historyFileName = item.dailyFileName || item.fileName || "";

                  return (
                    <div className="sync-backup-history-item" key={historyFileName || item.createdAt}>
                      <b>{historyFileName || "vtdd-backup.json"}</b>
                      <small>{item.createdAtVN || item.createdAt || "-"} • {formatBytes(Number(item.bytes || 0))}</small>
                      <button
                        type="button"
                        className="sync-backup-download"
                        onClick={() => downloadBackupFile(historyFileName)}
                        disabled={!historyFileName || busy === `backup-download:${historyFileName}`}
                      >
                        {busy === `backup-download:${historyFileName}` ? "Đang tải..." : "Tải xuống"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
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

      {quality ? (
        <section className="sync-quality-panel">
          <div className="sync-quality-head">
            <div>
              <span>Dashboard chất lượng dữ liệu</span>
              <h4>Rà lỗi trước khi vận hành</h4>
            </div>
            <small>{new Date(quality.generatedAt).toLocaleString("vi-VN")}</small>
          </div>

          <div className="sync-quality-grid">
            {quality.sections.map((section) => (
              <article className="sync-quality-card" key={section.key}>
                <div className="sync-quality-card-head">
                  <div>
                    <span>{section.title}</span>
                    <b>{number(section.total)}</b>
                  </div>
                </div>

                <div className="sync-quality-issues">
                  {section.issues.map((issue) => (
                    <div className={`sync-quality-issue ${issue.severity}`} key={`${section.key}-${issue.label}`}>
                      <div>
                        <span>{issue.label}</span>
                        {issue.samples?.length ? <small>{issue.samples.join(" | ")}</small> : null}
                      </div>
                      <b>{number(issue.value)}</b>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
.sync-head-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
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
.sync-confirm-import {
  background: #07111f !important;
  color: #ffd400 !important;
}
.sync-preview-card {
  display: grid;
  gap: 10px;
  margin: 10px 0;
  padding: 12px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #dbe5ef;
}
.sync-preview-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}
.sync-preview-head span,
.sync-quality-head span {
  color: #0f766e;
  font-size: 10px;
  font-weight: 1000;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.sync-preview-head b {
  color: #07111f;
  font-size: 14px;
  font-weight: 1000;
}
.sync-preview-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}
.sync-preview-metrics div {
  padding: 9px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.sync-preview-metrics span {
  display: block;
  color: #64748b;
  font-size: 9px;
  font-weight: 1000;
  text-transform: uppercase;
}
.sync-preview-metrics b {
  display: block;
  margin-top: 4px;
  color: #07111f;
  font-size: 16px;
  font-weight: 1000;
}
.sync-preview-warnings {
  display: grid;
  gap: 6px;
}
.sync-preview-warnings p,
.sync-preview-ok {
  margin: 0;
  padding: 9px 10px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 900;
}
.sync-preview-warnings p {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
}
.sync-preview-ok {
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  color: #047857;
}
.sync-preview-samples {
  display: grid;
  gap: 6px;
  max-height: 180px;
  overflow: auto;
}
.sync-preview-samples div {
  display: grid;
  gap: 3px;
  padding: 8px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.sync-preview-samples span {
  color: #64748b;
  font-size: 10.5px;
  line-height: 1.35;
  font-weight: 850;
}
.sync-preview-samples b {
  color: #07111f;
}
.sync-auto-backup {
  display: grid;
  gap: 7px;
  margin-bottom: 12px;
  padding: 12px;
  border-radius: 16px;
  background: linear-gradient(135deg, #ecfdf5, #ffffff);
  border: 1px solid #99f6e4;
}
.sync-auto-backup-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}
.sync-auto-backup span {
  color: #0f766e;
  font-size: 10px;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.sync-auto-backup b {
  color: #07111f;
  font-size: 13px;
  font-weight: 1000;
}
.sync-auto-backup p,
.sync-auto-backup small,
.sync-auto-backup em {
  margin: 0;
  color: #334155;
  font-size: 11px;
  line-height: 1.35;
  font-weight: 850;
  font-style: normal;
}
.sync-auto-backup strong {
  color: #0f766e;
  font-weight: 1000;
}
.sync-auto-backup em {
  padding: 8px 9px;
  border-radius: 12px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #991b1b;
}
.sync-backup-download {
  width: fit-content;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(7, 17, 31, .08);
  background: #07111f;
  color: #ffd400;
  font-size: 10.5px;
  font-weight: 1000;
  cursor: pointer;
}
.sync-backup-download:disabled {
  cursor: not-allowed;
  opacity: .62;
}
.sync-backup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 3px;
}
.sync-backup-manual {
  background: #ffd400;
  color: #07111f;
}
.sync-backup-latest {
  background: #07111f;
  color: #ffd400;
}
.sync-backup-restore {
  display: grid;
  gap: 8px;
  margin-top: 8px;
  padding: 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, .76);
  border: 1px solid #dbe4ef;
}
.sync-backup-restore label {
  display: grid;
  gap: 6px;
}
.sync-backup-restore input {
  width: 100%;
  min-height: 42px;
  border-radius: 13px;
  border: 1px solid #cbd8e6;
  background: #f8fafc;
  color: #07111f;
  font-size: 12px;
  font-weight: 850;
}
.sync-backup-restore-button {
  width: 100%;
  min-height: 42px;
  border-radius: 13px;
  background: #dc2626 !important;
  color: #fff !important;
}
.sync-backup-history {
  margin-top: 8px;
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px !important;
}
.sync-backup-history-item {
  display: grid;
  gap: 4px;
  padding: 9px 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, .76);
  border: 1px solid #dbe4ef;
}
.sync-backup-history-item b {
  color: #07111f;
  font-size: 11px;
  font-weight: 1000;
  overflow-wrap: anywhere;
}
.sync-backup-history-item small {
  color: #64748b;
  font-size: 10.5px;
  font-weight: 850;
}
.sync-backup-history-item .sync-backup-download {
  width: 100%;
  min-height: 30px;
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
.sync-quality-panel {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #dbe5ef;
}
.sync-quality-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: start;
}
.sync-quality-head h4 {
  margin: 5px 0 0;
  color: #07111f;
  font-size: 18px;
  font-weight: 1000;
}
.sync-quality-head small {
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
}
.sync-quality-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.sync-quality-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
}
.sync-quality-card-head span {
  color: #64748b;
  font-size: 10px;
  font-weight: 1000;
  text-transform: uppercase;
}
.sync-quality-card-head b {
  display: block;
  margin-top: 4px;
  color: #07111f;
  font-size: 22px;
  font-weight: 1000;
}
.sync-quality-issues {
  display: grid;
  gap: 7px;
}
.sync-quality-issue {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
  padding: 9px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.sync-quality-issue.warn {
  background: #fff7ed;
  border-color: #fed7aa;
}
.sync-quality-issue.danger {
  background: #fef2f2;
  border-color: #fecaca;
}
.sync-quality-issue span {
  display: block;
  color: #07111f;
  font-size: 12px;
  font-weight: 1000;
}
.sync-quality-issue small {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 10.5px;
  line-height: 1.35;
  font-weight: 800;
}
.sync-quality-issue b {
  color: #07111f;
  font-size: 15px;
  font-weight: 1000;
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
  .sync-head-actions {
    justify-content: stretch;
  }
  .sync-head-actions button {
    width: 100%;
  }
  .sync-head h3 {
    font-size: 23px;
  }
  .sync-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .sync-preview-metrics,
  .sync-quality-grid {
    grid-template-columns: 1fr;
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
