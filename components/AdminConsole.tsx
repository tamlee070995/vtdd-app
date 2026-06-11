"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";

type AdminStaff = {
  rowNumber: number;
  maNV: string;
  staffName: string;
  maST: string;
  storeName: string;
  department: string;
  status: string;
  resetOtpCount: string;
  needSetup: string;
  gmail: string;
  permission: "admin" | "mod" | "";
  modulePermissions: string;
};

type StaffSummary = {
  total: number;
  active: number;
  standby: number;
  needSetup: number;
};

type StaffMeta = {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  summary: StaffSummary;
};

type DashboardLogRow = {
  time: string;
  action: string;
  maNV: string;
  maST: string;
  staffName: string;
  mode: string;
  spMoi: string;
  spCu: string;
  memory: string;
  loai: string;
  tongTien: number;
  ip: string;
};

type AdminDashboard = {
  topOldProducts: Array<{ product: string; count: number }>;
  recentLogs: DashboardLogRow[];
  totalLogs: number;
};

type AdminRole = "admin" | "mod";

type AdminConsoleProps = {
  initialSettings: Record<string, string>;
  adminRole?: AdminRole;
  adminName?: string;
  adminModules?: string;
};

type OnlineStats = {
  total: number;
  home: number;
  staff: number;
  customer: number;
  updatedAt: string;
};

const EMPTY_ONLINE_STATS: OnlineStats = {
  total: 0,
  home: 0,
  staff: 0,
  customer: 0,
  updatedAt: "",
};

const EMPTY_DASHBOARD: AdminDashboard = {
  topOldProducts: [],
  recentLogs: [],
  totalLogs: 0,
};

type TabKey = "overview" | "staff" | "permission" | "notify" | "system" | "dashboard" | "security";

type ToastState = {
  type: "success" | "error";
  text: string;
} | null;

const EMPTY_SUMMARY: StaffSummary = {
  total: 0,
  active: 0,
  standby: 0,
  needSetup: 0,
};

const TAB_ITEMS: Array<{
  key: TabKey;
  label: string;
  desc: string;
  icon: string;
}> = [
  { key: "overview", label: "Tổng quan", desc: "Trạng thái", icon: "01" },
  { key: "staff", label: "Nhân viên", desc: "Duyệt & reset", icon: "02" },
  { key: "permission", label: "Phân quyền", desc: "Admin / Mod", icon: "03" },
  { key: "notify", label: "Thông báo", desc: "Banner & push", icon: "04" },
  { key: "system", label: "Hệ thống", desc: "Lock & reload", icon: "05" },
  { key: "dashboard", label: "Dashboard", desc: "Tra giá & log", icon: "06" },
  { key: "security", label: "Bảo mật", desc: "PIN admin", icon: "07" },
];


const ADMIN_MODULE_OPTIONS = [
  { key: "tcdm", label: "1.1 Tra giá TCDM" },
  { key: "quy-trinh-thu-cu", label: "1.2 Quy trình TCDM" },
  { key: "may-moi", label: "2 Trang máy mới" },
  { key: "may-cu", label: "3 Trang máy cũ" },
  { key: "demo", label: "4 Trang demo" },
  { key: "tools", label: "5 Công cụ" },
];

function isOn(value: string) {
  const v = String(value || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function toFlag(value: boolean) {
  return value ? "1" : "0";
}

function money(value: number) {
  if (!value || value <= 0) return "0 đ";
  return Number(value).toLocaleString("vi-VN") + " đ";
}

function getErrorMessage(err: any) {
  return err?.message || "Không thực hiện được thao tác.";
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function TcdmAdminConsole({ initialSettings, adminRole = "admin" }: AdminConsoleProps) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [settings, setSettings] = useState<Record<string, string>>(initialSettings);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [onlineStats, setOnlineStats] = useState<OnlineStats>(EMPTY_ONLINE_STATS);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<AdminDashboard>(EMPTY_DASHBOARD);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);

  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [staffMeta, setStaffMeta] = useState<StaffMeta>({
    page: 1,
    pageSize: 50,
    total: 0,
    pages: 1,
    summary: EMPTY_SUMMARY,
  });
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSearchInput, setStaffSearchInput] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [staffStatusFilter, setStaffStatusFilter] = useState<"ALL" | "Active" | "Standby">("ALL");
  const [staffPage, setStaffPage] = useState(1);

  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const summary = staffMeta.summary || EMPTY_SUMMARY;
  const isFullAdmin = String(adminRole || "").toLowerCase() === "admin";

  const lockCount = useMemo(() => {
    return [
      "SYSTEM_LOCK_ENABLED",
      "STAFF_PAGE_LOCKED",
      "CUSTOMER_PAGE_LOCKED",
      "STAFF_TRADEIN_LOCKED",
      "STAFF_BUYONLY_LOCKED",
      "CUSTOMER_TRADEIN_LOCKED",
      "CUSTOMER_BUYONLY_LOCKED",
    ].filter((key) => isOn(settings[key])).length;
  }, [settings]);

  const notifyCount = useMemo(() => {
    return [
      settings.MARQUEE_MESSAGE,
      settings.FIXED_BANNER_MESSAGE,
      settings.PUSH_NOTIFY_MESSAGE,
    ].filter((item) => String(item || "").trim()).length;
  }, [settings]);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 2800);
  }

  async function postJSON(url: string, body: any) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      throw new Error(data?.message || "Không thực hiện được thao tác.");
    }

    return data;
  }

  async function loadOnlineStats(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) setOnlineLoading(true);

      const res = await fetch("/api/admin/online", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Không tải được thống kê trực tuyến.");
      }

      setOnlineStats(data.online || EMPTY_ONLINE_STATS);
      setOnlineLoading(false);
    } catch {
      setOnlineLoading(false);
    }
  }

  async function loadStaff(nextPage = staffPage, options?: { silent?: boolean }) {
    try {
      if (!options?.silent) setStaffLoading(true);

      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: "50",
        status: staffStatusFilter,
        q: staffQuery,
      });

      const res = await fetch(`/api/admin/staff?${params.toString()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Không tải được danh sách nhân viên.");
      }

      setStaff(data.staff || []);
      setStaffMeta(
        data.meta || {
          page: nextPage,
          pageSize: 50,
          total: 0,
          pages: 1,
          summary: EMPTY_SUMMARY,
        }
      );
      setStaffPage(data.meta?.page || nextPage);
      setStaffLoading(false);
    } catch (err: any) {
      setStaffLoading(false);
      showToast("error", getErrorMessage(err));
    }
  }

  async function loadDashboard(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) setDashboardLoading(true);

      const res = await fetch("/api/admin/dashboard", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Không tải được dashboard.");
      }

      setDashboardData(data.dashboard || EMPTY_DASHBOARD);
      setDashboardLoaded(true);
      setDashboardLoading(false);
    } catch (err: any) {
      setDashboardLoading(false);
      showToast("error", getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadOnlineStats({ silent: true });

    const timer = window.setInterval(() => {
      loadOnlineStats({ silent: true });
    }, 10000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab !== "staff" && tab !== "permission") return;
    loadStaff(staffPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, staffStatusFilter, staffQuery, staffPage]);

  useEffect(() => {
    if (tab !== "dashboard") return;
    if (dashboardLoaded) return;
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, dashboardLoaded]);

  async function runStaffAction(action: "ACTIVE" | "STANDBY" | "RESET_SECURITY" | "RESET_OTP_COUNT", maNV: string) {
    try {
      setBusy(`${action}-${maNV}`);

      const data = await postJSON("/api/admin/staff", {
        action,
        maNV,
      });

      showToast("success", data.message || "Đã cập nhật.");
      setBusy("");
      await loadStaff(staffPage, { silent: true });
    } catch (err: any) {
      setBusy("");
      showToast("error", getErrorMessage(err));
    }
  }

  async function runStaffAdminAccess(maNV: string, permission: string, modules: string) {
    try {
      setBusy(`UPDATE_PERMISSION-${maNV}`);

      const data = await postJSON("/api/admin/staff", {
        action: "UPDATE_PERMISSION",
        maNV,
        permission,
        modules,
      });

      showToast("success", data.message || "Đã cập nhật phân quyền.");
      setBusy("");
      await loadStaff(staffPage, { silent: true });
    } catch (err: any) {
      setBusy("");
      showToast("error", getErrorMessage(err));
    }
  }

  async function saveSettings(extra?: Record<string, string>) {
    try {
      setBusy("settings");

      const payload = {
        ...settings,
        ...(extra || {}),
      };

      const apiPayload = { ...payload };

      ["PRICE_EFFECTIVE_FROM", "PRICE_EFFECTIVE_TO"].forEach((key) => {
        const value = String(apiPayload[key] || "").trim();
        if (value && !value.startsWith("'")) {
          apiPayload[key] = `'${value}`;
        }
      });

      const data = await postJSON("/api/admin/settings", {
        settings: apiPayload,
      });

      setSettings(payload);
      showToast("success", data.message || "Đã lưu cấu hình.");
      setBusy("");
    } catch (err: any) {
      setBusy("");
      showToast("error", getErrorMessage(err));
    }
  }

  async function reloadDataVersion() {
    const nextVersion = String(Date.now());
    await saveSettings({ DATA_VERSION: nextVersion });
  }

  async function changePin() {
    try {
      setBusy("pin");

      const data = await postJSON("/api/admin/change-pin", {
        oldPin,
        newPin,
        confirmPin,
      });

      setOldPin("");
      setNewPin("");
      setConfirmPin("");
      showToast("success", data.message || "Đã đổi PIN admin.");
      setBusy("");
    } catch (err: any) {
      setBusy("");
      showToast("error", getErrorMessage(err));
    }
  }

  function setSetting(key: string, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function applyStaffSearch() {
    setStaffPage(1);
    setStaffQuery(staffSearchInput.trim());
  }

  function ToggleRow({ settingKey, title, desc }: { settingKey: string; title: string; desc: string }) {
    const checked = isOn(settings[settingKey]);

    return (
      <label className="adminx-toggle-row">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setSetting(settingKey, toFlag(e.target.checked))}
        />
        <span className="adminx-switch" aria-hidden="true"></span>
        <div>
          <b>{title}</b>
          <p>{desc}</p>
        </div>
      </label>
    );
  }

  return (
    <section className="adminx-console">
      <style>{ADMINX_STYLE}</style>
      <style>{ADMINX_ONLINE_STYLE}</style>

      <nav className="adminx-tabs" aria-label="Admin navigation">
        {TAB_ITEMS.map((item) => (
          <button
            key={item.key}
            className={tab === item.key ? "active" : ""}
            onClick={() => setTab(item.key)}
            type="button"
          >
            <i>{item.icon}</i>
            <span>
              <b>{item.label}</b>
              <em>{item.desc}</em>
            </span>
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <section className="adminx-panel">
          <div className="adminx-panel-head">
            <div>
              <span className="adminx-eyebrow">Overview</span>
              <h2>Tổng quan vận hành</h2>
              <p>Theo dõi trạng thái tài khoản, thông báo, lock hệ thống và dữ liệu tra giá.</p>
            </div>
          </div>

          <div className="adminx-metric-grid">
            <div className="adminx-metric-card dark">
              <span>Data version</span>
              <b>{settings.DATA_VERSION || "1"}</b>
              <p>Phiên bản dữ liệu hiện tại của hệ thống.</p>
            </div>
            <div className="adminx-metric-card">
              <span>Thông báo</span>
              <b>{formatNumber(notifyCount)}</b>
              <p>Số cấu hình thông báo đang có nội dung.</p>
            </div>
            <div className="adminx-metric-card">
              <span>Lock</span>
              <b>{formatNumber(lockCount)}</b>
              <p>Số khóa hệ thống / trang / tab đang bật.</p>
            </div>
            <div className="adminx-metric-card">
              <span>Online</span>
              <b>{formatNumber(onlineStats.total)}</b>
              <p>Người dùng đang hoạt động gần đây.</p>
            </div>
          </div>

          <div className="adminx-online-panel">
            <div className="adminx-online-head">
              <div>
                <span>Trực tuyến toàn hệ thống</span>
                <h3>{formatNumber(onlineStats.total)}</h3>
                <p>Người dùng đang hoạt động trong khoảng 70 giây gần nhất.</p>
              </div>
              <button type="button" onClick={() => loadOnlineStats()} disabled={onlineLoading}>
                {onlineLoading ? "Đang tải..." : "Cập nhật"}
              </button>
            </div>

            <div className="adminx-online-grid">
              <div>
                <span>Trang chủ</span>
                <b>{formatNumber(onlineStats.home)}</b>
              </div>
              <div>
                <span>Nhân viên</span>
                <b>{formatNumber(onlineStats.staff)}</b>
              </div>
              <div>
                <span>Khách hàng</span>
                <b>{formatNumber(onlineStats.customer)}</b>
              </div>
            </div>
          </div>

          <div className="adminx-overview-grid">
            <div className="adminx-soft-card">
              <span>Thông báo</span>
              <b>{notifyCount} mục đang cấu hình</b>
              <p>Marquee, banner cố định và push notify một lần.</p>
            </div>
            <div className="adminx-soft-card">
              <span>Lock access</span>
              <b>{lockCount} khóa đang bật</b>
              <p>Khóa toàn hệ thống, trang hoặc từng tab con.</p>
            </div>
            <div className="adminx-soft-card">
              <span>Data version</span>
              <b>{settings.DATA_VERSION || "1"}</b>
              <p>Dùng để reload dữ liệu bảng giá khi cập nhật khẩn cấp.</p>
            </div>
          </div>
        </section>
      )}

      {tab === "staff" && (
        <section className="adminx-panel">
          <div className="adminx-panel-head adminx-panel-head-row">
            <div>
              <span className="adminx-eyebrow">Staff Access</span>
              <h2>Nhân viên & phê duyệt</h2>
              <p>Quản lý trạng thái tài khoản, reset bảo mật và OTP cho nhân viên.</p>
            </div>
            <button className="adminx-action-btn" type="button" onClick={() => loadStaff(staffPage)} disabled={staffLoading}>
              {staffLoading ? "Đang tải..." : "Tải lại"}
            </button>
          </div>

          <div className="adminx-staff-summary">
            <div>
              <span>Tất cả</span>
              <b>{formatNumber(summary.total)}</b>
            </div>
            <div>
              <span>Active</span>
              <b>{formatNumber(summary.active)}</b>
            </div>
            <div>
              <span>Standby</span>
              <b>{formatNumber(summary.standby)}</b>
            </div>
            <div>
              <span>Need setup</span>
              <b>{formatNumber(summary.needSetup)}</b>
            </div>
          </div>

          <div className="adminx-filter-bar">
            <input
              value={staffSearchInput}
              onChange={(e) => setStaffSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyStaffSearch();
              }}
              placeholder="Tìm mã NV, tên, mã ST, siêu thị, phòng ban"
            />
            <select
              value={staffStatusFilter}
              onChange={(e) => {
                setStaffPage(1);
                setStaffStatusFilter(e.target.value as "ALL" | "Active" | "Standby");
              }}
            >
              <option value="ALL">Tất cả</option>
              <option value="Standby">Standby</option>
              <option value="Active">Active</option>
            </select>
            <button type="button" onClick={applyStaffSearch} disabled={staffLoading}>
              Tìm
            </button>
          </div>

          <div className="adminx-table-card">
            <div className="adminx-table-toolbar">
              <span>
                Hiển thị <b>{formatNumber(staff.length)}</b> / <b>{formatNumber(staffMeta.total)}</b> kết quả
              </span>
              <em>
                Trang {formatNumber(staffMeta.page)} / {formatNumber(staffMeta.pages)}
              </em>
            </div>

            <div className="adminx-staff-list">
              {staffLoading ? (
                <div className="adminx-empty-state">
                  <div className="adminx-spinner"></div>
                  <b>Đang tải danh sách</b>
                  <p>Vui lòng chờ trong giây lát.</p>
                </div>
              ) : staff.length === 0 ? (
                <div className="adminx-empty-state">
                  <b>Không tìm thấy nhân viên</b>
                  <p>Thử đổi từ khóa hoặc trạng thái lọc.</p>
                </div>
              ) : (
                staff.map((item) => (
                  <article className="adminx-staff-card" key={`${item.maNV}-${item.rowNumber}`}>
                    <div className="adminx-staff-main">
                      <div className="adminx-staff-topline">
                        <span className={item.status === "Active" ? "adminx-badge active" : "adminx-badge standby"}>
                          {item.status || "Standby"}
                        </span>
                        <em>NV {item.maNV}</em>
                      </div>

                      <h3>{item.staffName || "Chưa có tên"}</h3>

                      <div className="adminx-staff-meta">
                        <span>ST: {item.maST || "—"}</span>
                        <span>{item.storeName || "Chưa có siêu thị"}</span>
                        <span>{item.department || "Chưa có phòng ban"}</span>
                      </div>

                      <div className="adminx-staff-flags">
                        <span>OTP: {item.resetOtpCount || "0"}</span>
                        <span>SETUP: {item.needSetup || "0"}</span>
                        {item.gmail ? <span>{item.gmail}</span> : null}
                        {item.permission ? <span>QUYỀN: {item.permission.toUpperCase()}</span> : <span>QUYỀN: —</span>}
                      </div>

                      <StaffAdminAccessBox
                        item={item}
                        disabled={busy === `UPDATE_PERMISSION-${item.maNV}`}
                        onSave={runStaffAdminAccess}
                      />
                    </div>

                    <div className="adminx-staff-actions">
                      <button
                        type="button"
                        className="primary"
                        disabled={busy === `ACTIVE-${item.maNV}` || item.status === "Active"}
                        onClick={() => runStaffAction("ACTIVE", item.maNV)}
                      >
                        Active
                      </button>
                      <button
                        type="button"
                        disabled={busy === `STANDBY-${item.maNV}` || item.status === "Standby"}
                        onClick={() => runStaffAction("STANDBY", item.maNV)}
                      >
                        Standby
                      </button>
                      <button
                        type="button"
                        disabled={busy === `RESET_SECURITY-${item.maNV}`}
                        onClick={() => {
                          const ok = window.confirm(
                            `Reset tài khoản ${item.maNV}: mật khẩu về 123123, xóa bảo mật/Gmail, NEED_SETUP=1 và OTP count=0?`
                          );
                          if (ok) runStaffAction("RESET_SECURITY", item.maNV);
                        }}
                      >
                        Reset bảo mật
                      </button>
                      <button
                        type="button"
                        disabled={busy === `RESET_OTP_COUNT-${item.maNV}`}
                        onClick={() => runStaffAction("RESET_OTP_COUNT", item.maNV)}
                      >
                        Reset OTP
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="adminx-pagination">
            <button
              type="button"
              disabled={staffLoading || staffMeta.page <= 1}
              onClick={() => setStaffPage((v) => Math.max(1, v - 1))}
            >
              Trang trước
            </button>
            <span>
              {formatNumber(staffMeta.page)} / {formatNumber(staffMeta.pages)}
            </span>
            <button
              type="button"
              disabled={staffLoading || staffMeta.page >= staffMeta.pages}
              onClick={() => setStaffPage((v) => Math.min(staffMeta.pages, v + 1))}
            >
              Trang sau
            </button>
          </div>
        </section>
      )}


      {tab === "permission" && (
        <section className="adminx-panel adminx-permission-page">
          <div className="adminx-panel-head adminx-panel-head-row">
            <div>
              <span className="adminx-eyebrow">Permission Control</span>
              <h2>Phân quyền Admin / Mod / User</h2>
              <p>Admin có thể cấp/xóa quyền Admin hoặc Mod. Mod chỉ được quản trị các hạng mục được cấp.</p>
            </div>
            <button className="adminx-action-btn" type="button" onClick={() => loadStaff(staffPage)} disabled={staffLoading}>
              {staffLoading ? "Đang tải..." : "Tải lại danh sách"}
            </button>
          </div>

          {!isFullAdmin && (
            <div className="adminx-permission-alert">
              Chỉ tài khoản Admin mới được cấp hoặc xóa quyền Admin/Mod. Tài khoản Mod chỉ xem được danh sách quyền hiện tại.
            </div>
          )}

          <div className="adminx-filter-bar">
            <input
              value={staffSearchInput}
              onChange={(e) => setStaffSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyStaffSearch();
              }}
              placeholder="Nhập mã NV hoặc tên nhân viên cần phân quyền"
            />
            <select
              value={staffStatusFilter}
              onChange={(e) => {
                setStaffPage(1);
                setStaffStatusFilter(e.target.value as "ALL" | "Active" | "Standby");
              }}
            >
              <option value="ALL">Tất cả</option>
              <option value="Active">Active</option>
              <option value="Standby">Standby</option>
            </select>
            <button type="button" onClick={applyStaffSearch} disabled={staffLoading}>
              Tìm
            </button>
          </div>

          <div className="adminx-permission-list-v3">
            {staffLoading ? (
              <div className="adminx-empty-state">
                <div className="adminx-spinner"></div>
                <b>Đang tải danh sách</b>
                <p>Vui lòng chờ trong giây lát.</p>
              </div>
            ) : staff.length === 0 ? (
              <div className="adminx-empty-state">
                <b>Không tìm thấy nhân viên</b>
                <p>Thử nhập mã nhân viên hoặc tên khác.</p>
              </div>
            ) : (
              staff.map((item) => (
                <article className="adminx-permission-card-v3" key={`permission-${item.maNV}-${item.rowNumber}`}>
                  <div className="adminx-permission-user-v3">
                    <span className={item.status === "Active" ? "adminx-badge active" : "adminx-badge standby"}>
                      {item.status || "Standby"}
                    </span>
                    <h3>{item.staffName || "Chưa có tên"}</h3>
                    <p>NV {item.maNV} · ST {item.maST || "—"} · {item.storeName || "Chưa có siêu thị"}</p>
                    <div className="adminx-staff-flags">
                      {item.permission ? <span>QUYỀN: {item.permission.toUpperCase()}</span> : <span>QUYỀN: USER THƯỜNG</span>}
                      {item.modulePermissions ? <span>MODULES: {item.modulePermissions}</span> : <span>MODULES: —</span>}
                    </div>
                  </div>

                  <StaffAdminAccessBox
                    item={item}
                    disabled={!isFullAdmin || busy === `UPDATE_PERMISSION-${item.maNV}`}
                    onSave={runStaffAdminAccess}
                  />
                </article>
              ))
            )}
          </div>

          <div className="adminx-pagination">
            <button
              type="button"
              disabled={staffLoading || staffMeta.page <= 1}
              onClick={() => setStaffPage((v) => Math.max(1, v - 1))}
            >
              Trang trước
            </button>
            <span>
              {formatNumber(staffMeta.page)} / {formatNumber(staffMeta.pages)}
            </span>
            <button
              type="button"
              disabled={staffLoading || staffMeta.page >= staffMeta.pages}
              onClick={() => setStaffPage((v) => Math.min(staffMeta.pages, v + 1))}
            >
              Trang sau
            </button>
          </div>
        </section>
      )}


      {tab === "notify" && (
        <section className="adminx-panel">
          <div className="adminx-panel-head adminx-panel-head-row">
            <div>
              <span className="adminx-eyebrow">System Notify</span>
              <h2>Thông báo hệ thống</h2>
              <p>Cấu hình nội dung hiển thị trên trang nhân viên và khách hàng.</p>
            </div>
            <button className="adminx-action-btn" type="button" onClick={() => saveSettings()} disabled={busy === "settings"}>
              {busy === "settings" ? "Đang lưu..." : "Lưu thông báo"}
            </button>
          </div>

          <div className="adminx-form-grid">
            <label>
              <span>Thông báo marquee</span>
              <textarea
                value={settings.MARQUEE_MESSAGE || ""}
                onChange={(e) => setSetting("MARQUEE_MESSAGE", e.target.value)}
                placeholder="Nhập nội dung chạy ngang trên banner..."
              />
            </label>
            <div className="adminx-form-field adminx-form-wide adminx-notice-rich-field">
              <span>Thông báo quan trọng trên trang nhân viên</span>
              <Editor
                tinymceScriptSrc="/tinymce/tinymce.min.js"
                licenseKey="gpl"
                value={settings.FIXED_BANNER_MESSAGE || ""}
                onEditorChange={(value) => setSetting("FIXED_BANNER_MESSAGE", value)}
                init={{
                  height: 300,
                  menubar: "edit view insert format tools table help",
                  branding: true,
                  promotion: false,
                  automatic_uploads: true,
                  paste_data_images: true,
                  images_reuse_filename: false,
                  image_title: true,
                  image_caption: true,
                  object_resizing: true,
                  convert_urls: false,
                  relative_urls: false,
                  remove_script_host: false,
                  file_picker_types: "image media file",
                  images_upload_handler: async (blobInfo, progress) => {
                    const formData = new FormData();
                    formData.append("file", blobInfo.blob(), blobInfo.filename());
                    formData.append("slug", "important-notice");

                    const res = await fetch("/api/admin/cms-upload", {
                      method: "POST",
                      body: formData,
                      cache: "no-store",
                    });

                    const data = await res.json().catch(() => null);

                    if (!res.ok || !data?.success || !data?.location) {
                      throw new Error(data?.message || "Upload ảnh thất bại.");
                    }

                    if (typeof progress === "function") progress(100);
                    return data.location;
                  },
                  plugins:
                    "advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table help wordcount",
                  toolbar:
                    "undo redo | blocks | bold italic underline forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | table link image media | removeformat code fullscreen help",
                  content_style:
                    "body{font-family:Roboto,Arial,sans-serif;font-size:14px;line-height:1.55;color:#0f172a;padding:12px;} img{display:block;max-width:100%!important;height:auto!important;margin:10px auto;border-radius:14px;} table{max-width:100%;border-collapse:collapse;} td,th{border:1px solid #e2e8f0;padding:6px;} p{margin:0 0 8px;} ul,ol{margin:6px 0 8px 20px;padding:0;}",
                }}
              />
              <small className="adminx-field-hint">
                Nội dung này chỉ hiển thị ở trang nhân viên. Khách hàng sẽ không thấy box thông báo quan trọng.
              </small>
            </div>
            <label>
              <span>Push notify hiển thị 1 lần</span>
              <textarea
                value={settings.PUSH_NOTIFY_MESSAGE || ""}
                onChange={(e) => setSetting("PUSH_NOTIFY_MESSAGE", e.target.value)}
                placeholder="Nhập nội dung popup hiển thị một lần..."
              />
            </label>
            <label>
              <span>Push notify version</span>
              <input
                value={settings.PUSH_NOTIFY_VERSION || ""}
                onChange={(e) => setSetting("PUSH_NOTIFY_VERSION", e.target.value)}
                placeholder="VD: 20260607-01"
              />
            </label>
          </div>

          <div className="adminx-inline-actions">
            <button
              type="button"
              onClick={() => saveSettings({ PUSH_NOTIFY_VERSION: String(Date.now()) })}
              disabled={busy === "settings"}
            >
              Lưu & phát push mới
            </button>
          </div>
        </section>
      )}

      {tab === "system" && (
        <section className="adminx-panel">
          <div className="adminx-panel-head adminx-panel-head-row">
            <div>
              <span className="adminx-eyebrow">System Control</span>
              <h2>Điều khiển hệ thống</h2>
              <p>Quản lý ngày áp dụng, khóa truy cập và reload dữ liệu bảng giá.</p>
            </div>
            <div className="adminx-button-stack">
              <button className="adminx-action-btn" type="button" onClick={() => saveSettings()} disabled={busy === "settings"}>
                {busy === "settings" ? "Đang lưu..." : "Lưu hệ thống"}
              </button>
              <button className="adminx-action-btn secondary" type="button" onClick={reloadDataVersion} disabled={busy === "settings"}>
                Reload data
              </button>
            </div>
          </div>

          <div className="adminx-form-grid">
            <label>
              <span>Ngày áp dụng từ</span>
              <input
                value={settings.PRICE_EFFECTIVE_FROM || ""}
                onChange={(e) => setSetting("PRICE_EFFECTIVE_FROM", e.target.value)}
                placeholder="Để trống = đầu tháng hiện tại"
              />
            </label>
            <label>
              <span>Ngày áp dụng đến</span>
              <input
                value={settings.PRICE_EFFECTIVE_TO || ""}
                onChange={(e) => setSetting("PRICE_EFFECTIVE_TO", e.target.value)}
                placeholder="Để trống = cuối tháng hiện tại"
              />
            </label>
            <label>
              <span>Thông báo lock toàn màn hình</span>
              <input
                value={settings.SYSTEM_LOCK_MESSAGE || ""}
                onChange={(e) => setSetting("SYSTEM_LOCK_MESSAGE", e.target.value)}
                placeholder="HỆ THỐNG ĐANG CẬP NHẬT KHẨN."
              />
            </label>
            <label>
              <span>Data version</span>
              <input value={settings.DATA_VERSION || "1"} readOnly />
            </label>
          </div>

          <div className="adminx-lock-grid">
            <ToggleRow settingKey="SYSTEM_LOCK_ENABLED" title="Lock web khẩn cấp" desc="Hiển thị toàn màn hình cập nhật khẩn." />
            <ToggleRow settingKey="STAFF_PAGE_LOCKED" title="Khóa trang nhân viên" desc="Chặn truy cập cổng tra giá nhân viên." />
            <ToggleRow settingKey="CUSTOMER_PAGE_LOCKED" title="Khóa trang khách hàng" desc="Chặn truy cập trang khách hàng cá nhân." />
            <ToggleRow settingKey="STAFF_TRADEIN_LOCKED" title="Khóa nhân viên - Thu cũ đổi mới" desc="Khóa tab Thu cũ đổi mới trên trang nhân viên." />
            <ToggleRow settingKey="STAFF_BUYONLY_LOCKED" title="Khóa nhân viên - Chỉ thu cũ" desc="Khóa tab Chỉ thu cũ trên trang nhân viên." />
            <ToggleRow settingKey="CUSTOMER_TRADEIN_LOCKED" title="Khóa khách - Thu cũ đổi mới" desc="Khóa tab Thu cũ đổi mới trên trang khách hàng." />
            <ToggleRow settingKey="CUSTOMER_BUYONLY_LOCKED" title="Khóa khách - Chỉ thu cũ" desc="Khóa tab Chỉ thu cũ trên trang khách hàng." />
          </div>
        </section>
      )}

      {tab === "dashboard" && (
        <section className="adminx-panel">
          <div className="adminx-panel-head adminx-panel-head-row">
            <div>
              <span className="adminx-eyebrow">Analytics</span>
              <h2>Dashboard tra giá</h2>
              <p>Dữ liệu log chỉ được tải khi mở tab Dashboard để giữ trang Admin nhẹ và nhanh.</p>
            </div>
            <button className="adminx-action-btn" type="button" onClick={() => loadDashboard()} disabled={dashboardLoading}>
              {dashboardLoading ? "Đang tải..." : dashboardLoaded ? "Tải lại" : "Tải dashboard"}
            </button>
          </div>

          <div className="adminx-dashboard-grid">
            <div className="adminx-analytics-card">
              <h3>Top 10 máy cũ tìm nhiều nhất</h3>
              <div className="adminx-ranking-list">
                {dashboardData.topOldProducts.length === 0 ? (
                  <p>Chưa có dữ liệu.</p>
                ) : (
                  dashboardData.topOldProducts.map((item, index) => (
                    <div key={`${item.product}-${index}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <b>{item.product}</b>
                      <em>{item.count} lượt</em>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="adminx-analytics-card">
              <h3>20 lượt tra giá gần đây</h3>
              <div className="adminx-log-list">
                {dashboardData.recentLogs.length === 0 ? (
                  <p>Chưa có dữ liệu.</p>
                ) : (
                  dashboardData.recentLogs.map((item, index) => (
                    <div key={`${item.time}-${index}`}>
                      <b>{item.spCu || "Không rõ máy cũ"}</b>
                      <span>
                        {item.time} • NV {item.maNV} • {item.action} • {money(item.tongTien)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === "security" && (
        <section className="adminx-panel">
          <div className="adminx-panel-head adminx-panel-head-row">
            <div>
              <span className="adminx-eyebrow">Security</span>
              <h2>Đổi PIN truy cập Admin</h2>
              <p>PIN mới được lưu bằng dạng hash trong System_Settings.</p>
            </div>
            <button className="adminx-action-btn" type="button" onClick={changePin} disabled={busy === "pin"}>
              {busy === "pin" ? "Đang đổi..." : "Đổi PIN"}
            </button>
          </div>

          <div className="adminx-form-grid">
            <label>
              <span>PIN hiện tại</span>
              <input
                type="password"
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value)}
                placeholder="Nhập PIN hiện tại"
              />
            </label>
            <label>
              <span>PIN mới</span>
              <input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
              />
            </label>
            <label>
              <span>Xác nhận PIN mới</span>
              <input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Nhập lại PIN mới"
              />
            </label>
          </div>
        </section>
      )}

      {toast && <div className={toast.type === "success" ? "adminx-toast success" : "adminx-toast error"}>{toast.text}</div>}
    </section>
  );
}


const ADMINX_STYLE = `
.admin-saas-page {
  min-height: 100vh;
  padding: max(16px, env(safe-area-inset-top)) 12px max(26px, env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 18% 0%, rgba(255, 212, 0, .22), transparent 34%),
    radial-gradient(circle at 92% 12%, rgba(37, 99, 235, .12), transparent 32%),
    linear-gradient(180deg, #ffffff 0%, #f8fafc 44%, #eef2f7 100%);
  color: #0f172a;
}

.admin-saas-shell {
  width: min(100%, 1120px);
  margin: 0 auto;
  display: grid;
  gap: 14px;
}

.admin-saas-hero {
  position: relative;
  overflow: hidden;
  min-height: 238px;
  padding: 22px;
  border-radius: 34px;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  color: #ffffff;
  background:
    radial-gradient(circle at 92% 8%, rgba(255, 212, 0, .58), transparent 30%),
    linear-gradient(135deg, #0f172a, #111827 58%, #020617);
  box-shadow: 0 24px 70px rgba(15, 23, 42, .20);
}

.admin-saas-hero::after {
  content: "";
  position: absolute;
  inset: auto 0 0 0;
  height: 88px;
  background:
    linear-gradient(90deg, rgba(255, 212, 0, .15), rgba(37, 99, 235, .10)),
    repeating-linear-gradient(90deg, rgba(255,255,255,.10) 0 1px, transparent 1px 13px);
  mask-image: linear-gradient(180deg, transparent, #000 45%);
}

.admin-saas-hero-left,
.admin-saas-hero-actions {
  position: relative;
  z-index: 2;
}

.admin-saas-kicker {
  width: fit-content;
  padding: 8px 11px;
  border-radius: 999px;
  background: rgba(255,255,255,.10);
  border: 1px solid rgba(255,255,255,.14);
  color: rgba(255,255,255,.80);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.admin-saas-hero h1 {
  margin-top: 30px;
  color: #ffffff;
  font-size: clamp(40px, 8vw, 76px);
  line-height: .88;
  font-weight: 900;
  letter-spacing: -.075em;
  text-transform: uppercase;
}

.admin-saas-hero h1 span {
  display: block;
  color: #ffd400;
}

.admin-saas-hero p {
  max-width: 540px;
  margin-top: 13px;
  color: rgba(255,255,255,.72);
  font-size: 13px;
  line-height: 1.5;
  font-weight: 750;
}

.admin-saas-hero-meta {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-saas-hero-meta span,
.admin-saas-ghost-link,
.admin-saas-logout {
  min-height: 38px;
  padding: 0 13px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.10);
  color: rgba(255,255,255,.82);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  text-decoration: none;
}

.admin-saas-hero-actions {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.admin-saas-logout {
  background: #ffd400;
  border-color: #ffd400;
  color: #111827;
}

.adminx-console {
  display: grid;
  gap: 12px;
}

.adminx-tabs {
  padding: 8px;
  border-radius: 28px;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  background: rgba(255,255,255,.88);
  border: 1px solid #e2e8f0;
  box-shadow: 0 16px 42px rgba(15, 23, 42, .06);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.adminx-tabs button {
  min-height: 70px;
  padding: 10px;
  border: 0;
  border-radius: 21px;
  display: flex;
  align-items: center;
  gap: 9px;
  background: transparent;
  color: #64748b;
  text-align: left;
  cursor: pointer;
}

.adminx-tabs button i {
  width: 34px;
  height: 34px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
}

.adminx-tabs button b {
  display: block;
  color: #0f172a;
  font-size: 13px;
  line-height: 1;
  font-weight: 900;
}

.adminx-tabs button em {
  display: block;
  margin-top: 5px;
  color: #64748b;
  font-size: 10.5px;
  line-height: 1.25;
  font-style: normal;
  font-weight: 750;
}

.adminx-tabs button.active {
  background: #0f172a;
  box-shadow: 0 14px 34px rgba(15, 23, 42, .18);
}

.adminx-tabs button.active i {
  background: #ffd400;
  color: #111827;
}

.adminx-tabs button.active b {
  color: #ffffff;
}

.adminx-tabs button.active em {
  color: rgba(255,255,255,.62);
}

.adminx-panel {
  padding: 18px;
  border-radius: 30px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 18px 48px rgba(15, 23, 42, .07);
}

.adminx-panel-head {
  margin-bottom: 16px;
}

.adminx-panel-head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.adminx-eyebrow {
  width: fit-content;
  display: inline-flex;
  padding: 7px 10px;
  border-radius: 999px;
  background: #0f172a;
  color: #ffd400;
  font-size: 9.5px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .11em;
  text-transform: uppercase;
}

.adminx-panel h2 {
  margin-top: 10px;
  color: #0f172a;
  font-size: 26px;
  line-height: 1.02;
  font-weight: 900;
  letter-spacing: -.055em;
}

.adminx-panel-head p {
  max-width: 650px;
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 750;
}

.adminx-action-btn,
.adminx-inline-actions button,
.adminx-filter-bar button,
.adminx-pagination button,
.adminx-staff-actions button {
  min-height: 42px;
  padding: 0 14px;
  border: 0;
  border-radius: 15px;
  background: #ffd400;
  color: #111827;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  cursor: pointer;
}

.adminx-action-btn.secondary,
.adminx-staff-actions button,
.adminx-pagination button {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #0f172a;
}

.adminx-staff-actions button.primary {
  background: #0f172a;
  border-color: #0f172a;
  color: #ffd400;
}

.adminx-action-btn:disabled,
.adminx-filter-bar button:disabled,
.adminx-pagination button:disabled,
.adminx-staff-actions button:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.adminx-button-stack {
  display: flex;
  gap: 8px;
}

.adminx-metric-grid,
.adminx-overview-grid,
.adminx-staff-summary,
.adminx-form-grid,
.adminx-lock-grid,
.adminx-dashboard-grid {
  display: grid;
  gap: 10px;
}

.adminx-metric-grid {
  grid-template-columns: repeat(4, 1fr);
}

.adminx-overview-grid,
.adminx-staff-summary {
  grid-template-columns: repeat(3, 1fr);
  margin-top: 10px;
}

.adminx-staff-summary {
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 12px;
}

.adminx-metric-card,
.adminx-soft-card,
.adminx-staff-summary div {
  min-height: 118px;
  padding: 15px;
  border-radius: 22px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.adminx-metric-card.dark {
  background: #0f172a;
  border-color: #0f172a;
}

.adminx-metric-card span,
.adminx-soft-card span,
.adminx-staff-summary span {
  display: block;
  color: #64748b;
  font-size: 10px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-metric-card.dark span,
.adminx-metric-card.dark p {
  color: rgba(255,255,255,.64);
}

.adminx-metric-card b,
.adminx-soft-card b,
.adminx-staff-summary b {
  display: block;
  margin-top: 11px;
  color: #0f172a;
  font-size: 30px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: -.06em;
}

.adminx-soft-card b {
  font-size: 18px;
  letter-spacing: -.035em;
  line-height: 1.2;
}

.adminx-metric-card.dark b {
  color: #ffd400;
}

.adminx-metric-card p,
.adminx-soft-card p {
  margin-top: 9px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 750;
}

.adminx-filter-bar {
  padding: 10px;
  border-radius: 22px;
  display: grid;
  grid-template-columns: 1fr 170px 92px;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.adminx-filter-bar input,
.adminx-filter-bar select,
.adminx-form-grid input,
.adminx-form-grid textarea {
  width: 100%;
  min-height: 48px;
  padding: 12px 13px;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #0f172a;
  font-size: 13px;
  font-weight: 850;
  outline: none;
}

.adminx-filter-bar input:focus,
.adminx-filter-bar select:focus,
.adminx-form-grid input:focus,
.adminx-form-grid textarea:focus {
  border-color: #facc15;
  box-shadow: 0 0 0 4px rgba(250, 204, 21, .16);
}

.adminx-table-card {
  margin-top: 12px;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  background: #ffffff;
}

.adminx-table-toolbar {
  min-height: 48px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 12px;
  font-weight: 850;
}

.adminx-table-toolbar b {
  color: #0f172a;
}

.adminx-table-toolbar em {
  color: #0f172a;
  font-style: normal;
  font-weight: 900;
}

.adminx-staff-list {
  display: grid;
  gap: 10px;
  padding: 10px;
}

.adminx-staff-card {
  padding: 14px;
  border-radius: 22px;
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 28px rgba(15, 23, 42, .045);
}

.adminx-staff-topline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.adminx-badge {
  width: fit-content;
  padding: 6px 9px;
  border-radius: 999px;
  font-size: 9.5px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-badge.active {
  background: #dcfce7;
  color: #15803d;
}

.adminx-badge.standby {
  background: #fff7ed;
  color: #c2410c;
}

.adminx-staff-topline em {
  color: #64748b;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
}

.adminx-staff-card h3 {
  margin-top: 9px;
  color: #0f172a;
  font-size: 18px;
  line-height: 1.1;
  font-weight: 900;
  letter-spacing: -.035em;
}

.adminx-staff-meta,
.adminx-staff-flags {
  margin-top: 9px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.adminx-staff-meta span,
.adminx-staff-flags span {
  padding: 7px 9px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #475569;
  font-size: 11px;
  line-height: 1;
  font-weight: 850;
}

.adminx-staff-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-content: center;
}

.adminx-empty-state {
  min-height: 170px;
  display: grid;
  place-items: center;
  text-align: center;
  color: #64748b;
}

.adminx-empty-state b {
  color: #0f172a;
  font-size: 16px;
  font-weight: 900;
}

.adminx-empty-state p {
  margin-top: 6px;
  font-size: 12px;
  font-weight: 750;
}

.adminx-spinner {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 4px solid #e2e8f0;
  border-top-color: #ffd400;
  animation: adminxSpin .85s linear infinite;
}

@keyframes adminxSpin {
  to { transform: rotate(360deg); }
}

.adminx-pagination {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
}

.adminx-pagination span {
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
}

.adminx-form-grid {
  grid-template-columns: repeat(2, 1fr);
}

.adminx-form-grid label {
  display: grid;
  gap: 7px;
}

.adminx-form-grid label > span {
  color: #64748b;
  font-size: 10px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-form-grid textarea {
  min-height: 96px;
  resize: vertical;
  line-height: 1.45;
}

.adminx-inline-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.adminx-lock-grid {
  margin-top: 14px;
  grid-template-columns: repeat(2, 1fr);
}

.adminx-toggle-row {
  padding: 13px;
  border-radius: 20px;
  display: grid;
  grid-template-columns: 50px 1fr;
  gap: 11px;
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  cursor: pointer;
}

.adminx-toggle-row input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.adminx-switch {
  position: relative;
  width: 48px;
  height: 28px;
  border-radius: 999px;
  background: #cbd5e1;
  box-shadow: inset 0 2px 5px rgba(15, 23, 42, .16);
}

.adminx-switch::after {
  content: "";
  position: absolute;
  top: 4px;
  left: 4px;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, .18);
  transition: .18s ease;
}

.adminx-toggle-row input:checked + .adminx-switch {
  background: #ffd400;
}

.adminx-toggle-row input:checked + .adminx-switch::after {
  transform: translateX(20px);
  background: #0f172a;
}

.adminx-toggle-row b {
  color: #0f172a;
  font-size: 13px;
  line-height: 1.1;
  font-weight: 900;
}

.adminx-toggle-row p {
  margin-top: 5px;
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.35;
  font-weight: 750;
}

.adminx-dashboard-grid {
  grid-template-columns: 1fr 1fr;
}

.adminx-analytics-card {
  padding: 14px;
  border-radius: 24px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.adminx-analytics-card h3 {
  color: #0f172a;
  font-size: 16px;
  font-weight: 900;
  letter-spacing: -.035em;
}

.adminx-ranking-list,
.adminx-log-list {
  margin-top: 12px;
  display: grid;
  gap: 8px;
  max-height: 520px;
  overflow: auto;
}

.adminx-ranking-list div,
.adminx-log-list div {
  padding: 10px;
  border-radius: 16px;
  display: grid;
  gap: 5px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
}

.adminx-ranking-list div {
  grid-template-columns: 36px 1fr auto;
  align-items: center;
}

.adminx-ranking-list span {
  width: 30px;
  height: 30px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: #0f172a;
  color: #ffd400;
  font-size: 11px;
  font-weight: 900;
}

.adminx-ranking-list b,
.adminx-log-list b {
  color: #0f172a;
  font-size: 12.5px;
  line-height: 1.25;
  font-weight: 900;
}

.adminx-ranking-list em,
.adminx-log-list span {
  color: #64748b;
  font-size: 11px;
  line-height: 1.3;
  font-style: normal;
  font-weight: 800;
}

.adminx-toast {
  position: fixed;
  left: 50%;
  bottom: max(18px, env(safe-area-inset-bottom));
  z-index: 999999;
  width: min(calc(100% - 24px), 430px);
  transform: translateX(-50%);
  padding: 13px 14px;
  border-radius: 18px;
  color: #ffffff;
  font-size: 13px;
  line-height: 1.35;
  font-weight: 900;
  box-shadow: 0 18px 44px rgba(15, 23, 42, .22);
}

.adminx-toast.success {
  background: #047857;
}

.adminx-toast.error {
  background: #dc2626;
}

@media screen and (max-width: 920px) {
  .adminx-tabs {
    grid-template-columns: repeat(2, 1fr);
  }

  .adminx-metric-grid,
  .adminx-overview-grid,
  .adminx-staff-summary,
  .adminx-form-grid,
  .adminx-lock-grid,
  .adminx-dashboard-grid {
    grid-template-columns: 1fr;
  }

  .adminx-staff-card {
    grid-template-columns: 1fr;
  }

  .adminx-filter-bar {
    grid-template-columns: 1fr;
  }

  .admin-saas-hero {
    display: grid;
  }

  .admin-saas-hero-actions {
    align-items: stretch;
  }
}

@media screen and (max-width: 430px) {
  .admin-saas-page {
    padding: 12px 10px 22px;
  }

  .admin-saas-hero {
    min-height: 220px;
    padding: 18px;
    border-radius: 30px;
  }

  .admin-saas-hero h1 {
    font-size: 42px;
  }

  .admin-saas-hero-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .adminx-tabs {
    padding: 7px;
    border-radius: 24px;
    gap: 7px;
  }

  .adminx-tabs button {
    min-height: 62px;
    padding: 9px;
  }

  .adminx-tabs button i {
    width: 30px;
    height: 30px;
  }

  .adminx-tabs button b {
    font-size: 12px;
  }

  .adminx-tabs button em {
    font-size: 10px;
  }

  .adminx-panel {
    padding: 14px;
    border-radius: 26px;
  }

  .adminx-panel-head-row {
    display: grid;
  }

  .adminx-panel h2 {
    font-size: 23px;
  }

  .adminx-staff-actions {
    grid-template-columns: 1fr 1fr;
  }

  .adminx-table-toolbar {
    display: grid;
    align-content: center;
    padding: 10px;
  }
}
/* ===== VTDD ADMIN V3 - Permission tab & TinyMCE ===== */
.adminx-permission-page { display: grid; gap: 14px; }
.adminx-permission-alert {
  padding: 13px 14px;
  border-radius: 18px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 900;
}
.adminx-permission-list-v3 { display: grid; gap: 12px; }
.adminx-permission-card-v3 {
  padding: 16px;
  border-radius: 24px;
  display: grid;
  grid-template-columns: minmax(260px, .85fr) minmax(420px, 1.15fr);
  gap: 14px;
  background: #ffffff;
  border: 1px solid #dbe4ef;
  box-shadow: 0 14px 34px rgba(15,23,42,.055);
}
.adminx-permission-user-v3 { display: grid; align-content: start; gap: 8px; }
.adminx-permission-user-v3 h3 { color: #07111f; font-size: 20px; line-height: 1.1; font-weight: 1000; letter-spacing: -.035em; }
.adminx-permission-user-v3 p { color: #64748b; font-size: 13px; line-height: 1.45; font-weight: 850; }
.adminx-permission-box-v2 button:disabled { opacity: .52; cursor: not-allowed; }
.adminx-role-pills button:disabled,
.adminx-module-buttons button:disabled { opacity: .55; cursor: not-allowed; }
.cms-rich-box-tiny { display: grid; gap: 8px; }
.cms-rich-box-tiny .tox-tinymce { border-radius: 18px !important; border-color: #cbd5e1 !important; overflow: hidden; }
.cms-rich-box-tiny .tox .tox-statusbar { background: #f8fafc; }
.cms-rich-box-tiny .tox .tox-promotion { display: none !important; }
.cms-preview-body img,
.cms-pro-editor-card img {
  max-width: 100%;
  height: auto;
  border-radius: 18px;
  display: block;
  margin: 12px 0;
}
.cms-preview-body figure,
.cms-pro-editor-card figure {
  max-width: 100%;
  margin: 14px 0;
}
.cms-preview-body figcaption,
.cms-pro-editor-card figcaption {
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
}
@media (max-width: 980px) { .adminx-permission-card-v3 { grid-template-columns: 1fr; } }


/* ===== VTDD ADMIN - TinyMCE cho thông báo quan trọng ===== */
.adminx-form-field {
  display: grid;
  gap: 7px;
}

.adminx-form-field > span {
  color: #64748b;
  font-size: 10px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-form-wide {
  grid-column: 1 / -1;
}

.adminx-notice-rich-field .tox-tinymce {
  border-radius: 18px !important;
  border-color: #cbd5e1 !important;
  overflow: hidden !important;
}

.adminx-notice-rich-field .tox .tox-statusbar {
  background: #f8fafc !important;
}

.adminx-notice-rich-field .tox .tox-promotion {
  display: none !important;
}

.adminx-field-hint {
  display: block;
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.35;
  font-weight: 800;
}

`;

const ADMINX_ONLINE_STYLE = `
.adminx-online-panel {
  margin-top: 14px;
  padding: 16px;
  border-radius: 26px;
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 212, 0, .18), transparent 38%),
    linear-gradient(135deg, #ffffff, #f8fafc);
  border: 1px solid #e2e8f0;
  box-shadow: 0 16px 40px rgba(15, 23, 42, .06);
}

.adminx-online-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.adminx-online-head span {
  width: fit-content;
  display: inline-flex;
  padding: 7px 10px;
  border-radius: 999px;
  background: #0f172a;
  color: #ffd400;
  font-size: 9.5px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-online-head h3 {
  margin-top: 10px;
  color: #0f172a;
  font-size: 44px;
  line-height: .9;
  font-weight: 900;
  letter-spacing: -.07em;
}

.adminx-online-head p {
  margin-top: 7px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
  font-weight: 750;
}

.adminx-online-head button {
  flex: 0 0 auto;
  min-height: 40px;
  padding: 0 13px;
  border: 0;
  border-radius: 999px;
  background: #ffd400;
  color: #111827;
  font-size: 10.5px;
  font-weight: 900;
  letter-spacing: .04em;
  text-transform: uppercase;
}

.adminx-online-head button:disabled {
  opacity: .65;
  cursor: wait;
}

.adminx-online-grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.adminx-online-grid div {
  min-height: 84px;
  padding: 13px;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .7);
}

.adminx-online-grid span {
  display: block;
  color: #64748b;
  font-size: 10px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-online-grid b {
  display: block;
  margin-top: 10px;
  color: #0f172a;
  font-size: 30px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: -.06em;
}

@media screen and (max-width: 560px) {
  .adminx-online-head {
    display: grid;
  }

  .adminx-online-grid {
    grid-template-columns: 1fr;
  }
}
/* ===== VTDD ADMIN V3 - Permission tab & TinyMCE ===== */
.adminx-permission-page { display: grid; gap: 14px; }
.adminx-permission-alert {
  padding: 13px 14px;
  border-radius: 18px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 900;
}
.adminx-permission-list-v3 { display: grid; gap: 12px; }
.adminx-permission-card-v3 {
  padding: 16px;
  border-radius: 24px;
  display: grid;
  grid-template-columns: minmax(260px, .85fr) minmax(420px, 1.15fr);
  gap: 14px;
  background: #ffffff;
  border: 1px solid #dbe4ef;
  box-shadow: 0 14px 34px rgba(15,23,42,.055);
}
.adminx-permission-user-v3 { display: grid; align-content: start; gap: 8px; }
.adminx-permission-user-v3 h3 { color: #07111f; font-size: 20px; line-height: 1.1; font-weight: 1000; letter-spacing: -.035em; }
.adminx-permission-user-v3 p { color: #64748b; font-size: 13px; line-height: 1.45; font-weight: 850; }
.adminx-permission-box-v2 button:disabled { opacity: .52; cursor: not-allowed; }
.adminx-role-pills button:disabled,
.adminx-module-buttons button:disabled { opacity: .55; cursor: not-allowed; }
.cms-rich-box-tiny { display: grid; gap: 8px; }
.cms-rich-box-tiny .tox-tinymce { border-radius: 18px !important; border-color: #cbd5e1 !important; overflow: hidden; }
.cms-rich-box-tiny .tox .tox-statusbar { background: #f8fafc; }
.cms-rich-box-tiny .tox .tox-promotion { display: none !important; }
.cms-preview-body img,
.cms-pro-editor-card img {
  max-width: 100%;
  height: auto;
  border-radius: 18px;
  display: block;
  margin: 12px 0;
}
.cms-preview-body figure,
.cms-pro-editor-card figure {
  max-width: 100%;
  margin: 14px 0;
}
.cms-preview-body figcaption,
.cms-pro-editor-card figcaption {
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
}
@media (max-width: 980px) { .adminx-permission-card-v3 { grid-template-columns: 1fr; } }

`;



function StaffAdminAccessBox({
  item,
  disabled,
  onSave,
}: {
  item: AdminStaff;
  disabled: boolean;
  onSave: (maNV: string, permission: string, modules: string) => Promise<void>;
}) {
  const [permission, setPermission] = useState(item.permission || "");
  const [modules, setModules] = useState<string[]>(
    String(item.modulePermissions || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  );

  useEffect(() => {
    setPermission(item.permission || "");
    setModules(String(item.modulePermissions || "").split(",").map((v) => v.trim()).filter(Boolean));
  }, [item.permission, item.modulePermissions, item.maNV]);

  function setRole(next: "" | "mod" | "admin") {
    setPermission(next);
    if (next !== "mod") setModules([]);
  }

  function toggleModule(key: string) {
    setModules((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  return (
    <div className="adminx-permission-box adminx-permission-box-v2">
      <div className="adminx-permission-head adminx-permission-head-v2">
        <div>
          <b>Phân quyền tài khoản</b>
          <small>Trống = user thường · Mod = theo hạng mục · Admin = toàn quyền</small>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSave(item.maNV, permission, modules.join(","))}
        >
          {disabled ? "Đang lưu..." : "Lưu phân quyền"}
        </button>
      </div>

      <div className="adminx-role-pills">
        <button type="button" disabled={disabled} className={permission === "" ? "active" : ""} onClick={() => setRole("")}>User thường<small>Không có quyền admin</small></button>
        <button type="button" disabled={disabled} className={permission === "mod" ? "active" : ""} onClick={() => setRole("mod")}>Mod<small>Chỉ hạng mục được cấp</small></button>
        <button type="button" disabled={disabled} className={permission === "admin" ? "active" : ""} onClick={() => setRole("admin")}>Admin<small>Toàn quyền hệ thống</small></button>
      </div>

      {permission === "mod" && (
        <div className="adminx-module-buttons">
          {ADMIN_MODULE_OPTIONS.map((module) => (
            <button
              key={module.key}
              type="button"
              disabled={disabled}
              className={modules.includes(module.key) ? "active" : ""}
              onClick={() => toggleModule(module.key)}
            >
              <span>{module.label}</span>
              <small>{module.key}</small>
            </button>
          ))}
        </div>
      )}
      {permission === "admin" && <em>Admin có toàn quyền, không cần chọn hạng mục.</em>}
      {permission === "" && <em>User thường không được truy cập trang quản trị.</em>}
    </div>
  );
}
type CmsSlug = "quy-trinh-thu-cu" | "may-moi" | "may-cu" | "demo";
type AdminModuleKey = "tcdm" | CmsSlug | "tools";

type CmsItem = {
  slug: CmsSlug;
  label: string;
  title: string;
  summary: string;
  body: string;
  draftTitle: string;
  draftSummary: string;
  draftBody: string;
  published: boolean;
  updatedAt: string;
};

type CmsItems = Record<CmsSlug, CmsItem>;

const ADMIN_MODULES: Array<{
  key: AdminModuleKey;
  no: string;
  title: string;
  desc: string;
  badge: string;
}> = [
  {
    key: "tcdm",
    no: "01",
    title: "Quản trị: Trang tra giá TCDM",
    desc: "Tài khoản nhân viên, thông báo, lock web, dashboard và reload data.",
    badge: "Đang hoạt động",
  },
  {
    key: "quy-trinh-thu-cu",
    no: "1.2",
    title: "Quy trình thu cũ đổi mới",
    desc: "Soạn nội dung quy trình thao tác, kiểm tra và xử lý hồ sơ.",
    badge: "CMS nháp / xuất bản",
  },
  {
    key: "may-moi",
    no: "02",
    title: "Quản trị: Trang máy mới",
    desc: "Soạn chính sách bảo hành theo kiểu CMS / Google Site.",
    badge: "CMS nháp / xuất bản",
  },
  {
    key: "may-cu",
    no: "03",
    title: "Quản trị: Trang máy cũ",
    desc: "Soạn nội dung máy ĐSD, máy cũ thu mua và nghiệp vụ liên quan.",
    badge: "CMS nháp / xuất bản",
  },
  {
    key: "demo",
    no: "04",
    title: "Quản trị: Trang demo / gỡ demo",
    desc: "Soạn nội dung hướng dẫn gỡ demo, chuyển đổi máy trưng bày.",
    badge: "CMS nháp / xuất bản",
  },
  {
    key: "tools",
    no: "05",
    title: "Quản trị: Công cụ hỗ trợ",
    desc: "Khu vực công cụ mở rộng, hiện giữ trạng thái đang cập nhật.",
    badge: "Đang cập nhật",
  },
];

const EMPTY_CMS: CmsItems = {
  "quy-trinh-thu-cu": {
    slug: "quy-trinh-thu-cu",
    label: "Quy trình thu cũ đổi mới",
    title: "Quy trình thu cũ đổi mới",
    summary: "Tài liệu quy trình thao tác, kiểm tra và xử lý hồ sơ.",
    body: "",
    draftTitle: "Quy trình thu cũ đổi mới",
    draftSummary: "Tài liệu quy trình thao tác, kiểm tra và xử lý hồ sơ.",
    draftBody: "",
    published: false,
    updatedAt: "",
  },
  "may-moi": {
    slug: "may-moi",
    label: "Trang máy mới",
    title: "Chính sách bảo hành",
    summary: "Thông tin chính sách bảo hành theo ngành hàng.",
    body: "",
    draftTitle: "Chính sách bảo hành",
    draftSummary: "Thông tin chính sách bảo hành theo ngành hàng.",
    draftBody: "",
    published: false,
    updatedAt: "",
  },
  "may-cu": {
    slug: "may-cu",
    label: "Trang máy cũ",
    title: "Máy ĐSD, Máy Cũ Thu Mua",
    summary: "Thông tin nghiệp vụ dành cho máy đã sử dụng / máy cũ thu mua.",
    body: "",
    draftTitle: "Máy ĐSD, Máy Cũ Thu Mua",
    draftSummary: "Thông tin nghiệp vụ dành cho máy đã sử dụng / máy cũ thu mua.",
    draftBody: "",
    published: false,
    updatedAt: "",
  },
  demo: {
    slug: "demo",
    label: "Trang demo",
    title: "Gỡ Demo",
    summary: "Hướng dẫn và công cụ hỗ trợ xử lý gỡ demo.",
    body: "",
    draftTitle: "Gỡ Demo",
    draftSummary: "Hướng dẫn và công cụ hỗ trợ xử lý gỡ demo.",
    draftBody: "",
    published: false,
    updatedAt: "",
  },
};

function isCmsModule(key: AdminModuleKey): key is CmsSlug {
  return key === "quy-trinh-thu-cu" || key === "may-moi" || key === "may-cu" || key === "demo";
}

function parseModuleList(value: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function legacyTextToHtml(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("<") && raw.includes(">")) return raw;
  return raw
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");
}

function CmsEditor({
  slug,
  item,
  onSaved,
  showToast,
}: {
  slug: CmsSlug;
  item: CmsItem;
  onSaved: () => Promise<void>;
  showToast: (type: "success" | "error", text: string) => void;
}) {
  const [title, setTitle] = useState(item.draftTitle || item.title || "");
  const [summary, setSummary] = useState(item.draftSummary || item.summary || "");
  const [body, setBody] = useState(legacyTextToHtml(item.draftBody || item.body || ""));
  const [busy, setBusy] = useState("");
  const editorRef = useRef<any>(null);

  useEffect(() => {
    setTitle(item.draftTitle || item.title || "");
    setSummary(item.draftSummary || item.summary || "");
    const nextBody = legacyTextToHtml(item.draftBody || item.body || "");
    setBody(nextBody);
  }, [item.slug, item.draftTitle, item.draftSummary, item.draftBody, item.title, item.summary, item.body]);


  async function post(action: "SAVE_DRAFT" | "PUBLISH" | "UNPUBLISH") {
    try {
      setBusy(action);

      let finalBody = body;
      const editor = editorRef.current;

      if (editor && action !== "UNPUBLISH") {
        await editor.uploadImages();
        finalBody = editor.getContent();
        setBody(finalBody);
      }

      if (action !== "UNPUBLISH" && /src=["']blob:/i.test(finalBody)) {
        throw new Error("Ảnh chưa upload xong. Vui lòng chờ vài giây rồi bấm lưu/xuất bản lại.");
      }

      async function sendCms(nextAction: "SAVE_DRAFT" | "PUBLISH" | "UNPUBLISH") {
        const res = await fetch("/api/admin/home-cms", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          cache: "no-store",
          body: JSON.stringify({ action: nextAction, slug, title, summary, body: finalBody }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || "Không lưu được nội dung.");
        }

        return data;
      }

      let data: any;

      if (action === "PUBLISH") {
        await sendCms("SAVE_DRAFT");
        data = await sendCms("PUBLISH");
      } else {
        data = await sendCms(action);
      }

      showToast("success", data.message || "Đã lưu.");
      await onSaved();
      setBusy("");
    } catch (err: any) {
      setBusy("");
      showToast("error", err?.message || "Không lưu được nội dung.");
    }
  }

  return (
    <section className="cms-pro-editor-card">
      <div className="cms-pro-editor-top">
        <div>
          <span className="adminx-eyebrow">Nội dung CMS</span>
          <h2>{item.label}</h2>
          <p>Soạn nội dung dạng bản nháp. Khi bấm xuất bản, trang chủ sẽ mở trang nội dung này.</p>
        </div>
        <div className={item.published ? "cms-status published" : "cms-status draft"}>
          {item.published ? "Đang xuất bản" : "Đang cập nhật"}
        </div>
      </div>

      <div className="cms-pro-editor-grid">
        <section className="cms-pro-fields">
          <label>
            <span>Tiêu đề hiển thị</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nhập tiêu đề" />
          </label>

          <label>
            <span>Mô tả ngắn trên trang chủ</span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Nhập mô tả ngắn"
              rows={3}
            />
          </label>

          <div className="cms-rich-box cms-rich-box-tiny">
            <div className="cms-rich-label">Nội dung chi tiết</div>
            <Editor
              tinymceScriptSrc="/tinymce/tinymce.min.js"
              licenseKey="gpl"
              value={body}
              onInit={(_evt, editor) => {
                editorRef.current = editor;
              }}
              onEditorChange={(value) => setBody(value)}
              init={{
                height: 520,
                menubar: "file edit view insert format tools table help",
                branding: true,
                promotion: false,
                automatic_uploads: true,
                paste_data_images: true,
                images_reuse_filename: false,
                image_title: true,
                image_caption: true,
                object_resizing: true,
                convert_urls: false,
                relative_urls: false,
                remove_script_host: false,
                file_picker_types: "image media file",
                images_upload_handler: async (blobInfo, progress) => {
                  const formData = new FormData();
                  formData.append("file", blobInfo.blob(), blobInfo.filename());
                  formData.append("slug", slug);

                  const res = await fetch("/api/admin/cms-upload", {
                    method: "POST",
                    body: formData,
                    cache: "no-store",
                  });

                  const data = await res.json().catch(() => null);

                  if (!res.ok || !data?.success || !data?.location) {
                    throw new Error(data?.message || "Upload ảnh thất bại.");
                  }

                  if (typeof progress === "function") progress(100);
                  return data.location;
                },
                file_picker_callback: (callback, value, meta) => {
                  if (meta.filetype !== "image") return;

                  const input = document.createElement("input");
                  input.setAttribute("type", "file");
                  input.setAttribute("accept", "image/png,image/jpeg,image/webp,image/gif");

                  input.addEventListener("change", async () => {
                    const file = input.files?.[0];
                    if (!file) return;

                    const formData = new FormData();
                    formData.append("file", file, file.name);
                    formData.append("slug", slug);

                    const res = await fetch("/api/admin/cms-upload", {
                      method: "POST",
                      body: formData,
                      cache: "no-store",
                    });

                    const data = await res.json().catch(() => null);

                    if (!res.ok || !data?.success || !data?.location) {
                      showToast("error", data?.message || "Upload ảnh thất bại.");
                      return;
                    }

                    callback(data.location, { title: file.name, alt: file.name });
                  });

                  input.click();
                },
                plugins: [
                  "advlist",
                  "autolink",
                  "lists",
                  "link",
                  "image",
                  "charmap",
                  "preview",
                  "anchor",
                  "searchreplace",
                  "visualblocks",
                  "code",
                  "fullscreen",
                  "insertdatetime",
                  "media",
                  "table",
                  "help",
                  "wordcount",
                ],
                toolbar:
                  "undo redo | blocks | bold italic underline forecolor backcolor | " +
                  "alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | " +
                  "link image media table | removeformat | code preview fullscreen | help",
                content_style:
                  "body{font-family:Roboto,Arial,sans-serif;font-size:15px;line-height:1.65;color:#07111f;padding:12px;} img{max-width:100%;height:auto;border-radius:18px;} h2{font-size:28px;} h3{font-size:22px;} blockquote{border-left:5px solid #ffd400;background:#fffbeb;border-radius:14px;margin:12px 0;padding:12px 16px;}",
              }}
            />
            <small className="cms-editor-note-vtdd">TinyMCE WYSIWYG Editor · Có nhãn Powered by Tiny theo bản miễn phí.</small>
          </div>
        </section>

        <aside className="cms-pro-preview">
          <div className="cms-preview-toolbar">
            <span>Bản xem trước</span>
            <b>{item.updatedAt || "Chưa cập nhật"}</b>
          </div>
          <article>
            <h3>{title || "Chưa có tiêu đề"}</h3>
            <p>{summary || "Chưa có mô tả."}</p>
            <div className="cms-preview-body" dangerouslySetInnerHTML={{ __html: body || "<p>Nội dung đang cập nhật.</p>" }} />
          </article>
        </aside>
      </div>

      <div className="cms-actions">
        <button type="button" onClick={() => post("SAVE_DRAFT")} disabled={!!busy}>
          {busy === "SAVE_DRAFT" ? "Đang lưu..." : "Lưu bản nháp"}
        </button>
        <button type="button" className="publish" onClick={() => post("PUBLISH")} disabled={!!busy}>
          {busy === "PUBLISH" ? "Đang xuất bản..." : "Xuất bản"}
        </button>
        <button type="button" className="unpublish" onClick={() => post("UNPUBLISH")} disabled={!!busy}>
          {busy === "UNPUBLISH" ? "Đang tắt..." : "Ngừng xuất bản"}
        </button>
      </div>
    </section>
  );
}

function NoAccessPanel({ moduleTitle }: { moduleTitle: string }) {
  return (
    <section className="admin-cms-no-access-panel">
      <div>
        <b>Không có quyền truy cập</b>
        <p>Tài khoản của bạn đang là Mod nhưng chưa được Admin cấp quyền cho hạng mục này.</p>
        <small>{moduleTitle}</small>
      </div>
    </section>
  );
}

export default function AdminConsole({
  initialSettings,
  adminRole = "admin",
  adminName = "Admin",
  adminModules = "",
}: AdminConsoleProps) {
  const [module, setModule] = useState<AdminModuleKey>("tcdm");
  const [cmsItems, setCmsItems] = useState<CmsItems>(EMPTY_CMS);
  const [cmsLoading, setCmsLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const isAdmin = adminRole === "admin";
  const allowedModules = useMemo(() => parseModuleList(adminModules), [adminModules]);

  function canAccess(key: AdminModuleKey) {
    if (isAdmin) return true;
    return allowedModules.includes(key);
  }

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 2800);
  }

  async function loadCms() {
    try {
      setCmsLoading(true);
      const res = await fetch("/api/admin/home-cms", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "Không tải được CMS.");
      setCmsItems({ ...EMPTY_CMS, ...(data.items || {}) });
      setCmsLoading(false);
    } catch (err: any) {
      setCmsLoading(false);
      showToast("error", err?.message || "Không tải được CMS.");
    }
  }

  useEffect(() => {
    if (!isCmsModule(module)) return;
    loadCms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  const activeMeta = ADMIN_MODULES.find((item) => item.key === module) || ADMIN_MODULES[0];
  const activeAccess = canAccess(module);

  return (
    <section className="admin-cms-shell-v5">
      <style>{ADMIN_CMS_STYLE}</style>

      <div className="admin-cms-headline-v5">
        <div>
          <span>CMS DASHBOARD</span>
          <h2>Quản trị theo hạng mục ngành hàng</h2>
          <p>Tài khoản hiện tại: <b>{adminName}</b> · Quyền: <b>{adminRole.toUpperCase()}</b></p>
        </div>
        <div className="admin-cms-permission-summary">
          {isAdmin ? "Toàn quyền hệ thống" : allowedModules.length ? `Được cấp: ${allowedModules.join(", ")}` : "Chưa được cấp hạng mục"}
        </div>
      </div>

      <nav className="admin-cms-module-grid-v5">
        {ADMIN_MODULES.map((item) => {
          const allowed = canAccess(item.key);
          return (
            <button
              key={item.key}
              type="button"
              className={`${module === item.key ? "active" : ""} ${!allowed ? "noAccess" : ""}`}
              onClick={() => setModule(item.key)}
            >
              <i>{item.no}</i>
              <span>
                <b>{item.title}</b>
                <em>{item.desc}</em>
              </span>
              <small>{allowed ? item.badge : "Không có quyền"}</small>
            </button>
          );
        })}
      </nav>

      <section className="admin-cms-module-panel-v5">
        {!activeAccess ? (
          <NoAccessPanel moduleTitle={activeMeta.title} />
        ) : module === "tcdm" ? (
          <>
            <div className="admin-cms-module-title-v5">
              <span>01</span>
              <div>
                <h3>Quản trị: Trang tra giá TCDM</h3>
                <p>Toàn bộ chức năng admin cũ được gom vào module này.</p>
              </div>
            </div>
            <TcdmAdminConsole initialSettings={initialSettings} adminRole={adminRole} adminName={adminName} adminModules={adminModules} />
          </>
        ) : isCmsModule(module) ? (
          cmsLoading ? (
            <div className="cms-loading">Đang tải CMS...</div>
          ) : (
            <CmsEditor
              slug={module}
              item={cmsItems[module] || EMPTY_CMS[module]}
              onSaved={loadCms}
              showToast={showToast}
            />
          )
        ) : (
          <div className="admin-cms-empty-tools">
            <span>05</span>
            <h3>Quản trị: Công cụ hỗ trợ</h3>
            <p>Khu vực này đang giữ nguyên trạng thái đang cập nhật. Chưa thao tác gì ở giai đoạn này.</p>
          </div>
        )}
      </section>

      {toast && <div className={`adminx-toast ${toast.type}`}>{toast.text}</div>}
    </section>
  );
}

const ADMIN_CMS_STYLE = `
.admin-cms-shell-v5 { display: grid; gap: 14px; }
.admin-cms-headline-v5 {
  padding: clamp(18px, 2vw, 28px);
  border-radius: 30px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  background: rgba(255,255,255,.9);
  border: 1px solid rgba(203,213,225,.92);
  box-shadow: 0 20px 70px rgba(15,23,42,.08);
}
.admin-cms-headline-v5 span,
.admin-cms-module-title-v5 span,
.cms-pro-editor-top .adminx-eyebrow {
  color: #b45309;
  font-size: 11px;
  font-weight: 1000;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.admin-cms-headline-v5 h2 {
  margin: 8px 0 0;
  color: #07111f;
  font-size: clamp(30px, 3vw, 48px);
  line-height: .98;
  font-weight: 1000;
  letter-spacing: -.06em;
}
.admin-cms-headline-v5 p { margin: 10px 0 0; color: #64748b; font-size: 13px; font-weight: 850; }
.admin-cms-permission-summary {
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  color: #047857;
  font-size: 12px;
  font-weight: 1000;
}
.admin-cms-module-grid-v5 {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}
.admin-cms-module-grid-v5 button {
  min-height: 150px;
  padding: 18px;
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  border: 1px solid rgba(203,213,225,.95);
  background: rgba(255,255,255,.88);
  color: #07111f;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 18px 55px rgba(15,23,42,.06);
}
.admin-cms-module-grid-v5 button.active {
  background: radial-gradient(circle at 100% 0%, rgba(255,212,0,.28), transparent 45%), #07111f;
  color: #fff;
  border-color: #ffd400;
}
.admin-cms-module-grid-v5 button.noAccess {
  opacity: .52;
  filter: grayscale(.18);
}
.admin-cms-module-grid-v5 button.noAccess.active {
  opacity: .82;
  background: #f8fafc;
  color: #94a3b8;
  border-color: #cbd5e1;
}
.admin-cms-module-grid-v5 i,
.admin-cms-module-title-v5 > span,
.admin-cms-empty-tools span {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: #020617;
  color: #ffd400;
  font-style: normal;
  font-size: 13px;
  font-weight: 1000;
}
.admin-cms-module-grid-v5 button.active i { background: #ffd400; color: #07111f; }
.admin-cms-module-grid-v5 b { display: block; color: inherit; font-size: 14px; line-height: 1.2; font-weight: 1000; }
.admin-cms-module-grid-v5 em { display: block; margin-top: 8px; color: #64748b; font-size: 11px; line-height: 1.35; font-style: normal; font-weight: 800; }
.admin-cms-module-grid-v5 button.active em { color: rgba(255,255,255,.72); }
.admin-cms-module-grid-v5 small {
  margin-top: auto;
  padding: 8px 10px;
  border-radius: 999px;
  background: #fff7cc;
  color: #92400e;
  font-size: 10px;
  font-weight: 1000;
  text-transform: uppercase;
}
.admin-cms-module-panel-v5 {
  padding: clamp(16px, 2vw, 28px);
  border-radius: 30px;
  background: rgba(255,255,255,.92);
  border: 1px solid rgba(203,213,225,.92);
  box-shadow: 0 22px 80px rgba(15,23,42,.08);
}
.admin-cms-module-title-v5 { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: start; margin-bottom: 16px; }
.admin-cms-module-title-v5 h3,
.cms-pro-editor-top h2,
.admin-cms-empty-tools h3 { margin: 0; color: #07111f; font-size: clamp(26px, 2.7vw, 44px); line-height: .98; font-weight: 1000; letter-spacing: -.06em; }
.admin-cms-module-title-v5 p,
.cms-pro-editor-top p,
.admin-cms-empty-tools p { margin: 8px 0 0; color: #64748b; font-size: 13px; line-height: 1.45; font-weight: 850; }
.admin-cms-no-access-panel {
  min-height: 320px;
  border-radius: 26px;
  display: grid;
  place-items: center;
  background: repeating-linear-gradient(135deg, #f8fafc, #f8fafc 12px, #f1f5f9 12px, #f1f5f9 24px);
  border: 1px dashed #cbd5e1;
  text-align: center;
}
.admin-cms-no-access-panel b { display: block; color: #b45309; font-size: 26px; font-weight: 1000; }
.admin-cms-no-access-panel p { max-width: 460px; margin: 10px auto; color: #64748b; font-size: 14px; font-weight: 850; }
.admin-cms-no-access-panel small { display: inline-flex; margin-top: 8px; padding: 8px 12px; border-radius: 999px; background: #fff7cc; color: #92400e; font-weight: 1000; }
.cms-pro-editor-card { display: grid; gap: 16px; }
.cms-pro-editor-top { display: flex; justify-content: space-between; gap: 16px; align-items: start; }
.cms-status { min-height: 42px; padding: 0 15px; border-radius: 999px; display: inline-flex; align-items: center; font-size: 12px; font-weight: 1000; }
.cms-status.published { background: #ecfdf5; border: 1px solid #bbf7d0; color: #047857; }
.cms-status.draft { background: #fff7cc; border: 1px solid #fde68a; color: #92400e; }
.cms-pro-editor-grid { display: grid; grid-template-columns: minmax(420px, 1.05fr) minmax(360px, .95fr); gap: 14px; align-items: stretch; }
.cms-pro-fields,
.cms-pro-preview { padding: 18px; border-radius: 24px; background: #fff; border: 1px solid #dbe4ef; }
.cms-pro-fields { display: grid; gap: 14px; }
.cms-pro-fields label { display: grid; gap: 7px; }
.cms-pro-fields label span,
.cms-rich-label { color: #64748b; font-size: 11px; font-weight: 1000; letter-spacing: .08em; text-transform: uppercase; }
.cms-pro-fields input,
.cms-pro-fields textarea { width: 100%; border: 1px solid #cbd5e1; border-radius: 16px; background: #f8fafc; color: #07111f; padding: 13px 14px; font-size: 14px; font-weight: 850; outline: none; resize: vertical; }
.cms-pro-fields input:focus,
.cms-pro-fields textarea:focus { background: #fff; border-color: #ffd400; box-shadow: 0 0 0 4px rgba(255,212,0,.18); }
.cms-rich-box { display: grid; gap: 8px; }
.cms-toolbar { min-height: 48px; padding: 8px; border-radius: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 7px; background: #f1f5f9; border: 1px solid #dbe4ef; }
.cms-toolbar button,
.cms-toolbar select,
.cms-toolbar input[type=color] { min-height: 34px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; color: #07111f; padding: 0 10px; font-size: 12px; font-weight: 900; cursor: pointer; }
.cms-toolbar input[type=color] { width: 44px; padding: 3px; }
.cms-rich-editor { min-height: 380px; padding: 18px; border-radius: 18px; border: 1px solid #cbd5e1; background: #fff; color: #07111f; outline: none; font-size: 15px; line-height: 1.65; font-weight: 700; overflow: auto; }
.cms-rich-editor:focus { border-color: #ffd400; box-shadow: 0 0 0 4px rgba(255,212,0,.16); }
.cms-rich-editor h2,
.cms-preview-body h2 { font-size: 28px; line-height: 1.15; margin: 18px 0 8px; }
.cms-rich-editor h3,
.cms-preview-body h3 { font-size: 22px; line-height: 1.2; margin: 14px 0 8px; }
.cms-rich-editor blockquote,
.cms-preview-body blockquote { margin: 12px 0; padding: 12px 16px; border-left: 5px solid #ffd400; background: #fffbeb; border-radius: 14px; }
.cms-pro-preview { min-height: 100%; display: grid; align-content: start; }
.cms-preview-toolbar { display: flex; justify-content: space-between; gap: 12px; color: #64748b; font-size: 12px; font-weight: 900; margin-bottom: 14px; }
.cms-pro-preview article h3 { margin: 0; color: #07111f; font-size: 30px; line-height: 1.08; font-weight: 1000; letter-spacing: -.04em; }
.cms-pro-preview article > p { margin: 10px 0 18px; color: #475569; font-size: 14px; line-height: 1.5; font-weight: 850; }
.cms-preview-body { color: #07111f; font-size: 15px; line-height: 1.65; font-weight: 700; }
.cms-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
.cms-actions button { min-height: 46px; border: 0; border-radius: 15px; padding: 0 18px; background: #e2e8f0; color: #07111f; font-size: 12px; font-weight: 1000; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; }
.cms-actions button.publish { background: #ffd400; }
.cms-actions button.unpublish { background: #07111f; color: #fff; }
.cms-actions button:disabled { opacity: .55; cursor: not-allowed; }
.admin-cms-empty-tools { min-height: 300px; display: grid; place-items: center; text-align: center; }
.cms-loading { min-height: 260px; display: grid; place-items: center; color: #64748b; font-weight: 1000; }
.adminx-permission-box { margin-top: 12px; padding: 12px; border-radius: 16px; background: #f8fafc; border: 1px solid #dbe4ef; display: grid; gap: 10px; }
.adminx-permission-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
.adminx-permission-head b { color: #07111f; font-size: 12px; font-weight: 1000; }
.adminx-permission-head button { min-height: 34px; border: 0; border-radius: 11px; padding: 0 12px; background: #ffd400; color: #07111f; font-size: 11px; font-weight: 1000; cursor: pointer; }
.adminx-permission-box select { min-height: 40px; border: 1px solid #cbd5e1; border-radius: 13px; background: #fff; padding: 0 12px; font-size: 13px; font-weight: 850; }
.adminx-module-checks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.adminx-module-checks label { min-height: 36px; padding: 7px 9px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 8px; color: #334155; font-size: 11px; font-weight: 850; }
.adminx-permission-box em { color: #64748b; font-size: 12px; font-style: normal; font-weight: 850; }
@media (max-width: 1280px) { .admin-cms-module-grid-v5 { grid-template-columns: repeat(3, minmax(0, 1fr)); } .cms-pro-editor-grid { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .admin-cms-headline-v5, .cms-pro-editor-top { display: grid; } .admin-cms-module-grid-v5 { grid-template-columns: 1fr; } .admin-cms-module-grid-v5 button { min-height: 132px; } .cms-actions { display: grid; } .cms-actions button { width: 100%; } .adminx-module-checks { grid-template-columns: 1fr; } }

/* ===== VTDD ADMIN FIX PACK ===== */
.adminx-permission-box-v2 { margin-top: 14px; padding: 14px; border-radius: 20px; background: radial-gradient(circle at 100% 0%, rgba(255,212,0,.12), transparent 38%), #ffffff; border: 1px solid #dbe4ef; box-shadow: 0 12px 28px rgba(15,23,42,.045); }
.adminx-permission-head-v2 { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; }
.adminx-permission-head-v2 small { display: block; margin-top: 4px; color: #64748b; font-size: 11px; line-height: 1.35; font-weight: 850; }
.adminx-role-pills { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
.adminx-role-pills button, .adminx-module-buttons button { min-height: 64px; padding: 11px; border-radius: 16px; border: 1px solid #e2e8f0; background: #f8fafc; color: #07111f; text-align: left; font-size: 12px; line-height: 1.15; font-weight: 1000; cursor: pointer; }
.adminx-role-pills button small, .adminx-module-buttons button small { display: block; margin-top: 6px; color: #64748b; font-size: 9.5px; line-height: 1.25; font-weight: 850; }
.adminx-role-pills button.active, .adminx-module-buttons button.active { background: #07111f; border-color: #07111f; color: #ffd400; box-shadow: 0 12px 24px rgba(15,23,42,.16); }
.adminx-role-pills button.active small, .adminx-module-buttons button.active small { color: rgba(255,255,255,.72); }
.adminx-module-buttons { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.adminx-module-buttons button span { display: block; }
.cms-rich-editor-vtdd { min-height: 380px; resize: vertical; font-family: Roboto, Arial, sans-serif; white-space: pre-wrap; }
.cms-editor-note-vtdd { display: block; margin-top: 8px; color: #64748b; font-size: 11px; font-weight: 850; }
@media (max-width: 760px) { .adminx-permission-head-v2 { grid-template-columns: 1fr; } .adminx-role-pills, .adminx-module-buttons { grid-template-columns: 1fr; } }

/* ===== VTDD ADMIN V3 - Permission tab & TinyMCE ===== */
.adminx-permission-page { display: grid; gap: 14px; }
.adminx-permission-alert {
  padding: 13px 14px;
  border-radius: 18px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 900;
}
.adminx-permission-list-v3 { display: grid; gap: 12px; }
.adminx-permission-card-v3 {
  padding: 16px;
  border-radius: 24px;
  display: grid;
  grid-template-columns: minmax(260px, .85fr) minmax(420px, 1.15fr);
  gap: 14px;
  background: #ffffff;
  border: 1px solid #dbe4ef;
  box-shadow: 0 14px 34px rgba(15,23,42,.055);
}
.adminx-permission-user-v3 { display: grid; align-content: start; gap: 8px; }
.adminx-permission-user-v3 h3 { color: #07111f; font-size: 20px; line-height: 1.1; font-weight: 1000; letter-spacing: -.035em; }
.adminx-permission-user-v3 p { color: #64748b; font-size: 13px; line-height: 1.45; font-weight: 850; }
.adminx-permission-box-v2 button:disabled { opacity: .52; cursor: not-allowed; }
.adminx-role-pills button:disabled,
.adminx-module-buttons button:disabled { opacity: .55; cursor: not-allowed; }
.cms-rich-box-tiny { display: grid; gap: 8px; }
.cms-rich-box-tiny .tox-tinymce { border-radius: 18px !important; border-color: #cbd5e1 !important; overflow: hidden; }
.cms-rich-box-tiny .tox .tox-statusbar { background: #f8fafc; }
.cms-rich-box-tiny .tox .tox-promotion { display: none !important; }
.cms-preview-body img,
.cms-pro-editor-card img {
  max-width: 100%;
  height: auto;
  border-radius: 18px;
  display: block;
  margin: 12px 0;
}
.cms-preview-body figure,
.cms-pro-editor-card figure {
  max-width: 100%;
  margin: 14px 0;
}
.cms-preview-body figcaption,
.cms-pro-editor-card figcaption {
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
}
@media (max-width: 980px) { .adminx-permission-card-v3 { grid-template-columns: 1fr; } }

`;
