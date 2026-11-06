"use client";
import { buildStandbyImportPreview, type StandbyImportPreview } from "@/lib/staff-import";

import { useEffect, useRef, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { sanitizeHtml } from "@/lib/html-sanitize";
import PasswordInput from "@/components/PasswordInput";
import DemoAdminTool from "@/components/DemoAdminTool";
import TradeinAdminTool from "@/components/TradeinAdminTool";
import AdminSectionIcon from "@/components/AdminSectionIcon";
import UiNotice from "@/components/UiNotice";
import UiFeedbackDialog from "@/components/UiFeedbackDialog";
import StaffDirectoryPanel from "@/components/StaffDirectoryPanel";
import permissionStyles from "./PermissionDrawer.module.css";
import ImeiAdminTool from "@/components/ImeiAdminTool";
import { clientErrorMessage, requestJson } from "@/lib/client-request";
import { ADMIN_SECTIONS, effectiveAdminAccessTokens, removeAdminActionToken, visibleAdminScreens, type AdminScreen } from "@/lib/admin-navigation";

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

type AdminRole = "admin" | "mod";
type AdminActionKey =
  | "imei-create"
  | "imei-cancel-own"
  | "imei-report"
  | "imei-manage-all"
  | "imei-brand-lock"
  | "staff-manage"
  | "staff-delete"
  | "staff-security"
  | "settings-write"
  | "reload-data";

type AdminConsoleProps = {
  initialSettings: Record<string, string>;
  adminRole?: AdminRole;
  adminName?: string;
  adminCode?: string;
  adminModules?: string;
  adminActions?: string;
  adminHasExplicitActions?: boolean;
};

type TabKey = "staff" | "permission";

type ToastState = {
  type: "success" | "error";
  text: string;
} | null;

type DeleteStaffDialogState = {
  maNV: string;
  staffName: string;
  gmail: string;
} | null;

const EMPTY_SUMMARY: StaffSummary = {
  total: 0,
  active: 0,
  standby: 0,
  needSetup: 0,
};

const DEFAULT_DELETE_STAFF_MAIL_TITLE = "Thông báo tài khoản đã bị xóa";
const DEFAULT_DELETE_STAFF_MAIL_MESSAGE =
  "Tài khoản của bạn đã được Admin xóa khỏi hệ thống. Nếu cần hỗ trợ, vui lòng liên hệ quản trị viên.";

const EMPTY_STANDBY_IMPORT_PREVIEW: StandbyImportPreview = {
  fileName: "",
  rawRows: 0,
  codes: [],
  duplicates: [],
  errors: [],
};

const TAB_ITEMS: Array<{
  key: TabKey;
  label: string;
  desc: string;
  icon: string;
}> = [
  { key: "staff", label: "Nhân viên", desc: "Duyệt & reset", icon: "02" },
  { key: "permission", label: "Phân quyền", desc: "Admin / Mod", icon: "03" },
];

const PEOPLE_TAB_ITEMS = TAB_ITEMS.filter((item) =>
  ["staff", "permission"].includes(item.key)
).map((item, index) => ({ ...item, icon: String(index + 1).padStart(2, "0") }));

const ADMIN_MODULE_OPTIONS = [
  { key: "tcdm", label: "1.1 Tra giá TCDM" },
  { key: "quy-trinh-thu-cu", label: "1.2 Quy trình TCDM" },
  { key: "may-moi", label: "2 Trang máy mới" },
  { key: "may-cu", label: "3 Trang máy cũ" },
  { key: "demo", label: "4 Trang demo" },

  { key: "people", label: "6 Quyền & Nhân sự" },
  { key: "imei", label: "Tạo IMEI / SN — xem lịch sử của mình" },
];

const ADMIN_ACTION_PREFIX = "action:";

const PERSONNEL_ACTION_OPTIONS: Array<{ key: AdminActionKey; label: string; desc: string }> = [
  { key: "staff-manage", label: "Quản lý nhân viên", desc: "Xem danh sách, Active và Standby tài khoản." },
  { key: "staff-delete", label: "Xóa nhân viên", desc: "Xóa tài khoản nhân viên khỏi hệ thống." },
  { key: "staff-security", label: "Reset bảo mật", desc: "Reset OTP, mật khẩu và thiết lập bảo mật." },
];

const TCDM_ACTION_OPTIONS: Array<{ key: AdminActionKey; label: string; desc: string }> = [
  { key: "settings-write", label: "Đóng/mở trang tra giá", desc: "Tạm khóa trang tra giá hiện tại và sửa thông báo cập nhật." },
  { key: "reload-data", label: "Đồng bộ giá Google Sheet", desc: "Cập nhật bảng giá thu cũ đổi mới và thông báo người đang tra cứu." },
];

const ADMIN_ACTION_OPTIONS: Array<{ key: AdminActionKey; label: string; desc: string }> = [
  ...PERSONNEL_ACTION_OPTIONS,
  ...TCDM_ACTION_OPTIONS,
  { key: "imei-create", label: "Tạo mã IMEI / SN", desc: "Cấp IMEI 15 số hoặc SN Apple theo hãng máy mới." },
  { key: "imei-cancel-own", label: "Hủy mã của mình", desc: "Hủy mã của mình trong 2 phút kể từ lúc cấp." },
  { key: "imei-manage-all", label: "Quản lý toàn bộ sổ IMEI", desc: "Xem và hủy IMEI / SN của mọi người, kể cả sau 2 phút." },
  { key: "imei-brand-lock", label: "Khóa tạo IMEI máy cũ theo hãng", desc: "Quyền con của Quản lý toàn bộ sổ IMEI. Cho phép khóa hoặc mở lại từng hãng cho mọi người tạo mã." },
  { key: "imei-report", label: "Tra cứu & xuất Excel", desc: "Xem toàn bộ sổ, lọc và xuất Excel; không cấp quyền hủy mã người khác." },
];

const PERSONNEL_ACTION_KEYS = new Set(PERSONNEL_ACTION_OPTIONS.map((item) => item.key));
const TCDM_ACTION_KEYS = new Set(TCDM_ACTION_OPTIONS.map((item) => item.key));
const IMEI_ACTION_KEYS = new Set<AdminActionKey>(["imei-create", "imei-cancel-own", "imei-manage-all", "imei-report", "imei-brand-lock"]);

const PERMISSION_TREE = [
  {
    title: "Tạo IMEI / SN",
    desc: "Cấp mã, hủy mã và tra lại lịch sử.",
    module: "imei",
    children: ADMIN_ACTION_OPTIONS.filter(item => IMEI_ACTION_KEYS.has(item.key)),
  },

  {
    title: "Quản trị vận hành TCDM",
    desc: "Đồng bộ giá từ Google Sheet và đóng/mở trang tra giá hiện tại.",
    module: "tcdm",
    children: TCDM_ACTION_OPTIONS,
  },
  {
    title: "Quyền & Nhân sự",
    desc: "Module 06 quản lý nhân viên, reset bảo mật và phân quyền.",
    module: "people",
    children: PERSONNEL_ACTION_OPTIONS,
  },
  {
    title: "Nội dung trang chủ",
    desc: "Các trang CMS gắn ngoài trang chủ.",
    children: ADMIN_MODULE_OPTIONS.filter((item) => !["tcdm", "people", "imei"].includes(item.key)).map((item) => ({
      module: item.key,
      label: item.label,
      desc: "Cho phép mở và chỉnh nội dung module này.",
    })),
  },

] as const;

function getErrorMessage(err: any) {
  return clientErrorMessage(err);
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function parseAdminAccessItems(value: any) {
  const moduleKeys = new Set(ADMIN_MODULE_OPTIONS.map((item) => item.key));
  const actionKeys = new Set(
    ADMIN_ACTION_OPTIONS.map((item) => `${ADMIN_ACTION_PREFIX}${item.key}`)
  );

  return effectiveAdminAccessTokens(String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item, index, arr) => {
      const allowed = moduleKeys.has(item) || actionKeys.has(item);
      return allowed && arr.indexOf(item) === index;
    }));
}

function parseAdminActionItems(value: any) {
  const actionKeys = new Set(ADMIN_ACTION_OPTIONS.map((item) => item.key));

  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase().replace(/^action:/, ""))
    .filter((item, index, arr): item is AdminActionKey => {
      return actionKeys.has(item as AdminActionKey) && arr.indexOf(item) === index;
    });
}

function adminActionToken(key: AdminActionKey) {
  return `${ADMIN_ACTION_PREFIX}${key}`;
}

function summarizeAdminAccess(value: any) {
  const tokens = parseAdminAccessItems(value);
  if (tokens.length === 0) return "—";

  return tokens
    .map((token) => {
      const moduleOption = ADMIN_MODULE_OPTIONS.find((item) => item.key === token);
      if (moduleOption) return moduleOption.label;

      const actionKey = token.slice(ADMIN_ACTION_PREFIX.length);
      const action = ADMIN_ACTION_OPTIONS.find((item) => item.key === actionKey);
      return action ? action.label : token;
    })
    .join(" · ");
}

function PersonnelAdminConsole({
  adminRole = "admin",
  adminModules = "",
  adminActions = "",
  adminHasExplicitActions = false,
  adminCode = "",
}: Omit<AdminConsoleProps, "initialSettings">) {
  const [tab, setTab] = useState<TabKey>("staff");

  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<ToastState>(null);

  const [commandInput, setCommandInput] = useState("");

  const [bulkStandbyOpen, setBulkStandbyOpen] = useState(false);
  const [bulkStandbyRoles, setBulkStandbyRoles] = useState({ user: true, mod: false });
  const [bulkStandbyPassword, setBulkStandbyPassword] = useState("");
  const [standbyImportOpen, setStandbyImportOpen] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{tone: "success" | "error" | "info"; text: string} | null>(null);
  const [readingImport, setReadingImport] = useState(false);
  const [standbyImportPreview, setStandbyImportPreview] = useState<StandbyImportPreview>(EMPTY_STANDBY_IMPORT_PREVIEW);
  const [deleteStaffDialog, setDeleteStaffDialog] = useState<DeleteStaffDialogState>(null);
  const [deleteStaffMailEnabled, setDeleteStaffMailEnabled] = useState(true);
  const [deleteStaffMailTitle, setDeleteStaffMailTitle] = useState(DEFAULT_DELETE_STAFF_MAIL_TITLE);
  const [deleteStaffMailMessage, setDeleteStaffMailMessage] = useState(DEFAULT_DELETE_STAFF_MAIL_MESSAGE);

  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [staffMeta, setStaffMeta] = useState<StaffMeta>({
    page: 1,
    pageSize: 50,
    total: 0,
    pages: 1,
    summary: EMPTY_SUMMARY,
  });
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffLoadError, setStaffLoadError] = useState("");
  const [staffSearchInput, setStaffSearchInput] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [staffStatusFilter, setStaffStatusFilter] = useState<"ALL" | "Active" | "Standby">("ALL");
  const [staffRoleFilter, setStaffRoleFilter] = useState("ALL");
  const [staffPage, setStaffPage] = useState(1);
  const staffRequest = useRef(0);

  const summary = staffMeta.summary || EMPTY_SUMMARY;
  const isFullAdmin = String(adminRole || "").toLowerCase() === "admin";
  const grantedModules = parseModuleList(adminModules);
  const grantedActions = parseAdminActionItems(adminActions);

  const legacyPeopleAccess = !adminHasExplicitActions && grantedModules.includes("people");

  function canUseAction(action: AdminActionKey) {
    if (isFullAdmin || grantedActions.includes(action)) return true;

    if (PERSONNEL_ACTION_KEYS.has(action)) {
      return legacyPeopleAccess;
    }
    return false;
  }

  const tabItems = PEOPLE_TAB_ITEMS;
  const visibleTabs = tabItems.filter((item) => {
    if (isFullAdmin) return true;

    if (item.key === "permission") return false;
    if (item.key === "staff") {
      return canUseAction("staff-manage") || canUseAction("staff-security") || canUseAction("staff-delete");
    }
    return false;
  });
  const activeTabAllowed = visibleTabs.some((item) => item.key === tab);
  const firstVisibleTab = visibleTabs[0]?.key || "staff";
  const canManageStaff = canUseAction("staff-manage");
  const canDeleteStaff = canUseAction("staff-delete");
  const canResetStaffSecurity = canUseAction("staff-security");
  const canResetStaffOtp = canResetStaffSecurity || canManageStaff;

  function isStaffAdminLocked(item: AdminStaff) {
    return !isFullAdmin && item.permission === "admin";
  }

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
  }

  async function postJSON(url: string, body: any) {
    return requestJson<any>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      body: JSON.stringify(body),
    });

  }

  async function loadStaff(nextPage = staffPage, options?: { silent?: boolean }) {
    const request = ++staffRequest.current;
    try {
      setStaffLoadError("");
      if (!options?.silent) setStaffLoading(true);

      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: "50",
        status: staffStatusFilter,
        q: staffQuery,
        role: tab === "staff" ? staffRoleFilter : "ALL",
      });

      const res = await fetch(`/api/admin/staff?${params.toString()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
        },
      });

      const data = await res.json().catch(() => null);
      if (request !== staffRequest.current) return;

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
      if (request !== staffRequest.current) return;
      setStaffLoading(false);
      setStaffLoadError(getErrorMessage(err));
    }
  }

  function runCommandSearch() {
    const raw = commandInput.trim();
    const q = raw.toLowerCase();
    if (!q) return;

    const routeMap: Array<{ match: RegExp; tab: TabKey; action?: () => void }> = [
      { match: /(nhan|nhân|staff|nv|active|standby|otp|reset|delete|xoa|xóa|import)/i, tab: "staff" },
      { match: /(quyen|quyền|permission|mod|admin)/i, tab: "permission" },
    ];

    const found = routeMap.find((item) => item.match.test(q));
    if (found && visibleTabs.some((item) => item.key === found.tab)) {
      setTab(found.tab);
      found.action?.();
      showToast("success", `Đã mở nhanh mục phù hợp cho "${raw}".`);
      return;
    }

    showToast("error", "Chưa tìm thấy chức năng phù hợp hoặc tài khoản chưa được cấp quyền.");
  }

  useEffect(() => {
    if (activeTabAllowed) return;
    setTab(firstVisibleTab);
  }, [activeTabAllowed, firstVisibleTab]);

  useEffect(() => {
    if (tab !== "staff" && tab !== "permission") return;
    loadStaff(staffPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, staffStatusFilter, staffQuery, staffPage, staffRoleFilter]);

  async function runStaffAction(
    action: "ACTIVE" | "STANDBY" | "RESET_SECURITY" | "RESET_OTP_COUNT" | "DELETE",
    maNV: string,
    extra?: Record<string, unknown>
  ) {
    try {
      setBusy(`${action}-${maNV}`);

      const data = await postJSON("/api/admin/staff", {
        action,
        maNV,
        ...(extra || {}),
      });

      showToast("success", data.message || "Đã cập nhật.");
      setBusy("");
      await loadStaff(staffPage, { silent: true });
    } catch (err: any) {
      setBusy("");
      showToast("error", getErrorMessage(err));
    }
  }

  function openDeleteStaffDialog(item: AdminStaff) {
    setDeleteStaffDialog({
      maNV: item.maNV,
      staffName: item.staffName || "nhân viên này",
      gmail: item.gmail || "",
    });
    setDeleteStaffMailEnabled(true);
    setDeleteStaffMailTitle(DEFAULT_DELETE_STAFF_MAIL_TITLE);
    setDeleteStaffMailMessage(DEFAULT_DELETE_STAFF_MAIL_MESSAGE);
  }

  async function submitDeleteStaffDialog() {
    const target = deleteStaffDialog;
    if (!target) return;

    const title = deleteStaffMailTitle.trim() || DEFAULT_DELETE_STAFF_MAIL_TITLE;
    const message = deleteStaffMailMessage.trim() || DEFAULT_DELETE_STAFF_MAIL_MESSAGE;

    setDeleteStaffDialog(null);
    await runStaffAction("DELETE", target.maNV, {
      notifyDeleteStaff: deleteStaffMailEnabled,
      deleteMailTitle: title,
      deleteMailMessage: message,
    });
  }

  async function runBulkStandby() {
    const roles = [
      bulkStandbyRoles.user ? "user" : "",
      bulkStandbyRoles.mod ? "mod" : "",
    ].filter(Boolean);

    if (!isFullAdmin) {
      showToast("error", "Chỉ Admin mới được chuyển Standby hàng loạt.");
      return;
    }

    if (roles.length === 0) {
      showToast("error", "Vui lòng chọn ít nhất một cấp bậc áp dụng.");
      return;
    }

    if (!bulkStandbyPassword.trim()) {
      showToast("error", "Vui lòng nhập mật khẩu Admin để xác nhận thao tác Standby hàng loạt.");
      return;
    }

    try {
      setBusy("STANDBY_BULK");

      const data = await postJSON("/api/admin/staff", {
        action: "STANDBY_BULK",
        roles,
        adminPassword: bulkStandbyPassword,
      });

      setBulkStandbyOpen(false);
      setBulkStandbyPassword("");
      showToast("success", data.message || "Đã chuyển Standby hàng loạt.");
      setBusy("");
      if (staffPage === 1) {
        await loadStaff(1, { silent: true });
      } else {
        setStaffPage(1);
      }
    } catch (err: any) {
      setBusy("");
      showToast("error", getErrorMessage(err));
    }
  }

  function closeBulkStandbyDialog() {
    if (busy === "STANDBY_BULK") return;
    setBulkStandbyOpen(false);
    setBulkStandbyPassword("");
  }

  function openStandbyImportDialog() {
    setImportFeedback(null);
    setStandbyImportPreview(EMPTY_STANDBY_IMPORT_PREVIEW);
    setStandbyImportOpen(true);
  }

  function downloadStandbyImportTemplate() {
    const csv = "\uFEFF" + ["Mã nhân viên", "100123", "100456", "100789"].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mau-standby-nhan-vien.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 800);
    showToast("success", "Đã tải file mẫu Standby CSV.");
  }

  async function handleStandbyImportFile(event: any) {
    const file = event?.target?.files?.[0];
    if (!file) {
      setStandbyImportPreview(EMPTY_STANDBY_IMPORT_PREVIEW);
      return;
    }

    try {
      setReadingImport(true); setImportFeedback(null);
      if (file.size > 2_000_000) throw new Error("File vượt quá 2 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const encoding = bytes[0] === 255 && bytes[1] === 254 ? "utf-16le" : bytes[0] === 254 && bytes[1] === 255 ? "utf-16be" : "utf-8";
      const preview = buildStandbyImportPreview(new TextDecoder(encoding).decode(bytes), file.name);
      setStandbyImportPreview(preview);
      setImportFeedback({tone: preview.codes.length ? "info" : "error", text: `Đã đọc ${preview.rawRows} dòng, có ${preview.codes.length} mã hợp lệ. Tên nhân viên (nếu có) chỉ để tham khảo. Chưa thay đổi tài khoản.`});
    } catch (error) {
      const text = error instanceof Error ? error.message : "Không đọc được file.";
      setImportFeedback({tone:"error",text});
      setStandbyImportPreview({
        ...EMPTY_STANDBY_IMPORT_PREVIEW,
        fileName: file.name || "",
        errors: [text],
      });
    } finally { setReadingImport(false); }
  }

  async function runStandbyImport() {
    if (!isFullAdmin) {
      showToast("error", "Chỉ Admin mới được import file Standby nhân viên.");
      return;
    }

    if (standbyImportPreview.codes.length === 0) {
      showToast("error", "File import chưa có mã nhân viên hợp lệ.");
      return;
    }

    if (standbyImportPreview.errors.some((item) => item.includes("5.000"))) {
      showToast("error", "Mỗi lần import tối đa 5.000 mã nhân viên.");
      return;
    }

    try {
      setBusy("STANDBY_IMPORT");

      const data = await postJSON("/api/admin/staff", {
        action: "STANDBY_IMPORT",
        codes: standbyImportPreview.codes,
      });

      setImportFeedback({tone:"success", text: (data.message || "Đã import Standby nhân viên.") + (data.result?.missing?.length ? " Mã không tồn tại: " + data.result.missing.slice(0,30).join(", ") : "")});
      setBusy("");
      if (staffPage === 1) {
        await loadStaff(1, { silent: true });
      } else {
        setStaffPage(1);
      }
    } catch (err: any) {
      setBusy("");
      setImportFeedback({tone:"error",text:getErrorMessage(err) + " Hãy kiểm tra danh sách trước khi thử lại; một số dòng có thể đã được xử lý."});
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

  function applyStaffSearch() {
    setStaffPage(1);
    setStaffQuery(staffSearchInput.trim());
  }

  return (
    <section className="adminx-console">
      {staffLoadError && <UiNotice onRetry={() => void loadStaff()} busy={staffLoading}>{staffLoadError}</UiNotice>}
      {staffLoading && <UiNotice tone="loading">Đang tải danh sách tài khoản…</UiNotice>}
      {busy && <UiNotice tone="loading">Đang xử lý thay đổi. Vui lòng chờ kết quả…</UiNotice>}
      <style suppressHydrationWarning>{ADMINX_STYLE}</style>
      <style suppressHydrationWarning>{ADMINX_PERSONNEL_STYLE}</style>

      <nav className="adminx-tabs" aria-label="Admin navigation">
        {visibleTabs.map((item) => (
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

      <div className="adminx-command-search">
        <input
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runCommandSearch();
          }}
          placeholder="Tìm nhanh: mã nhân viên, Standby, reset bảo mật, phân quyền..."
        />
        <button type="button" onClick={runCommandSearch}>Tìm chức năng</button>
      </div>

      {tab === "staff" && <StaffDirectoryPanel staff={staff} meta={staffMeta} loading={staffLoading} busy={Boolean(busy)} isAdmin={isFullAdmin} actorCode={adminCode}
        canManage={canManageStaff} canDelete={canDeleteStaff} canReset={canResetStaffSecurity} canResetOtp={canResetStaffOtp}
        search={staffSearchInput} onSearchChange={setStaffSearchInput} onSearch={applyStaffSearch} status={staffStatusFilter} onStatusChange={value=>{setStaffPage(1);setStaffStatusFilter(value as "ALL" | "Active" | "Standby");}}
        role={staffRoleFilter} onRoleChange={value=>{setStaffPage(1);setStaffRoleFilter(value);}} onPage={setStaffPage} onReload={()=>loadStaff(staffPage,{silent:true})}
        onAction={(action,code)=>void runStaffAction(action,code)} onDelete={openDeleteStaffDialog} onImportStandby={openStandbyImportDialog} onBulkStandby={()=>setBulkStandbyOpen(true)} />}

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
                <article className={`adminx-permission-card-v3 ${permissionStyles.card}`} key={`permission-${item.maNV}-${item.rowNumber}`}>
                  <div className="adminx-permission-user-v3">
                    <span className={item.status === "Active" ? "adminx-badge active" : "adminx-badge standby"}>
                      {item.status || "Standby"}
                    </span>
                    <h3>{item.staffName || "Chưa có tên"}</h3>
                    <p>NV {item.maNV} · ST {item.maST || "—"} · {item.storeName || "Chưa có siêu thị"}</p>
                    <div className="adminx-staff-flags">
                      {item.permission ? <span>QUYỀN: {item.permission.toUpperCase()}</span> : <span>QUYỀN: USER THƯỜNG</span>}
                      <span title={summarizeAdminAccess(item.modulePermissions)}>PHẠM VI: {summarizeAdminAccess(item.modulePermissions)}</span>
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

      {bulkStandbyOpen && (
        <div className="adminx-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="bulkStandbyTitle">
          <div className="adminx-confirm-card adminx-bulk-standby-card">
            <span>Standby hàng loạt</span>
            <h3 id="bulkStandbyTitle">Chọn cấp bậc áp dụng</h3>
            <p>Chỉ tài khoản quyền Admin mới dùng được. Hệ thống không chuyển Standby tài khoản quyền Admin.</p>

            <section className="adminx-bulk-standby-options" aria-label="Cấp bậc áp dụng">
              <label>
                <input
                  type="checkbox"
                  checked={bulkStandbyRoles.user}
                  onChange={(e) => setBulkStandbyRoles((prev) => ({ ...prev, user: e.target.checked }))}
                />
                <span>
                  <b>Nhân viên</b>
                  <small>Tài khoản user thường, không có quyền Admin/Mod.</small>
                </span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={bulkStandbyRoles.mod}
                  onChange={(e) => setBulkStandbyRoles((prev) => ({ ...prev, mod: e.target.checked }))}
                />
                <span>
                  <b>Mod</b>
                  <small>Tài khoản quản trị theo module được cấp quyền.</small>
                </span>
              </label>
            </section>

            <label className="adminx-bulk-standby-password">
              <span>Mật khẩu Admin</span>
              <PasswordInput
                value={bulkStandbyPassword}
                onChange={(e) => setBulkStandbyPassword(e.target.value)}
                placeholder="Nhập mật khẩu của tài khoản đang đăng nhập"
                autoComplete="current-password"
                disabled={busy === "STANDBY_BULK"}
              />
              <small>Hệ thống sẽ xác thực lại mật khẩu của Admin hiện tại trước khi áp dụng.</small>
            </label>

            <div className="adminx-confirm-actions">
              <button type="button" className="ghost" onClick={closeBulkStandbyDialog} disabled={busy === "STANDBY_BULK"}>
                Hủy
              </button>
              <button
                type="button"
                className="danger"
                onClick={runBulkStandby}
                disabled={busy === "STANDBY_BULK" || (!bulkStandbyRoles.user && !bulkStandbyRoles.mod) || !bulkStandbyPassword.trim()}
              >
                {busy === "STANDBY_BULK" ? "Đang áp dụng..." : "Áp dụng"}
              </button>
            </div>
          </div>
        </div>
      )}

      {standbyImportOpen && (
        <div className="adminx-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="standbyImportTitle">
          <div className="adminx-confirm-card adminx-standby-import-card">
            <span>Import Standby CSV</span>
            <h3 id="standbyImportTitle">Chuyển Standby theo file</h3>
            <p>
              Đây là chức năng chuyển tài khoản đã tồn tại sang Standby, không tạo tài khoản mới. Có thể dùng một cột mã hoặc hai cột mã + tên. Upload CSV/TSV có cột <b>Mã nhân viên</b>, <b>MANV</b> hoặc <b>NV</b>. Nếu file chỉ có một cột, hệ thống sẽ tự lấy cột đầu tiên làm mã nhân viên.
            </p>

            <section className="adminx-standby-import-drop">
              <span>File CSV</span>
              <input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" disabled={readingImport || busy === "STANDBY_IMPORT"} onChange={handleStandbyImportFile} />
              <button type="button" className="adminx-standby-template-button" onClick={downloadStandbyImportTemplate}>
                Tải file mẫu CSV
              </button>
              <small>Tài khoản quyền Admin trong file sẽ được bỏ qua để tránh khóa nhầm.</small>
            </section>

            {readingImport && <UiNotice tone="loading">Đang đọc file…</UiNotice>}
            {importFeedback && <UiNotice tone={importFeedback.tone}>{importFeedback.text}</UiNotice>}
            <section className="adminx-standby-import-stats" aria-label="Xem trước import Standby">
              <div>
                <span>File</span>
                <b>{standbyImportPreview.fileName || "Chưa chọn"}</b>
              </div>
              <div>
                <span>Dòng đọc được</span>
                <b>{formatNumber(standbyImportPreview.rawRows)}</b>
              </div>
              <div>
                <span>Mã hợp lệ</span>
                <b>{formatNumber(standbyImportPreview.codes.length)}</b>
              </div>
              <div>
                <span>Trùng trong file</span>
                <b>{formatNumber(standbyImportPreview.duplicates.length)}</b>
              </div>
            </section>

            {(standbyImportPreview.errors.length > 0 || standbyImportPreview.duplicates.length > 0) && (
              <section className="adminx-standby-import-warnings">
                {standbyImportPreview.errors.slice(0, 6).map((item) => (
                  <p key={item}>{item}</p>
                ))}
                {standbyImportPreview.duplicates.length > 0 && (
                  <p>
                    Bỏ qua mã trùng: {standbyImportPreview.duplicates.slice(0, 8).join(", ")}
                    {standbyImportPreview.duplicates.length > 8 ? "..." : ""}
                  </p>
                )}
              </section>
            )}

            <div className="adminx-confirm-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setStandbyImportOpen(false);
                  setStandbyImportPreview(EMPTY_STANDBY_IMPORT_PREVIEW);
                }}
                disabled={busy === "STANDBY_IMPORT"}
              >
                Hủy
              </button>
              <button
                type="button"
                className="danger"
                onClick={runStandbyImport}
                disabled={readingImport || busy === "STANDBY_IMPORT" || importFeedback?.tone === "success" || standbyImportPreview.codes.length === 0 || standbyImportPreview.codes.length > 5000}
              >
                {busy === "STANDBY_IMPORT" ? "Đang import..." : "Áp dụng Standby"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteStaffDialog && (
        <div className="adminx-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="deleteStaffTitle">
          <div className="adminx-confirm-card adminx-delete-staff-card">
            <span>Xóa nhân viên</span>
            <h3 id="deleteStaffTitle">Xóa tài khoản NV {deleteStaffDialog.maNV}</h3>
            <p>
              {deleteStaffDialog.staffName}. Thao tác này không thể hoàn tác. Có thể gửi mail để nhân viên biết lý do tài khoản bị xóa.
            </p>

            <label className="adminx-delete-mail-toggle">
              <input
                type="checkbox"
                checked={deleteStaffMailEnabled}
                onChange={(e) => setDeleteStaffMailEnabled(e.target.checked)}
              />
              <span>
                <b>Gửi mail thông báo cho tài khoản bị xóa</b>
                <small>{deleteStaffDialog.gmail ? `Gửi đến Gmail đã đăng ký: ${deleteStaffDialog.gmail}` : "Nếu tài khoản chưa có Gmail hợp lệ, hệ thống sẽ chỉ xóa tài khoản."}</small>
              </span>
            </label>

            <section className={!deleteStaffMailEnabled ? "adminx-delete-mail-fields disabled" : "adminx-delete-mail-fields"}>
              <label>
                <span>Tiêu đề mail</span>
                <input
                  value={deleteStaffMailTitle}
                  onChange={(e) => setDeleteStaffMailTitle(e.target.value)}
                  disabled={!deleteStaffMailEnabled}
                  placeholder="VD: Thông báo tài khoản đã bị xóa"
                />
              </label>
              <label>
                <span>Nội dung gửi nhân viên</span>
                <textarea
                  value={deleteStaffMailMessage}
                  onChange={(e) => setDeleteStaffMailMessage(e.target.value)}
                  disabled={!deleteStaffMailEnabled}
                  rows={4}
                  placeholder="Nhập nội dung để nhân viên biết lý do..."
                />
              </label>
            </section>

            <div className="adminx-confirm-actions">
              <button type="button" className="ghost" onClick={() => setDeleteStaffDialog(null)}>
                Hủy
              </button>
              <button type="button" className="danger" onClick={submitDeleteStaffDialog}>
                Xóa tài khoản
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <UiFeedbackDialog tone={toast.type} onDismiss={()=>setToast(null)} onRetry={toast.type === "error" ? ()=>{setToast(null);void loadStaff();} : undefined} retryLabel="Kiểm tra danh sách">{toast.text}</UiFeedbackDialog>}
    </section>
  );
}

const ADMINX_STYLE = `
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

.adminx-panel-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
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

.adminx-action-btn.standby {
  background: #020617;
  color: #ffd400;
}

.adminx-action-btn.import {
  background: #e8f7ff;
  border: 1px solid #bae6fd;
  color: #075985;
}

.adminx-staff-actions button.primary {
  background: #0f172a;
  border-color: #0f172a;
  color: #ffd400;
}

.adminx-staff-actions button.danger {
  background: #fee2e2;
  border-color: #fecaca;
  color: #b91c1c;
}

.adminx-action-btn:disabled,
.adminx-filter-bar button:disabled,
.adminx-pagination button:disabled,
.adminx-staff-actions button:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.adminx-staff-summary {
  display: grid;
  gap: 10px;
}

.adminx-staff-summary {
  grid-template-columns: repeat(3, 1fr);
  margin-top: 10px;
}

.adminx-staff-summary {
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 12px;
}

.adminx-staff-summary div {
  min-height: 118px;
  padding: 15px;
  border-radius: 22px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.adminx-staff-summary span {
  display: block;
  color: #64748b;
  font-size: 10px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-staff-summary b {
  display: block;
  margin-top: 11px;
  color: #0f172a;
  font-size: 30px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: -.06em;
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
.adminx-filter-bar select {
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
.adminx-filter-bar select:focus {
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

.adminx-staff-viewonly {
  min-height: 86px;
  padding: 13px;
  border-radius: 18px;
  display: grid;
  align-content: center;
  gap: 6px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
}

.adminx-staff-viewonly b {
  color: #0f172a;
  font-size: 13px;
  font-weight: 1000;
}

.adminx-staff-viewonly span {
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.35;
  font-weight: 850;
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

.adminx-confirm-layer {
  position: fixed;
  inset: 0;
  z-index: 1000000;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(15, 23, 42, .56);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.adminx-confirm-card {
  width: min(100%, 440px);
  padding: 22px;
  border-radius: 26px;
  border: 1px solid rgba(226, 232, 240, .95);
  background: #ffffff;
  box-shadow: 0 28px 90px rgba(15, 23, 42, .32);
}

.adminx-bulk-standby-card {
  width: min(100%, 520px);
}

.adminx-standby-import-card {
  width: min(100%, 620px);
}

.adminx-delete-staff-card {
  width: min(100%, 560px);
}

.adminx-confirm-card > span {
  display: inline-flex;
  width: fit-content;
  padding: 8px 11px;
  border-radius: 999px;
  background: #020617;
  color: #ffd400;
  font-size: 10px;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-confirm-card h3 {
  margin: 16px 0 0;
  color: #0f172a;
  font-size: 24px;
  line-height: 1.08;
  font-weight: 1000;
  letter-spacing: -.04em;
}

.adminx-confirm-card p {
  margin: 10px 0 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.5;
  font-weight: 850;
}

.adminx-confirm-card div {
  margin-top: 18px;
  display: grid;
  grid-template-columns: .8fr 1fr;
  gap: 10px;
}

.adminx-bulk-standby-options {
  margin-top: 16px;
  display: grid;
  gap: 10px;
}

.adminx-bulk-standby-options label {
  display: grid;
  grid-template-columns: 24px 1fr;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid #dbe4ef;
  border-radius: 18px;
  background: #f8fafc;
  cursor: pointer;
}

.adminx-bulk-standby-options input {
  width: 18px;
  height: 18px;
  accent-color: #ffd400;
}

.adminx-bulk-standby-options b {
  display: block;
  color: #0f172a;
  font-size: 14px;
  line-height: 1.15;
  font-weight: 1000;
}

.adminx-bulk-standby-options small {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 800;
}

.adminx-bulk-standby-password {
  margin-top: 14px;
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid #fde68a;
  border-radius: 18px;
  background: linear-gradient(135deg, #fffdf0, #ffffff);
}

.adminx-bulk-standby-password > span {
  color: #475569;
  font-size: 11px;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-bulk-standby-password .vtdd-password-wrap {
  width: 100%;
}

.adminx-bulk-standby-password .vtdd-password-wrap input {
  min-height: 48px;
  border-radius: 16px;
  border: 1px solid #dbe4ef;
  background: #ffffff;
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
}

.adminx-bulk-standby-password small {
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 850;
}

.adminx-standby-import-drop {
  margin-top: 16px;
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px dashed #94a3b8;
  border-radius: 18px;
  background: #f8fafc;
}

.adminx-standby-import-drop > span {
  color: #475569;
  font-size: 11px;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-standby-import-drop input {
  width: 100%;
  min-height: 44px;
  padding: 10px;
  border: 1px solid #dbe4ef;
  border-radius: 14px;
  background: #fff;
  color: #0f172a;
  font-size: 13px;
  font-weight: 850;
}

.adminx-standby-template-button {
  width: 100%;
  min-height: 42px;
  border: 1px solid #fde68a;
  border-radius: 14px;
  background: #fff7cc;
  color: #020617;
  font-size: 12px;
  line-height: 1;
  font-weight: 1000;
  cursor: pointer;
}

.adminx-standby-template-button:hover {
  background: #ffd400;
}

.adminx-standby-import-drop small {
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 800;
}

.adminx-standby-import-stats {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.adminx-standby-import-stats div {
  min-height: 72px;
  display: block;
  margin-top: 0;
  padding: 12px;
  border: 1px solid #dbe4ef;
  border-radius: 16px;
  background: #fff;
}

.adminx-standby-import-stats span {
  display: block;
  color: #64748b;
  font-size: 10px;
  line-height: 1.1;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-standby-import-stats b {
  display: block;
  margin-top: 8px;
  color: #0f172a;
  font-size: 15px;
  line-height: 1.15;
  font-weight: 1000;
  word-break: break-word;
}

.adminx-standby-import-warnings {
  margin-top: 12px;
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid #fed7aa;
  border-radius: 16px;
  background: #fff7ed;
}

.adminx-standby-import-warnings p {
  margin: 0;
  color: #9a3412;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 850;
}

@media (max-width: 640px) {
  .adminx-standby-import-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.adminx-delete-mail-toggle {
  margin-top: 16px;
  display: grid;
  grid-template-columns: 24px 1fr;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid #dbe4ef;
  border-radius: 18px;
  background: #f8fafc;
  cursor: pointer;
}

.adminx-delete-mail-toggle input {
  width: 18px;
  height: 18px;
  accent-color: #ffd400;
}

.adminx-delete-mail-toggle b {
  display: block;
  color: #0f172a;
  font-size: 14px;
  line-height: 1.15;
  font-weight: 1000;
}

.adminx-delete-mail-toggle small {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 800;
}

.adminx-delete-mail-fields {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}

.adminx-delete-mail-fields.disabled {
  opacity: .55;
}

.adminx-delete-mail-fields label {
  display: grid;
  gap: 7px;
}

.adminx-delete-mail-fields label > span {
  color: #64748b;
  font-size: 10px;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-delete-mail-fields input,
.adminx-delete-mail-fields textarea {
  width: 100%;
  min-height: 46px;
  padding: 12px 13px;
  border-radius: 16px;
  border: 1px solid #dbe4ef;
  background: #ffffff;
  color: #0f172a;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 850;
  outline: none;
  resize: vertical;
}

.adminx-delete-mail-fields input:focus,
.adminx-delete-mail-fields textarea:focus {
  border-color: #facc15;
  box-shadow: 0 0 0 4px rgba(250, 204, 21, .16);
}

.adminx-confirm-card button {
  min-height: 48px;
  border-radius: 16px;
  border: 0;
  font-size: 12px;
  font-weight: 1000;
  letter-spacing: .04em;
  text-transform: uppercase;
  cursor: pointer;
}

.adminx-confirm-card .adminx-standby-template-button {
  min-height: 42px;
  border: 1px solid #fde68a;
  border-radius: 14px;
  background: #fff7cc;
  color: #020617;
  letter-spacing: .02em;
  text-transform: none;
}

.adminx-confirm-card button.ghost {
  border: 1px solid #dbe3ef;
  background: #ffffff;
  color: #0f172a;
}

.adminx-confirm-card button.primary {
  background: #ffd400;
  color: #020617;
}

.adminx-confirm-card button.danger {
  background: #dc2626;
  color: #ffffff;
}

@media screen and (max-width: 920px) {
  .adminx-tabs {
    display: flex;
    overflow-x: auto;
    grid-template-columns: none;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
  }

  .adminx-tabs button {
    flex: 0 0 auto;
    min-width: 118px;
    min-height: 56px;
    scroll-snap-align: start;
  }

  .adminx-staff-summary {
    grid-template-columns: 1fr;
  }

  .adminx-staff-card {
    grid-template-columns: 1fr;
  }

  .adminx-filter-bar {
    grid-template-columns: 1fr;
  }
}

@media screen and (max-width: 430px) {

  .adminx-tabs {
    padding: 7px;
    border-radius: 24px;
    gap: 7px;
    display: flex;
    overflow-x: auto;
    grid-template-columns: none;
  }

  .adminx-tabs button {
    min-height: 62px;
    padding: 9px;
    min-width: 112px;
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

.adminx-field-hint {
  display: block;
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.35;
  font-weight: 800;
}

`;

const ADMINX_PERSONNEL_STYLE = `
.adminx-command-search {
  margin: 12px 0 0;
  padding: 8px;
  border-radius: 22px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  display: grid;
  grid-template-columns: 1fr 150px;
  gap: 8px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, .05);
}

.adminx-command-search input {
  width: 100%;
  min-height: 44px;
  border: 0;
  border-radius: 16px;
  background: #f8fafc;
  color: #0f172a;
  padding: 0 13px;
  font-size: 13px;
  font-weight: 850;
  outline: none;
}

.adminx-command-search button {
  border: 0;
  border-radius: 16px;
  background: #ffd400;
  color: #07111f;
  font-size: 11px;
  font-weight: 1000;
  cursor: pointer;
}

.adminx-command-search button:disabled {
  opacity: .62;
  cursor: wait;
}

@media screen and (max-width: 560px) {
  .adminx-command-search {
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
.adminx-permission-tree {
  display: grid;
  gap: 10px;
}
.adminx-tree-group {
  padding: 10px;
  border-radius: 20px;
  background: #f8fafc;
  border: 1px solid #dbe4ef;
}
.adminx-tree-group.active {
  background: radial-gradient(circle at 100% 0%, rgba(255,212,0,.16), transparent 38%), #ffffff;
  border-color: #ffd400;
}
.adminx-tree-head {
  width: 100%;
  min-height: 58px;
  padding: 10px;
  border: 0;
  border-radius: 16px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: center;
  background: #ffffff;
  color: #07111f;
  text-align: left;
  cursor: pointer;
}
.adminx-tree-head:disabled {
  cursor: default;
  opacity: 1;
}
.adminx-tree-head i {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: #07111f;
  color: #ffd400;
  font-style: normal;
  font-size: 13px;
  font-weight: 1000;
}
.adminx-tree-head b,
.adminx-tree-children span {
  display: block;
  color: #07111f;
  font-size: 13px;
  line-height: 1.15;
  font-weight: 1000;
}
.adminx-tree-head small,
.adminx-tree-children small {
  display: block;
  margin-top: 5px;
  color: #64748b;
  font-size: 10.5px;
  line-height: 1.32;
  font-weight: 850;
}
.adminx-tree-children {
  margin-top: 9px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.adminx-tree-children button {
  min-height: 66px;
  padding: 11px;
  border-radius: 16px;
  border: 1px solid #dbe4ef;
  background: #ffffff;
  text-align: left;
  cursor: pointer;
}
.adminx-tree-children button.active {
  background: #07111f;
  border-color: #07111f;
  color: #ffd400;
  box-shadow: 0 12px 24px rgba(15,23,42,.14);
}
.adminx-tree-children button.active span {
  color: #ffd400;
}
.adminx-tree-children button.active small {
  color: rgba(255,255,255,.72);
}
.adminx-permission-box-v2 > .adminx-permission-section-title,
.adminx-permission-box-v2 > .adminx-module-buttons {
  display: none;
}
@media (max-width: 760px) {
  .adminx-tree-children {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 980px) { .adminx-permission-card-v3 { grid-template-columns: 1fr; } }

/* ===== VTDD ADMIN FINAL POLISH - cleaner, denser, calmer ===== */

.adminx-console {
  gap: 10px;
}

.adminx-tabs {
  position: sticky;
  top: 8px;
  z-index: 50;
  padding: 6px;
  border-radius: 22px;
  gap: 6px;
  background: rgba(255,255,255,.96);
  box-shadow: 0 12px 34px rgba(15, 23, 42, .08);
}

.adminx-tabs button {
  min-height: 58px;
  padding: 8px 9px;
  border-radius: 17px;
  gap: 8px;
}

.adminx-tabs button i {
  width: 31px;
  height: 31px;
  border-radius: 11px;
}

.adminx-tabs button b {
  font-size: 12.5px;
}

.adminx-tabs button em {
  margin-top: 3px;
  font-size: 10px;
}

.adminx-panel,
.admin-cms-module-panel-v5,
.admin-cms-headline-v5 {
  border-radius: 24px;
  box-shadow: 0 14px 38px rgba(15, 23, 42, .065);
}

.adminx-panel {
  padding: 16px;
}

.adminx-panel-head {
  margin-bottom: 14px;
}

.adminx-panel h2,
.admin-cms-headline-v5 h2,
.admin-cms-module-title-v5 h3,
.cms-pro-editor-top h2 {
  letter-spacing: -.045em;
}

.adminx-panel h2 {
  margin-top: 8px;
  font-size: clamp(24px, 2vw, 32px);
}

.adminx-panel-head p {
  max-width: 760px;
}

.adminx-staff-summary {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.adminx-filter-bar {
  margin-top: 12px;
  grid-template-columns: minmax(0, 1fr) 160px 112px;
  gap: 8px;
}

.adminx-filter-bar input,
.adminx-filter-bar select {
  border-radius: 15px;
  background: #f8fafc;
  border-color: #dbe4ef;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.75);
}

.adminx-filter-bar button,
.adminx-action-btn,
.adminx-staff-actions button,
.cms-actions button {
  border-radius: 14px;
}

.adminx-table-card {
  margin-top: 10px;
  border-radius: 20px;
}

.adminx-table-toolbar {
  min-height: 44px;
  padding: 0 12px;
}

.adminx-staff-list {
  gap: 8px;
  padding: 8px;
}

.adminx-staff-card {
  grid-template-columns: minmax(0, 1fr) minmax(280px, 330px);
  gap: 10px;
  padding: 12px;
  border-radius: 18px;
  box-shadow: none;
}

.adminx-staff-card h3 {
  margin-top: 7px;
  font-size: 17px;
}

.adminx-staff-meta,
.adminx-staff-flags {
  margin-top: 7px;
  gap: 6px;
}

.adminx-staff-meta span,
.adminx-staff-flags span {
  min-height: 28px;
  padding: 6px 9px;
  border-radius: 999px;
  font-size: 10px;
}

.adminx-staff-actions {
  align-content: center;
  gap: 7px;
}

.adminx-staff-actions button {
  min-height: 40px;
  font-size: 10.5px;
}

.adminx-pagination {
  margin-top: 10px;
}

.adminx-permission-page,
.adminx-permission-list-v3 {
  gap: 10px;
}

.adminx-permission-card-v3 {
  padding: 14px;
  border-radius: 20px;
  grid-template-columns: minmax(240px, .7fr) minmax(420px, 1.3fr);
  gap: 12px;
  box-shadow: none;
}

.adminx-permission-box-v2 {
  padding: 12px;
  border-radius: 18px;
}

.adminx-role-pills,
.adminx-module-buttons,
.adminx-permission-tree-actions {
  gap: 7px;
}

.adminx-role-pills button,
.adminx-module-buttons button,
.adminx-permission-tree-actions button {
  min-height: 56px;
  border-radius: 14px;
}

.admin-cms-headline-v5 {
  padding: 18px;
}

.admin-cms-module-grid-v5 {
  gap: 8px;
}

.admin-cms-module-grid-v5 button {
  min-height: 122px;
  padding: 14px;
  border-radius: 20px;
  gap: 9px;
}

.admin-cms-module-grid-v5 i,
.admin-cms-module-title-v5 > span,
.admin-cms-empty-tools span {
  width: 36px;
  height: 36px;
  border-radius: 12px;
}

.admin-cms-module-grid-v5 em {
  margin-top: 5px;
}

.admin-cms-module-panel-v5 {
  padding: 18px;
}

.cms-pro-fields,
.cms-pro-preview {
  padding: 14px;
  border-radius: 20px;
}

.cms-rich-box-tiny .tox-tinymce {
  border-radius: 16px !important;
}

@media (max-width: 920px) {

  .adminx-tabs {
    top: 0;
    margin-inline: -2px;
    border-radius: 18px;
  }

  .adminx-tabs button {
    min-width: 132px;
  }

  .adminx-staff-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .adminx-filter-bar,
  .adminx-staff-card,
  .adminx-permission-card-v3 {
    grid-template-columns: 1fr;
  }

  .adminx-staff-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {

  .adminx-panel {
    padding: 12px;
    border-radius: 20px;
  }

  .adminx-panel h2 {
    font-size: 23px;
  }

  .adminx-staff-summary {
    grid-template-columns: 1fr;
  }

  .adminx-staff-actions {
    grid-template-columns: 1fr;
  }

  .adminx-staff-actions button {
    min-height: 42px;
  }

  .adminx-role-pills,
  .adminx-module-buttons,
  .adminx-permission-tree-actions {
    grid-template-columns: 1fr;
  }

  .admin-cms-headline-v5,
  .admin-cms-module-panel-v5 {
    padding: 12px;
    border-radius: 20px;
  }
}

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
  const [open, setOpen] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [help, setHelp] = useState("");
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const node = drawer.current;
    const previous = document.activeElement;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    node?.showModal();
    return () => {
      node?.close();
      document.documentElement.style.overflow = previousOverflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);
  const [permission, setPermission] = useState(item.permission || "");
  const [accessItems, setAccessItems] = useState<string[]>(parseAdminAccessItems(item.modulePermissions));

  useEffect(() => {
    setPermission(item.permission || "");
    setAccessItems(parseAdminAccessItems(item.modulePermissions));
  }, [item.permission, item.modulePermissions, item.maNV]);

  const dirty = permission !== (item.permission || "") ||
    [...accessItems].sort().join(",") !== parseAdminAccessItems(item.modulePermissions).sort().join(",");

  function close() {
    if (disabled) return;
    if (dirty) { setDiscard(true); return; }
    setOpen(false);
  }

  function resetClose() {
    setPermission(item.permission || "");
    setAccessItems(parseAdminAccessItems(item.modulePermissions));
    setDiscard(false);
    setOpen(false);
  }
  function setRole(next: "" | "mod" | "admin") {
    setPermission(next);
    if (next !== "mod") setAccessItems([]);
  }

  function toggleModule(key: string) {
    setAccessItems((current) => {
      if (!current.includes(key)) return key === "people" ? [...current, key, ...PERSONNEL_ACTION_OPTIONS.map(item => adminActionToken(item.key))].filter((item, index, all) => all.indexOf(item) === index) : [...current, key];
      if (key === "tcdm" || key === "people" || key === "imei") {
        const actionKeys = key === "people" ? PERSONNEL_ACTION_KEYS : key === "imei" ? IMEI_ACTION_KEYS : TCDM_ACTION_KEYS;
        return current.filter((item) => {
          if (item === key) return false;
          if (!item.startsWith(ADMIN_ACTION_PREFIX)) return true;
          const action = item.slice(ADMIN_ACTION_PREFIX.length) as AdminActionKey;
          return !actionKeys.has(action);
        });
      }
      return current.filter((item) => item !== key);
    });
  }

  function toggleAction(key: AdminActionKey) {
    const token = `${ADMIN_ACTION_PREFIX}${key}`;

    setAccessItems((current) => {
      if (current.includes(token)) return removeAdminActionToken(current, key);

      const parentModule = PERSONNEL_ACTION_KEYS.has(key) ? "people" : IMEI_ACTION_KEYS.has(key) ? "imei" : "tcdm";
      const next = current.includes(parentModule)
        ? [...current, token]
        : [parentModule, ...current, token];

      return parseAdminAccessItems(next.join(","));
    });
  }

  return (
    <>
    <button type="button" className={permissionStyles.trigger} disabled={disabled} onClick={()=>{setDiscard(false);setHelp("");setOpen(true);}}>Chỉnh quyền</button>
    {open && <dialog ref={drawer} className={permissionStyles.drawer} aria-labelledby={"permission-title-"+item.maNV} onCancel={e=>{e.preventDefault();close();}}>
      <header className={permissionStyles.header}><div><h2 id={"permission-title-"+item.maNV}>Chỉnh quyền</h2><p>{item.staffName} · NV {item.maNV} · ST {item.maST||"—"}</p></div><button type="button" disabled={disabled} onClick={close} aria-label="Đóng khung chỉnh quyền">×</button></header>
      <div className={permissionStyles.scroll}><div className="adminx-permission-box adminx-permission-box-v2">
      <div className="adminx-permission-head adminx-permission-head-v2">
        <div>
          <b>Phân quyền tài khoản</b>
          <small>Trống = user thường · Mod = theo hạng mục · Admin = toàn quyền</small>
        </div>

      </div>

      <div className="adminx-role-pills">
        <button type="button" disabled={disabled} className={permission === "" ? "active" : ""} onClick={() => setRole("")}>User thường<small>Không có quyền admin</small></button>
        <button type="button" disabled={disabled} className={permission === "mod" ? "active" : ""} onClick={() => setRole("mod")}>Mod<small>Chỉ hạng mục được cấp</small></button>
        <button type="button" disabled={disabled} className={permission === "admin" ? "active" : ""} onClick={() => setRole("admin")}>Admin<small>Toàn quyền hệ thống</small></button>
      </div>

      {permission === "mod" && (
        <div className="adminx-permission-tree" aria-label="Cây phân quyền module">
          {PERMISSION_TREE.map((group) => {
            const groupModule = "module" in group ? String(group.module) : "";
            const groupActive = groupModule
              ? accessItems.includes(groupModule)
              : group.children.some((child) => {
                  if ("key" in child) return accessItems.includes(adminActionToken(child.key));
                  return accessItems.includes(String(child.module));
                });

            return (
              <details className={`adminx-tree-group ${groupActive ? "active" : ""}`} key={group.title}>
                <summary className={permissionStyles.groupHead}><span className={permissionStyles.chevron} aria-hidden="true">›</span><b>{group.title}</b><span>{group.children.filter(child=>"key" in child ? accessItems.includes(adminActionToken(child.key)) : accessItems.includes(String(child.module))).length}/{group.children.length} quyền</span><button type="button" aria-label={"Giải thích nhóm "+group.title} onClick={e=>{e.preventDefault();e.stopPropagation();const details=e.currentTarget.closest("details");if(details)details.open=true;setHelp(help===group.title?"":group.title);}}>ⓘ</button></summary>
                {help===group.title && <p className={permissionStyles.help}>{group.desc}</p>}
                {groupModule && <label className={permissionStyles.moduleToggle}><input type="checkbox" disabled={disabled} checked={groupActive} onChange={()=>toggleModule(groupModule)}/> Cho phép truy cập nhóm này</label>}


                <div className="adminx-tree-children">
                  {group.children.map((child) => {
                    if ("key" in child && child.key === "imei-brand-lock") return null;
                    const key = "key" in child ? adminActionToken(child.key) : String(child.module);
                    const selected = accessItems.includes(key);
                    return <div className={permissionStyles.permissionRow} key={key}>
                      <div className={permissionStyles.permissionControls}>
                        <button type="button" disabled={disabled} aria-pressed={selected} className={selected ? "active" : ""} onClick={() => "key" in child ? toggleAction(child.key) : toggleModule(String(child.module))}>
                          <span>{child.label}</span>
                        </button>
                        <button type="button" className={permissionStyles.info} aria-label={"Giải thích " + child.label} aria-expanded={help === key} onClick={() => setHelp(help === key ? "" : key)}>ⓘ</button>
                      </div>
                      {help === key && <p className={permissionStyles.help}>{child.desc}</p>}
                      {"key" in child && child.key === "imei-manage-all" && <label className={permissionStyles.childPermission}>
                        <input type="checkbox" checked={accessItems.includes(adminActionToken("imei-brand-lock"))}
                          disabled={disabled || !selected} onChange={() => toggleAction("imei-brand-lock")} />
                        <span>Khóa tạo IMEI máy cũ theo hãng</span>
                      </label>}
                    </div>;
                  })}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {permission === "admin" && <em>Admin có toàn quyền, không cần chọn hạng mục.</em>}
      {permission === "" && <em>User thường không được truy cập trang quản trị.</em>}

    </div></div>
    <footer className={permissionStyles.footer}>
      {discard ? <><p>Bỏ các thay đổi chưa lưu?</p><button type="button" onClick={()=>setDiscard(false)}>Tiếp tục chỉnh</button><button type="button" onClick={resetClose}>Bỏ thay đổi</button></> : <><span>{dirty?"Có thay đổi chưa lưu":""}</span><button type="button" disabled={disabled} onClick={close}>Đóng</button><button type="button" className={permissionStyles.save} disabled={disabled||!dirty} onClick={()=>onSave(item.maNV,permission,accessItems.join(","))}>{disabled?"Đang lưu…":"Lưu thay đổi"}</button></>}
    </footer></dialog>}
    </>
  );
}
type CmsSlug = "quy-trinh-thu-cu" | "may-moi" | "may-cu" | "demo";
type AdminModuleKey = AdminScreen;

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
  { key: "imei", no: "07", title: "Tạo IMEI / SN", desc: "Cấp mã và giữ lịch sử hủy, cấp lại.", badge: "Sổ mã" },
  {
    key: "tcdm",
    no: "01",
    title: "Quản trị: Trang tra giá TCDM",
    desc: "Đồng bộ Google Sheet, tạm khóa và mở lại trang tra giá hiện tại.",
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
    desc: "Quản lý hãng, hướng dẫn gỡ demo, ảnh, video và công cụ tải về.",
    badge: "Hãng / hướng dẫn",
  },

  {
    key: "people",
    no: "06",
    title: "Quản trị: Quyền & Nhân sự",
    desc: "Duyệt tài khoản, reset bảo mật, phân quyền Admin / Mod / User.",
    badge: "Nhân sự / phân quyền",
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
  const [saveError, setSaveError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const lastAction = useRef<"SAVE_DRAFT" | "PUBLISH" | "UNPUBLISH">("SAVE_DRAFT");

  useEffect(() => {
    setTitle(item.draftTitle || item.title || "");
    setSummary(item.draftSummary || item.summary || "");
    const nextBody = legacyTextToHtml(item.draftBody || item.body || "");
    setBody(nextBody);
  }, [item.slug, item.draftTitle, item.draftSummary, item.draftBody, item.title, item.summary, item.body]);

  async function post(action: "SAVE_DRAFT" | "PUBLISH" | "UNPUBLISH") {
    try {
      setBusy(action);
      lastAction.current = action; setSaveError(""); setSavedMessage("");

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
        const data = await requestJson<{ success: boolean; message: string }>("/api/admin/home-cms", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          cache: "no-store",
          body: JSON.stringify({ action: nextAction, slug, title, summary, body: finalBody }),
        });

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
      setSavedMessage(data.message || "Đã lưu nội dung thành công.");
      await onSaved();
      setBusy("");
    } catch (err: any) {
      setBusy("");
      setSaveError(clientErrorMessage(err, "Không lưu được nội dung."));
    }
  }

  return (
    <section className="cms-pro-editor-card">
      <div className="cms-pro-editor-top">
        <div>
          <span className="adminx-eyebrow">Nội dung CMS</span>
          <h2>{item.label}</h2>
          <p>{slug === "demo" ? "Nội dung chung hiển thị bên dưới danh mục hãng. Quản lý từng hãng ở phần phía trên." : "Soạn nội dung dạng bản nháp. Khi bấm xuất bản, trang chủ sẽ mở trang nội dung này."}</p>
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
                content_css: ["default", "/fonts/roboto/roboto.css"],
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
            <div className="cms-preview-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(body || "<p>Nội dung đang cập nhật.</p>") }} />
          </article>
        </aside>
      </div>

      {busy && <UiNotice tone="loading">{busy === "PUBLISH" ? "Đang xuất bản nội dung…" : "Đang lưu thay đổi…"}</UiNotice>}
      {saveError && <UiNotice onRetry={() => void post(lastAction.current)} busy={!!busy}>{saveError}<p>Nội dung đã nhập vẫn được giữ trong trình soạn thảo.</p></UiNotice>}
      {savedMessage && <UiNotice tone="success">{savedMessage}</UiNotice>}
      <div className="cms-actions">
        <button type="button" onClick={() => post("SAVE_DRAFT")} disabled={!!busy}>
          {busy === "SAVE_DRAFT" ? "Đang lưu..." : "Lưu bản nháp"}
        </button>
        <button type="button" className="publish" onClick={() => post("PUBLISH")} disabled={!!busy}>
          {busy === "PUBLISH" ? "Đang xuất bản..." : "Xuất bản"}
        </button>
        {item.published ? (
          <button type="button" className="unpublish" onClick={() => post("UNPUBLISH")} disabled={!!busy}>
            {busy === "UNPUBLISH" ? "Đang tắt..." : "Ngừng xuất bản"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function NoAccessPanel({ moduleTitle }: { moduleTitle: string }) {
  return (
    <section className="admin-cms-no-access-panel" aria-label={moduleTitle}>
      <div>
        <b>Không có quyền truy cập</b>
        <p>Quyền tài khoản: Moderator</p>
        <p>Admin chưa cấp quyền sử dụng các chức năng.</p>
      </div>
    </section>
  );
}

export default function AdminConsole({
  adminRole = "admin",
  adminName = "Admin",
  adminCode = "",
  adminModules = "",
  adminActions = "",
  adminHasExplicitActions = false,
}: AdminConsoleProps) {
  const [module, setModule] = useState<AdminModuleKey>(() => {
    if (adminRole === "admin") return "tcdm";
    return (parseModuleList(adminModules)[0] as AdminModuleKey) || "tcdm";
  });
  const [cmsItems, setCmsItems] = useState<CmsItems>(EMPTY_CMS);
  const [cmsLoading, setCmsLoading] = useState(false);
  const [cmsError, setCmsError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);

  const isAdmin = adminRole === "admin";
  const allowedModules = parseModuleList(adminModules);
  const allowedActions = parseAdminActionItems(adminActions);
  const screens = visibleAdminScreens(adminRole, allowedModules, allowedActions);
  const visibleAdminModules = ADMIN_MODULES.filter(item => screens.includes(item.key));
  const groups = ADMIN_SECTIONS.filter(section => section.screens.some(key => screens.includes(key)));
  const activeGroup = groups.find(section => section.screens.includes(module)) || groups[0];
  const activeModuleAllowed = visibleAdminModules.some((item) => item.key === module);
  const firstVisibleModule = visibleAdminModules[0]?.key || "tcdm";

  function canAccess(key: AdminModuleKey) {
    return screens.includes(key);
  }

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    if (type === "success") window.setTimeout(() => setToast(current => current?.text === text ? null : current), 5000);
  }

  async function loadCms() {
    try {
      setCmsLoading(true);
      setCmsError("");
      const data = await requestJson<{ success: boolean; items: Partial<CmsItems> }>("/api/admin/home-cms");
      setCmsItems({ ...EMPTY_CMS, ...(data.items || {}) });
      setCmsLoading(false);
    } catch (err: any) {
      setCmsLoading(false);
      setCmsError(clientErrorMessage(err, "Không tải được nội dung."));
    }
  }

  useEffect(() => {
    if (!isCmsModule(module)) return;
    loadCms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  useEffect(() => {
    if (activeModuleAllowed) return;
    setModule(firstVisibleModule);
  }, [activeModuleAllowed, firstVisibleModule]);

  const activeMeta = ADMIN_MODULES.find((item) => item.key === module) || ADMIN_MODULES[0];
  const activeAccess = canAccess(module);

  return (
    <section className="admin-cms-shell-v5">
      <style suppressHydrationWarning>{ADMIN_CMS_STYLE}</style>

      <nav className="admin-group-tabs" role="tablist" aria-label="Nhóm quản trị">
        {groups.map((group, index) => <button key={group.key} type="button" role="tab" id={`admin-group-${group.key}`} aria-selected={activeGroup?.key === group.key} aria-controls="admin-workspace" tabIndex={activeGroup?.key === group.key ? 0 : -1}
          onClick={() => { if (activeGroup?.key !== group.key) setModule(group.screens.find(key => screens.includes(key))!); }}
          onKeyDown={event => {
            if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? groups.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + groups.length) % groups.length;
            const target = groups[next]; setModule(target.screens.find(key => screens.includes(key))!);
            document.getElementById(`admin-group-${target.key}`)?.focus();
          }}><i aria-hidden="true"><AdminSectionIcon section={group.key} /></i><span>{group.label}<small>{group.description}</small></span></button>)}
      </nav>
      {activeGroup && activeGroup.screens.filter(key => screens.includes(key)).length > 1 && <nav className="admin-module-tabs" aria-label={`Chức năng ${activeGroup.label.toLowerCase()}`}>
        {visibleAdminModules.filter(item => activeGroup.screens.includes(item.key)).map((item) => {
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={module === item.key}
              onClick={() => setModule(item.key)}
            >
              {item.title.replace("Quản trị: ", "")}
            </button>
          );
        })}
      </nav>}

      <section className="admin-cms-module-panel-v5" id="admin-workspace" role="tabpanel" aria-labelledby={activeGroup ? `admin-group-${activeGroup.key}` : undefined}>
        {cmsError && isCmsModule(module) && <UiNotice onRetry={() => void loadCms()} busy={cmsLoading}>{cmsError}</UiNotice>}
        {!activeAccess ? (
          <NoAccessPanel moduleTitle={activeMeta.title} />
        ) : module === "tcdm" ? (
          <>
            <div className="admin-cms-module-title-v5">
              <span>01</span>
              <div>
                <h3>Quản trị: Trang tra giá TCDM</h3>
              </div>
            </div>
            <TradeinAdminTool
              canSync={isAdmin || allowedActions.includes("reload-data") || (!adminHasExplicitActions && allowedModules.includes("tcdm"))}
              canManage={isAdmin || allowedActions.includes("settings-write") || (!adminHasExplicitActions && allowedModules.includes("tcdm"))}
            />
          </>
        ) : module === "imei" ? (
          <ImeiAdminTool actor={adminCode} />
        ) : module === "people" ? (
          <>
            <div className="admin-cms-module-title-v5">
              <span>06</span>
              <div>
                <h3>Quản trị: Quyền & Nhân sự</h3>
              </div>
            </div>
            <PersonnelAdminConsole
              key="people"
              adminRole={adminRole}
              adminName={adminName}
              adminCode={adminCode}
              adminModules={adminModules}
              adminActions={adminActions}
              adminHasExplicitActions={adminHasExplicitActions}
            />
          </>
        ) : module === "demo" ? (
          <>
            <DemoAdminTool showToast={showToast} />
            <details style={{ marginTop: 28 }}><summary style={{ cursor: "pointer", fontWeight: 800 }}>Thông tin / công cụ chung của trang Gỡ Demo</summary>
              {cmsLoading ? <UiNotice tone="loading">Đang tải nội dung…</UiNotice> : !cmsError && <CmsEditor slug="demo" item={cmsItems.demo} onSaved={loadCms} showToast={showToast} />}
            </details>
          </>
        ) : isCmsModule(module) ? (
          cmsLoading ? (
            <UiNotice tone="loading">Đang tải nội dung…</UiNotice>
          ) : !cmsError ? (
            <CmsEditor
              slug={module}
              item={cmsItems[module] || EMPTY_CMS[module]}
              onSaved={loadCms}
              showToast={showToast}
            />
          ) : null
        ) : null}
      </section>

      {toast && <UiNotice tone={toast.type}>{toast.text}<button className="ui-notice-dismiss" type="button" aria-label="Đóng thông báo" onClick={() => setToast(null)}>×</button></UiNotice>}
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
.cms-rich-editor { min-height: 380px; padding: 18px; border-radius: 18px; border: 1px solid #cbd5e1; background: #fff; color: #07111f; outline: none; font-size: 15px; line-height: 1.65; font-weight: 400; overflow: auto; }
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
.cms-preview-body { color: #07111f; font-size: 15px; line-height: 1.65; font-weight: 400; }
.cms-preview-body p,
.cms-preview-body li,
.cms-preview-body div,
.cms-preview-body span,
.cms-preview-body a,
.cms-preview-body td { font-weight: 400; }
.cms-preview-body strong,
.cms-preview-body b,
.cms-preview-body strong *,
.cms-preview-body b * { font-weight: 700; }
.cms-preview-body a { color: #2563eb; }
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
@media (max-width: 760px) { .admin-cms-headline-v5, .cms-pro-editor-top { display: grid; } .admin-cms-headline-v5 { padding: 14px; border-radius: 22px; } .admin-cms-headline-v5 h2 { font-size: 28px; letter-spacing: 0; } .admin-cms-permission-summary { width: 100%; border-radius: 14px; justify-content: center; text-align: center; } .admin-cms-module-grid-v5 { display: flex; grid-template-columns: none; overflow-x: auto; gap: 8px; padding-bottom: 2px; -webkit-overflow-scrolling: touch; } .admin-cms-module-grid-v5 button { min-height: 92px; min-width: 178px; padding: 12px; border-radius: 18px; } .admin-cms-module-grid-v5 em { display: none; } .admin-cms-module-grid-v5 small { padding: 6px 8px; font-size: 9px; } .admin-cms-module-panel-v5 { padding: 10px; border-radius: 22px; } .admin-cms-module-title-v5 h3 { font-size: 26px; letter-spacing: 0; } .cms-actions { display: grid; } .cms-actions button { width: 100%; } .adminx-module-checks { grid-template-columns: 1fr; } }

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
.adminx-permission-section-title { margin: 12px 0 8px; display: grid; gap: 3px; }
.adminx-permission-section-title span { color: #07111f; font-size: 12px; font-weight: 1000; }
.adminx-permission-section-title small { color: #64748b; font-size: 10.5px; line-height: 1.35; font-weight: 850; }
.adminx-action-buttons button { min-height: 76px; }
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
