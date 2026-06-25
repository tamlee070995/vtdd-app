"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { sanitizeHtml } from "@/lib/html-sanitize";
import AdminToolsDashboard from "@/components/AdminToolsDashboard";

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
  source: "staff" | "customer";
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
  deviceLabel: string;
  networkType: string;
};

type DashboardSource = "staff" | "customer";

type AdminDashboard = {
  topOldProducts: Array<{ product: string; count: number }>;
  topStaff: Array<{ maNV: string; staffName: string; count: number; totalValue: number }>;
  topStores: Array<{ maST: string; count: number; totalValue: number }>;
  topDevices: Array<{ label: string; count: number; totalValue: number }>;
  topIps: Array<{ ip: string; count: number; totalValue: number }>;
  dailyLogs: Array<{ day: string; count: number }>;
  actionCounts: Array<{ action: string; count: number }>;
  recentLogs: DashboardLogRow[];
  totalLogs: number;
  totalValue: number;
};

type AdminRole = "admin" | "mod";
type AdminActionKey =
  | "staff-manage"
  | "staff-delete"
  | "staff-security"
  | "settings-write"
  | "reload-data"
  | "dashboard-view"
  | "tools-pmh"
  | "tools-coming"
  | "tools-report"
  | "tools-telegram";

type AdminConsoleProps = {
  initialSettings: Record<string, string>;
  adminRole?: AdminRole;
  adminName?: string;
  adminModules?: string;
  adminActions?: string;
  adminHasExplicitActions?: boolean;
};

type OnlineStats = {
  total: number;
  home: number;
  staff: number;
  customer: number;
  updatedAt: string;
};

type OnlineSession = {
  page: string;
  visitorId: string;
  lastSeenAt: string;
  ip: string;
  path: string;
  device: string;
  userAgent: string;
};

type OpsHealth = {
  generatedAt: string;
  supabase?: { ok: boolean; message: string; latencyMs?: number };
  mail?: { ok: boolean; message: string };
  telegram?: { ok: boolean; message: string };
  backup?: any;
  sync?: any;
  quality?: any;
  recentErrors?: OpsErrorLog[];
};

type OpsErrorLog = {
  id: string;
  time: string;
  actor: string;
  page: string;
  module: string;
  message: string;
  ip: string;
  severity: string;
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
  topStaff: [],
  topStores: [],
  topDevices: [],
  topIps: [],
  dailyLogs: [],
  actionCounts: [],
  recentLogs: [],
  totalLogs: 0,
  totalValue: 0,
};

type TabKey = "overview" | "staff" | "permission" | "notify" | "system" | "dashboard";

type ToastState = {
  type: "success" | "error";
  text: string;
} | null;

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
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
];


const ADMIN_MODULE_OPTIONS = [
  { key: "tcdm", label: "1.1 Tra giá TCDM" },
  { key: "quy-trinh-thu-cu", label: "1.2 Quy trình TCDM" },
  { key: "may-moi", label: "2 Trang máy mới" },
  { key: "may-cu", label: "3 Trang máy cũ" },
  { key: "demo", label: "4 Trang demo" },
  { key: "tools", label: "5 Công cụ" },
];

const ADMIN_ACTION_PREFIX = "action:";

const ADMIN_ACTION_OPTIONS: Array<{ key: AdminActionKey; label: string; desc: string }> = [
  { key: "staff-manage", label: "Quản lý nhân viên", desc: "Xem danh sách, Active và Standby tài khoản." },
  { key: "staff-delete", label: "Xóa nhân viên", desc: "Xóa tài khoản nhân viên khỏi hệ thống." },
  { key: "staff-security", label: "Reset bảo mật", desc: "Reset OTP, mật khẩu và thiết lập bảo mật." },
  { key: "settings-write", label: "Lưu cấu hình", desc: "Lưu thông báo, lock web và ngày áp dụng." },
  { key: "reload-data", label: "Reload data", desc: "Tăng Data version để nhân viên nhận dữ liệu mới." },
  { key: "dashboard-view", label: "Xem dashboard", desc: "Xem log tra giá, top máy và thống kê." },
];

const TOOL_ACTION_OPTIONS: Array<{ key: AdminActionKey; label: string; desc: string }> = [
  { key: "tools-pmh", label: "PMH / Pincode", desc: "Duyệt hồ sơ, nạp kho PMH và cấu hình lịch chạy." },
  { key: "tools-coming", label: "Công cụ sắp thêm", desc: "Cho phép nhìn thấy ô công cụ chờ gắn thêm." },
  { key: "tools-report", label: "Báo cáo hỗ trợ", desc: "Import/export CSV, xuất log và tạo file backup." },
  { key: "tools-telegram", label: "Thông báo Telegram", desc: "Cài bot, nhóm nhận tin và test bot cho từng công cụ." },
];

const ALL_ADMIN_ACTION_OPTIONS: Array<{ key: AdminActionKey; label: string; desc: string }> = [
  ...ADMIN_ACTION_OPTIONS,
  ...TOOL_ACTION_OPTIONS,
];

const TOOL_ACTION_KEYS = new Set(TOOL_ACTION_OPTIONS.map((item) => item.key));
const TCDM_ACTION_KEYS = new Set(ADMIN_ACTION_OPTIONS.map((item) => item.key));

const NOTICE_CONTENT_SETTING_KEYS = ["MARQUEE_MESSAGE", "FIXED_BANNER_MESSAGE"];
const PUSH_NOTIFY_SETTING_KEYS = ["PUSH_NOTIFY_MESSAGE", "PUSH_NOTIFY_VERSION"];
const HIDDEN_CLIENT_SETTING_KEYS = new Set(["PUSH_NOTIFY_VERSION"]);
const STAFF_POPUP_TRADEIN_SETTING_KEYS = [
  "STAFF_POPUP_TRADEIN_ENABLED",
  "STAFF_POPUP_TRADEIN_MESSAGE",
  "STAFF_POPUP_TRADEIN_SECONDS",
  "STAFF_POPUP_TRADEIN_VERSION",
];
const STAFF_POPUP_BUYONLY_SETTING_KEYS = [
  "STAFF_POPUP_BUYONLY_ENABLED",
  "STAFF_POPUP_BUYONLY_MESSAGE",
  "STAFF_POPUP_BUYONLY_SECONDS",
  "STAFF_POPUP_BUYONLY_VERSION",
];

const PRICE_SETTING_KEYS = ["PRICE_EFFECTIVE_FROM", "PRICE_EFFECTIVE_TO"];
const RELOAD_SETTING_KEYS = ["DATA_VERSION"];
const EMERGENCY_LOCK_SETTING_KEYS = ["SYSTEM_LOCK_MESSAGE", "SYSTEM_LOCK_ENABLED"];
const SCHEDULE_LOCK_SETTING_KEYS = [
  "SYSTEM_LOCK_SCHEDULE_ENABLED",
  "SYSTEM_LOCK_START_AT",
  "SYSTEM_LOCK_END_AT",
  "SYSTEM_LOCK_REASON",
];
const STAFF_LOCK_SETTING_KEYS = ["STAFF_PAGE_LOCKED", "STAFF_TRADEIN_LOCKED", "STAFF_BUYONLY_LOCKED"];
const CUSTOMER_LOCK_SETTING_KEYS = ["CUSTOMER_PAGE_LOCKED", "CUSTOMER_TRADEIN_LOCKED", "CUSTOMER_BUYONLY_LOCKED"];
const FIREWALL_SETTING_KEYS = [
  "FIREWALL_BLACKLIST",
  "FIREWALL_WHITELIST",
  "FIREWALL_MESSAGE",
  "FIREWALL_USER_BLACKLIST",
  "FIREWALL_USER_WHITELIST",
  "FIREWALL_USER_MESSAGE",
];

function stripHiddenClientSettings(values: Record<string, string>) {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !HIDDEN_CLIENT_SETTING_KEYS.has(key)));
}

const PERMISSION_TREE = [
  {
    title: "Quản trị vận hành TCDM",
    desc: "Các tab con trong module quản trị trang tra giá.",
    module: "tcdm",
    children: ADMIN_ACTION_OPTIONS,
  },
  {
    title: "Nội dung trang chủ",
    desc: "Các trang CMS gắn ngoài trang chủ.",
    children: ADMIN_MODULE_OPTIONS.filter((item) => item.key !== "tcdm" && item.key !== "tools").map((item) => ({
      module: item.key,
      label: item.label,
      desc: "Cho phép mở và chỉnh nội dung module này.",
    })),
  },
  {
    title: "Công cụ hỗ trợ",
    desc: "Module số 5 cho PMH/Pincode và các tool gắn thêm sau này.",
    module: "tools",
    children: TOOL_ACTION_OPTIONS,
  },
] as const;

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

function maskIpAddress(value: string, fullAccess: boolean) {
  const ip = String(value || "").trim();
  if (!ip || fullAccess) return ip || "—";

  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return parts.length > 2 ? `${parts[0]}:${parts[1]}:****` : "****";
  }

  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`;
  return "****";
}

function toDatetimeLocalInput(value: any) {
  const raw = String(value || "").trim().replace(/^'/, "");
  if (!raw) return "";

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T${isoMatch[4]}:${isoMatch[5]}`;

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})/);
  if (slashMatch) {
    const a = Number(slashMatch[1]);
    const b = Number(slashMatch[2]);
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;

    return [
      slashMatch[3],
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0"),
    ].join("-") + `T${slashMatch[4].padStart(2, "0")}:${slashMatch[5]}`;
  }

  return raw;
}

function parseAdminAccessItems(value: any) {
  const moduleKeys = new Set(ADMIN_MODULE_OPTIONS.map((item) => item.key));
  const actionKeys = new Set(
    ALL_ADMIN_ACTION_OPTIONS.map((item) => `${ADMIN_ACTION_PREFIX}${item.key}`)
  );

  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item, index, arr) => {
      const allowed = moduleKeys.has(item) || actionKeys.has(item);
      return allowed && arr.indexOf(item) === index;
    });
}

function parseAdminActionItems(value: any) {
  const actionKeys = new Set(ALL_ADMIN_ACTION_OPTIONS.map((item) => item.key));

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
      const action = ALL_ADMIN_ACTION_OPTIONS.find((item) => item.key === actionKey);
      return action ? action.label : token;
    })
    .join(" · ");
}

function TcdmAdminConsole({
  initialSettings,
  adminRole = "admin",
  adminModules = "",
  adminActions = "",
  adminHasExplicitActions = false,
}: AdminConsoleProps) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [settings, setSettings] = useState<Record<string, string>>(initialSettings);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [onlineStats, setOnlineStats] = useState<OnlineStats>(EMPTY_ONLINE_STATS);
  const [onlineSessions, setOnlineSessions] = useState<OnlineSession[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [opsHealth, setOpsHealth] = useState<OpsHealth | null>(null);
  const [opsErrors, setOpsErrors] = useState<OpsErrorLog[]>([]);
  const [opsErrorModule, setOpsErrorModule] = useState("");
  const [opsErrorFrom, setOpsErrorFrom] = useState("");
  const [opsErrorTo, setOpsErrorTo] = useState("");
  const [opsLoading, setOpsLoading] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [dashboardSource, setDashboardSource] = useState<DashboardSource>("staff");
  const [dashboardData, setDashboardData] = useState<AdminDashboard>(EMPTY_DASHBOARD);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [bulkStandbyOpen, setBulkStandbyOpen] = useState(false);
  const [bulkStandbyRoles, setBulkStandbyRoles] = useState({ user: true, mod: false });
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
  const [staffSearchInput, setStaffSearchInput] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [staffStatusFilter, setStaffStatusFilter] = useState<"ALL" | "Active" | "Standby">("ALL");
  const [staffPage, setStaffPage] = useState(1);

  const summary = staffMeta.summary || EMPTY_SUMMARY;
  const isFullAdmin = String(adminRole || "").toLowerCase() === "admin";
  const grantedModules = parseModuleList(adminModules);
  const grantedActions = parseAdminActionItems(adminActions);
  const legacyTcdmAccess = !adminHasExplicitActions && grantedModules.includes("tcdm");

  function canUseAction(action: AdminActionKey) {
    return isFullAdmin || grantedActions.includes(action) || legacyTcdmAccess;
  }

  const visibleTabs = TAB_ITEMS.filter((item) => {
    if (isFullAdmin) return true;
    if (item.key === "overview") return true;
    if (item.key === "permission") return false;
    if (item.key === "staff") {
      return canUseAction("staff-manage") || canUseAction("staff-security") || canUseAction("staff-delete");
    }
    if (item.key === "notify") return canUseAction("settings-write");
    if (item.key === "system") return canUseAction("settings-write") || canUseAction("reload-data");
    if (item.key === "dashboard") return canUseAction("dashboard-view");
    return false;
  });
  const activeTabAllowed = visibleTabs.some((item) => item.key === tab);
  const firstVisibleTab = visibleTabs[0]?.key || "overview";
  const canManageStaff = canUseAction("staff-manage");
  const canDeleteStaff = canUseAction("staff-delete");
  const canResetStaffSecurity = canUseAction("staff-security");
  const canResetStaffOtp = canResetStaffSecurity || canManageStaff;
  const canWriteSettings = canUseAction("settings-write");
  const canReloadData = canUseAction("reload-data");
  const dashboardIsCustomer = dashboardSource === "customer";
  const dashboardDeviceRanking = useMemo(() => {
    if (dashboardData.topDevices.length > 0) return dashboardData.topDevices;

    const map = new Map<string, { label: string; count: number; totalValue: number }>();

    dashboardData.recentLogs.forEach((item) => {
      const label = item.deviceLabel || "Khong ro thiet bi";
      const current = map.get(label) || { label, count: 0, totalValue: 0 };
      current.count += 1;
      current.totalValue += item.tongTien || 0;
      map.set(label, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count || b.totalValue - a.totalValue)
      .slice(0, 10);
  }, [dashboardData.recentLogs, dashboardData.topDevices]);
  const dashboardIpRanking = useMemo(() => {
    if (dashboardData.topIps.length > 0) return dashboardData.topIps;

    const map = new Map<string, { ip: string; count: number; totalValue: number }>();

    dashboardData.recentLogs.forEach((item) => {
      const ip = item.ip || "Khong ro IP";
      const current = map.get(ip) || { ip, count: 0, totalValue: 0 };
      current.count += 1;
      current.totalValue += item.tongTien || 0;
      map.set(ip, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count || b.totalValue - a.totalValue)
      .slice(0, 10);
  }, [dashboardData.recentLogs, dashboardData.topIps]);

  function isStaffAdminLocked(item: AdminStaff) {
    return !isFullAdmin && item.permission === "admin";
  }

  const lockCount = useMemo(() => {
    return [
      "SYSTEM_LOCK_ENABLED",
      "SYSTEM_LOCK_SCHEDULE_ENABLED",
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
      settings.STAFF_POPUP_TRADEIN_MESSAGE,
      settings.STAFF_POPUP_BUYONLY_MESSAGE,
    ].filter((item) => String(item || "").trim()).length;
  }, [settings]);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 2800);
  }

  function openConfirmDialog(dialog: NonNullable<ConfirmDialogState>) {
    setConfirmDialog(dialog);
  }

  async function runConfirmDialogAction() {
    const action = confirmDialog?.onConfirm;
    setConfirmDialog(null);
    await action?.();
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
      setOnlineSessions(Array.isArray(data.sessions) ? data.sessions : []);
      setOnlineLoading(false);
    } catch {
      setOnlineLoading(false);
    }
  }

  async function loadOpsHealth(options?: { silent?: boolean }) {
    if (!canUseAction("dashboard-view")) return;

    try {
      if (!options?.silent) setOpsLoading(true);

      const res = await fetch("/api/admin/ops", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Không tải được trạng thái hệ thống.");
      }

      setOpsHealth(data.health || null);
      setOpsErrors(Array.isArray(data.health?.recentErrors) ? data.health.recentErrors : []);
      setOpsLoading(false);
    } catch (err: any) {
      setOpsLoading(false);
      if (!options?.silent) showToast("error", getErrorMessage(err));
    }
  }

  async function loadOpsErrors() {
    if (!canUseAction("dashboard-view")) return;

    try {
      setOpsLoading(true);
      const params = new URLSearchParams({
        mode: "errors",
        limit: "120",
      });
      if (opsErrorModule.trim()) params.set("module", opsErrorModule.trim());
      if (opsErrorFrom) params.set("from", opsErrorFrom);
      if (opsErrorTo) params.set("to", opsErrorTo);

      const res = await fetch(`/api/admin/ops?${params.toString()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
        },
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Không tải được nhật ký lỗi.");
      }

      setOpsErrors(Array.isArray(data.errors) ? data.errors : []);
      setOpsLoading(false);
    } catch (err: any) {
      setOpsLoading(false);
      showToast("error", getErrorMessage(err));
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

      const res = await fetch(`/api/admin/dashboard?source=${dashboardSource}`, {
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

  function changeDashboardSource(source: DashboardSource) {
    if (dashboardSource === source) return;

    setDashboardSource(source);
    setDashboardData(EMPTY_DASHBOARD);
    setDashboardLoaded(false);
  }

  useEffect(() => {
    loadOnlineStats({ silent: true });
    loadOpsHealth({ silent: true });

    const timer = window.setInterval(() => {
      loadOnlineStats({ silent: true });
    }, 10000);

    return () => window.clearInterval(timer);
  }, []);

  function runCommandSearch() {
    const raw = commandInput.trim();
    const q = raw.toLowerCase();
    if (!q) return;

    const routeMap: Array<{ match: RegExp; tab: TabKey; action?: () => void }> = [
      { match: /(nhan|nhân|staff|nv|active|standby|otp|reset|delete|xoa|xóa)/i, tab: "staff" },
      { match: /(quyen|quyền|permission|mod|admin)/i, tab: "permission" },
      { match: /(thong bao|thông báo|notify|push|popup|banner)/i, tab: "notify" },
      { match: /(khoa|khóa|lock|reload|firewall|ip|tuong lua|tường lửa)/i, tab: "system" },
      { match: /(dashboard|log|health|loi|lỗi|online|session|backup)/i, tab: "dashboard", action: () => loadDashboard({ silent: true }) },
    ];

    const found = routeMap.find((item) => item.match.test(q));
    if (found && visibleTabs.some((item) => item.key === found.tab)) {
      setTab(found.tab);
      found.action?.();
      showToast("success", `Đã mở nhanh mục phù hợp cho "${raw}".`);
      return;
    }

    if (/pmh|pincode|telegram|import|export|tool|cong cu|công cụ/i.test(q)) {
      showToast("success", "Module công cụ hỗ trợ nằm ở thẻ số 05 bên ngoài khu vực quản trị TCDM.");
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
  }, [tab, staffStatusFilter, staffQuery, staffPage]);

  useEffect(() => {
    if (tab !== "dashboard") return;
    if (dashboardLoaded) return;
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, dashboardLoaded, dashboardSource]);

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

    try {
      setBusy("STANDBY_BULK");

      const data = await postJSON("/api/admin/staff", {
        action: "STANDBY_BULK",
        roles,
      });

      setBulkStandbyOpen(false);
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

  async function saveSettings(extra?: Record<string, string>, options?: { onlyKeys?: string[]; busyKey?: string }) {
    try {
      const busyKey = options?.busyKey || "settings";
      setBusy(busyKey);

      const payload = {
        ...settings,
        ...(extra || {}),
      };

      const apiPayload = options?.onlyKeys?.length
        ? options.onlyKeys.reduce<Record<string, string>>((acc, key) => {
            acc[key] = payload[key] || "";
            return acc;
          }, {})
        : { ...payload };

      ["PRICE_EFFECTIVE_FROM", "PRICE_EFFECTIVE_TO", "SYSTEM_LOCK_START_AT", "SYSTEM_LOCK_END_AT"].forEach((key) => {
        const value = String(apiPayload[key] || "").trim();
        if (value && !value.startsWith("'")) {
          apiPayload[key] = `'${value}`;
        }
      });

      const data = await postJSON("/api/admin/settings", {
        settings: apiPayload,
      });

      setSettings(stripHiddenClientSettings({ ...payload, ...(data.settings || {}) }));
      showToast("success", data.message || "Đã lưu cấu hình.");
      setBusy("");
    } catch (err: any) {
      setBusy("");
      showToast("error", getErrorMessage(err));
    }
  }

  async function reloadDataVersion() {
    const nextVersion = String(Date.now());
    await saveSettings({ DATA_VERSION: nextVersion }, { onlyKeys: RELOAD_SETTING_KEYS, busyKey: "reload-data" });
  }

  async function saveNoticeContent() {
    await saveSettings({}, { onlyKeys: NOTICE_CONTENT_SETTING_KEYS, busyKey: "notice-content" });
  }

  async function sendPushNotifyNow() {
    await saveSettings(
      { PUSH_NOTIFY_VERSION: String(Date.now()) },
      { onlyKeys: PUSH_NOTIFY_SETTING_KEYS, busyKey: "push-notify" }
    );
  }

  async function saveStaffPopup(kind: "tradein" | "buyonly") {
    const isTradein = kind === "tradein";
    await saveSettings(
      {
        [isTradein ? "STAFF_POPUP_TRADEIN_VERSION" : "STAFF_POPUP_BUYONLY_VERSION"]: String(Date.now()),
      },
      {
        onlyKeys: isTradein ? STAFF_POPUP_TRADEIN_SETTING_KEYS : STAFF_POPUP_BUYONLY_SETTING_KEYS,
        busyKey: isTradein ? "popup-tradein" : "popup-buyonly",
      }
    );
  }

  async function saveSystemSection(keys: string[], busyKey: string, extra?: Record<string, string>) {
    await saveSettings(extra, { onlyKeys: keys, busyKey });
  }

  function setSetting(key: string, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function setLockSetting(key: string, value: boolean) {
    setSettings((current) => {
      const next = { ...current, [key]: toFlag(value) };

      if (key === "STAFF_PAGE_LOCKED" && value) {
        next.STAFF_TRADEIN_LOCKED = "0";
        next.STAFF_BUYONLY_LOCKED = "0";
      }

      if (key === "CUSTOMER_PAGE_LOCKED" && value) {
        next.CUSTOMER_TRADEIN_LOCKED = "0";
        next.CUSTOMER_BUYONLY_LOCKED = "0";
      }

      return next;
    });
  }

  function applyStaffSearch() {
    setStaffPage(1);
    setStaffQuery(staffSearchInput.trim());
  }

  function ToggleRow({
    settingKey,
    title,
    desc,
    disabled = false,
  }: {
    settingKey: string;
    title: string;
    desc: string;
    disabled?: boolean;
  }) {
    const checked = isOn(settings[settingKey]);

    return (
      <label className={`adminx-toggle-row ${disabled ? "disabled" : ""}`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => setLockSetting(settingKey, e.target.checked)}
        />
        <span className="adminx-switch" aria-hidden="true"></span>
        <div>
          <b>{title}</b>
          <p>{desc}</p>
        </div>
      </label>
    );
  }

  const staffPageLockedInForm = isOn(settings.STAFF_PAGE_LOCKED);
  const customerPageLockedInForm = isOn(settings.CUSTOMER_PAGE_LOCKED);

  return (
    <section className="adminx-console">
      <style suppressHydrationWarning>{ADMINX_STYLE}</style>
      <style suppressHydrationWarning>{ADMINX_ONLINE_STYLE}</style>

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
          placeholder="Tìm nhanh: NV12345, PMH, backup, khóa trang, log lỗi..."
        />
        <button type="button" onClick={runCommandSearch}>Tìm chức năng</button>
      </div>

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

          {canUseAction("dashboard-view") && (
            <div className="adminx-ops-panel">
              <div className="adminx-ops-head">
                <div>
                  <span>System Health</span>
                  <h3>Trạng thái vận hành</h3>
                  <p>Supabase, mail, Telegram, backup, log lỗi và phiên đang hoạt động.</p>
                </div>
                <button type="button" onClick={() => loadOpsHealth()} disabled={opsLoading}>
                  {opsLoading ? "Đang kiểm tra..." : "Kiểm tra hệ thống"}
                </button>
              </div>

              <div className="adminx-health-grid">
                {[
                  { label: "Supabase", item: opsHealth?.supabase },
                  { label: "Mail", item: opsHealth?.mail },
                  { label: "Telegram", item: opsHealth?.telegram },
                ].map((entry) => (
                  <div key={entry.label} className={entry.item?.ok ? "ok" : "warn"}>
                    <span>{entry.label}</span>
                    <b>{entry.item?.ok ? "OK" : "Cần kiểm tra"}</b>
                    <p>{entry.item?.message || "Chưa tải trạng thái."}</p>
                  </div>
                ))}
                <div className={opsHealth?.backup?.lastError ? "warn" : opsHealth?.backup?.exists ? "ok" : "warn"}>
                  <span>Backup</span>
                  <b>{opsHealth?.backup?.exists ? "Đã có file" : "Chưa có file"}</b>
                  <p>{opsHealth?.backup?.updatedAtVN || opsHealth?.backup?.nextRunAtVN || "Tự chạy lúc 23:00 mỗi ngày."}</p>
                </div>
              </div>

              <div className="adminx-ops-grid">
                <article>
                  <h4>Log lỗi gần nhất</h4>
                  <div className="adminx-error-filter">
                    <input
                      value={opsErrorModule}
                      onChange={(e) => setOpsErrorModule(e.target.value)}
                      placeholder="Module: admin-pincode, frontend..."
                    />
                    <input type="date" value={opsErrorFrom} onChange={(e) => setOpsErrorFrom(e.target.value)} />
                    <input type="date" value={opsErrorTo} onChange={(e) => setOpsErrorTo(e.target.value)} />
                    <button type="button" onClick={loadOpsErrors} disabled={opsLoading}>Lọc</button>
                  </div>
                  <div className="adminx-ops-list">
                    {opsErrors.length ? (
                      opsErrors.slice(0, 8).map((item) => (
                        <div key={item.id || `${item.time}-${item.message}`}>
                          <b>{item.module || "system"}</b>
                          <span>{item.time || "—"} • {item.actor || "system"} • {maskIpAddress(item.ip, isFullAdmin)}</span>
                          <p>{item.message || "Không rõ lỗi"}</p>
                        </div>
                      ))
                    ) : (
                      <p>Chưa có lỗi mới.</p>
                    )}
                  </div>
                </article>

                <article>
                  <h4>Lịch sử backup</h4>
                  <div className="adminx-ops-list">
                    {opsHealth?.backup?.history?.length ? (
                      opsHealth.backup.history.slice(0, 7).map((item: any) => (
                        <div key={item.dailyFileName || item.createdAt}>
                          <b>{item.dailyFileName || item.fileName}</b>
                          <span>{item.createdAtVN || item.createdAt || "—"} • {formatNumber(Number(item.bytes || 0))} bytes</span>
                          <p>{item.trigger === "schedule" ? "Backup tự động" : "Backup thủ công"}</p>
                        </div>
                      ))
                    ) : (
                      <p>Chưa có lịch sử backup. Hệ thống sẽ giữ 7 bản gần nhất.</p>
                    )}
                  </div>
                </article>

                <article>
                  <h4>Phiên đang online</h4>
                  <div className="adminx-ops-list">
                    {onlineSessions.length ? (
                      onlineSessions.slice(0, 8).map((item) => (
                        <div key={item.visitorId}>
                          <b>{item.page || "unknown"} • {item.device || "Thiết bị"}</b>
                          <span>{maskIpAddress(item.ip, isFullAdmin)} • {item.lastSeenAt || "—"}</span>
                          <p>{item.path || "/"}</p>
                        </div>
                      ))
                    ) : (
                      <p>Chưa có phiên online chi tiết.</p>
                    )}
                  </div>
                </article>
              </div>
            </div>
          )}

          <div className="adminx-overview-grid">
            <div className="adminx-soft-card">
              <span>Thông báo</span>
              <b>{notifyCount} mục đang cấu hình</b>
              <p>Marquee, banner cố định, push nóng và popup SweetAlert.</p>
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
            <div className="adminx-panel-actions">
              {isFullAdmin && (
                <button
                  className="adminx-action-btn standby"
                  type="button"
                  onClick={() => {
                    setBulkStandbyRoles({ user: true, mod: false });
                    setBulkStandbyOpen(true);
                  }}
                  disabled={staffLoading || busy === "STANDBY_BULK"}
                >
                  {busy === "STANDBY_BULK" ? "Đang xử lý..." : "Standby"}
                </button>
              )}
              <button className="adminx-action-btn" type="button" onClick={() => loadStaff(staffPage)} disabled={staffLoading}>
                {staffLoading ? "Đang tải..." : "Tải lại"}
              </button>
            </div>
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
                        {item.permission === "mod" ? <span>PHẠM VI: {summarizeAdminAccess(item.modulePermissions)}</span> : null}
                        {isStaffAdminLocked(item) ? <span>MOD KHÔNG THỂ THAO TÁC ADMIN</span> : null}
                      </div>

                    </div>

                    {isStaffAdminLocked(item) ? (
                      <div className="adminx-staff-viewonly">
                        <b>Chỉ xem</b>
                        <span>Tài khoản Admin chỉ cho phép quyền Admin thao tác.</span>
                      </div>
                    ) : (
                    <div className="adminx-staff-actions">
                      <button
                        type="button"
                        className="primary"
                        disabled={!canManageStaff || busy === `ACTIVE-${item.maNV}`}
                        onClick={() => {
                          if (item.status === "Active") {
                            openConfirmDialog({
                              title: "Gửi lại Gmail Active",
                              message: `Gửi lại Gmail thông báo tài khoản đã Active cho NV ${item.maNV}?`,
                              confirmText: "Gửi mail",
                              onConfirm: () => runStaffAction("ACTIVE", item.maNV),
                            });
                            return;
                          }

                          runStaffAction("ACTIVE", item.maNV);
                        }}
                      >
                        {item.status === "Active" ? "Gửi mail Active" : "Active"}
                      </button>
                      <button
                        type="button"
                        disabled={!canManageStaff || busy === `STANDBY-${item.maNV}` || item.status === "Standby"}
                        onClick={() => runStaffAction("STANDBY", item.maNV)}
                      >
                        Standby
                      </button>
                      <button
                        type="button"
                        disabled={!canResetStaffSecurity || busy === `RESET_SECURITY-${item.maNV}`}
                        onClick={() => {
                          openConfirmDialog({
                            title: "Reset bảo mật",
                            message: `Reset tài khoản ${item.maNV}: mật khẩu về 123123, xóa bảo mật/Gmail, NEED_SETUP=1 và OTP count=0?`,
                            confirmText: "Reset",
                            danger: true,
                            onConfirm: () => runStaffAction("RESET_SECURITY", item.maNV),
                          });
                        }}
                      >
                        Reset bảo mật
                      </button>
                      <button
                        type="button"
                        disabled={!canResetStaffOtp || busy === `RESET_OTP_COUNT-${item.maNV}`}
                        onClick={() => runStaffAction("RESET_OTP_COUNT", item.maNV)}
                      >
                        Reset OTP
                      </button>
                      <button
                        type="button"
                        className="danger"
                        disabled={!canDeleteStaff || busy === `DELETE-${item.maNV}`}
                        onClick={() => openDeleteStaffDialog(item)}
                      >
                        Xóa nhân viên
                      </button>
                    </div>
                    )}
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
                      <span>PHẠM VI: {summarizeAdminAccess(item.modulePermissions)}</span>
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
              <p>Chỉ áp dụng cho trang nhân viên. Trang khách hàng không nhận push hoặc popup nếu không có yêu cầu riêng.</p>
            </div>
            <button className="adminx-action-btn" type="button" onClick={saveNoticeContent} disabled={!canWriteSettings || busy === "notice-content"}>
              {busy === "notice-content" ? "Đang lưu..." : "Lưu nội dung trang nhân viên"}
            </button>
          </div>

          <div className="adminx-notify-stack">
            <section className="adminx-notify-card">
              <div className="adminx-notify-card-head">
                <div>
                  <h3>Thông báo trang nhân viên</h3>
                  <p>Marquee và box thông báo quan trọng trong trang tra giá nhân viên.</p>
                </div>
                <button type="button" onClick={saveNoticeContent} disabled={!canWriteSettings || busy === "notice-content"}>
                  {busy === "notice-content" ? "Đang lưu..." : "Lưu nội dung"}
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
              </div>
            </section>

            <section className="adminx-notify-card adminx-hot-push-card">
              <div className="adminx-notify-card-head">
                <div>
                  <h3>Phát thông báo nóng (PUSH)</h3>
                  <p>Nội dung trượt từ trên xuống, giữ 30 giây rồi tự tắt.</p>
                </div>
              </div>
              <div className="adminx-push-now-row">
                <input
                  value={settings.PUSH_NOTIFY_MESSAGE || ""}
                  onChange={(e) => setSetting("PUSH_NOTIFY_MESSAGE", e.target.value)}
                  placeholder="Nhập tin nhắn khẩn gửi tới màn hình toàn bộ nhân viên..."
                />
                <button type="button" onClick={sendPushNotifyNow} disabled={!canWriteSettings || busy === "push-notify"}>
                  {busy === "push-notify" ? "Đang gửi..." : "Gửi thông báo ngay"}
                </button>
              </div>
            </section>

            <section className="adminx-notify-card adminx-popup-config-card">
              <div className="adminx-popup-card-head">
                <div>
                  <h3>Popup &quot;Thu Cũ Đổi Mới&quot;</h3>
                  <p>Hiển thị dạng SweetAlert giữa màn hình khi nhân viên vào luồng Thu cũ đổi mới.</p>
                </div>
                <label className="adminx-popup-toggle">
                  <input
                    type="checkbox"
                    checked={isOn(settings.STAFF_POPUP_TRADEIN_ENABLED)}
                    onChange={(e) => setSetting("STAFF_POPUP_TRADEIN_ENABLED", toFlag(e.target.checked))}
                  />
                  <span className="adminx-switch" aria-hidden="true"></span>
                </label>
              </div>
              <label className="adminx-popup-field">
                <span>Nội dung thông báo (nên ngắn gọn)</span>
                <textarea
                  value={settings.STAFF_POPUP_TRADEIN_MESSAGE || ""}
                  onChange={(e) => setSetting("STAFF_POPUP_TRADEIN_MESSAGE", e.target.value)}
                  placeholder="VD: Toàn bộ iPhone thu vào sẽ không có trợ giá..."
                />
              </label>
              <label className="adminx-popup-time">
                <span>Tự tắt sau</span>
                <input
                  inputMode="numeric"
                  value={settings.STAFF_POPUP_TRADEIN_SECONDS || "10"}
                  onChange={(e) => setSetting("STAFF_POPUP_TRADEIN_SECONDS", e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="10"
                />
                <small>Nhập 10 = 10 giây, nhập 10000 = 10 giây theo cấu hình cũ.</small>
              </label>
              <button
                type="button"
                className="adminx-popup-save"
                onClick={() => saveStaffPopup("tradein")}
                disabled={!canWriteSettings || busy === "popup-tradein"}
              >
                {busy === "popup-tradein" ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
            </section>

            <section className="adminx-notify-card adminx-popup-config-card">
              <div className="adminx-popup-card-head">
                <div>
                  <h3>Popup &quot;Thu Cũ Không Đổi Mới&quot;</h3>
                  <p>Hiển thị dạng SweetAlert giữa màn hình khi nhân viên vào luồng Chỉ thu cũ.</p>
                </div>
                <label className="adminx-popup-toggle">
                  <input
                    type="checkbox"
                    checked={isOn(settings.STAFF_POPUP_BUYONLY_ENABLED)}
                    onChange={(e) => setSetting("STAFF_POPUP_BUYONLY_ENABLED", toFlag(e.target.checked))}
                  />
                  <span className="adminx-switch" aria-hidden="true"></span>
                </label>
              </div>
              <label className="adminx-popup-field">
                <span>Nội dung thông báo (nên ngắn gọn)</span>
                <textarea
                  value={settings.STAFF_POPUP_BUYONLY_MESSAGE || ""}
                  onChange={(e) => setSetting("STAFF_POPUP_BUYONLY_MESSAGE", e.target.value)}
                  placeholder="VD: Chương trình OFF đến khi có thông báo mới..."
                />
              </label>
              <label className="adminx-popup-time">
                <span>Tự tắt sau</span>
                <input
                  inputMode="numeric"
                  value={settings.STAFF_POPUP_BUYONLY_SECONDS || "10"}
                  onChange={(e) => setSetting("STAFF_POPUP_BUYONLY_SECONDS", e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="10"
                />
                <small>Nhập 10 = 10 giây, nhập 10000 = 10 giây theo cấu hình cũ.</small>
              </label>
              <button
                type="button"
                className="adminx-popup-save"
                onClick={() => saveStaffPopup("buyonly")}
                disabled={!canWriteSettings || busy === "popup-buyonly"}
              >
                {busy === "popup-buyonly" ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
            </section>
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
          </div>

          <div className={`adminx-system-sections ${canWriteSettings ? "" : "reload-only"}`}>
            <section className="adminx-system-card">
              <div className="adminx-system-card-head">
                <span>01</span>
                <div>
                  <h3>Thời gian áp dụng bảng giá</h3>
                  <p>Hiển thị mốc áp dụng trên trang nhân viên và khách hàng.</p>
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
              </div>
              <div className="adminx-section-actions">
                <button
                  className="adminx-section-save"
                  type="button"
                  onClick={() => saveSystemSection(PRICE_SETTING_KEYS, "price-settings")}
                  disabled={!canWriteSettings || busy === "price-settings"}
                >
                  {busy === "price-settings" ? "Đang lưu..." : "Lưu thời gian áp dụng"}
                </button>
              </div>
            </section>

            <section className="adminx-system-card adminx-reload-card">
              <div className="adminx-system-card-head">
                <span>02</span>
                <div>
                  <h3>Reload dữ liệu</h3>
                  <p>Tăng phiên bản để người đang mở web thấy thông báo cập nhật và tự reload.</p>
                </div>
              </div>
              <div className="adminx-form-grid">
                <label>
                  <span>Data version</span>
                  <input value={settings.DATA_VERSION || "1"} readOnly />
                </label>
              </div>
              <div className="adminx-section-actions">
                <button
                  className="adminx-section-save"
                  type="button"
                  onClick={reloadDataVersion}
                  disabled={!canReloadData || busy === "reload-data"}
                >
                  {busy === "reload-data" ? "Đang reload..." : "Reload data"}
                </button>
              </div>
            </section>

            <section className="adminx-system-card">
              <div className="adminx-system-card-head">
                <span>03</span>
                <div>
                  <h3>Lock web khẩn cấp</h3>
                  <p>Bật ngay màn hình khóa toàn hệ thống khi có sự cố hoặc cập nhật gấp.</p>
                </div>
              </div>
              <div className="adminx-form-grid">
                <label>
                  <span>Thông báo lock toàn màn hình</span>
                  <input
                    value={settings.SYSTEM_LOCK_MESSAGE || ""}
                    onChange={(e) => setSetting("SYSTEM_LOCK_MESSAGE", e.target.value)}
                    placeholder="HỆ THỐNG ĐANG CẬP NHẬT KHẨN."
                  />
                </label>
              </div>
              <div className="adminx-lock-grid compact">
                <ToggleRow settingKey="SYSTEM_LOCK_ENABLED" title="Lock web khẩn cấp" desc="Hiển thị toàn màn hình cập nhật khẩn." />
              </div>
              <div className="adminx-section-actions">
                <button
                  className="adminx-section-save"
                  type="button"
                  onClick={() => saveSystemSection(EMERGENCY_LOCK_SETTING_KEYS, "emergency-lock")}
                  disabled={!canWriteSettings || busy === "emergency-lock"}
                >
                  {busy === "emergency-lock" ? "Đang lưu..." : "Lưu lock khẩn cấp"}
                </button>
              </div>
            </section>

            <section className="adminx-system-card">
              <div className="adminx-system-card-head">
                <span>04</span>
                <div>
                  <h3>Khóa theo lịch</h3>
                  <p>Tự khóa khi đến giờ bắt đầu và mở lại sau giờ kết thúc.</p>
                </div>
              </div>
              <div className="adminx-form-grid">
                <label>
                  <span>Giờ bắt đầu khóa</span>
                  <input
                    type="datetime-local"
                    value={toDatetimeLocalInput(settings.SYSTEM_LOCK_START_AT)}
                    onChange={(e) => setSetting("SYSTEM_LOCK_START_AT", e.target.value)}
                  />
                </label>
                <label>
                  <span>Giờ kết thúc khóa</span>
                  <input
                    type="datetime-local"
                    value={toDatetimeLocalInput(settings.SYSTEM_LOCK_END_AT)}
                    onChange={(e) => setSetting("SYSTEM_LOCK_END_AT", e.target.value)}
                  />
                </label>
                <label className="adminx-form-wide">
                  <span>Lý do khóa theo lịch</span>
                  <textarea
                    value={settings.SYSTEM_LOCK_REASON || ""}
                    onChange={(e) => setSetting("SYSTEM_LOCK_REASON", e.target.value)}
                    placeholder="VD: Hệ thống tạm khóa để cập nhật bảng giá và bảo trì dữ liệu."
                  />
                </label>
              </div>
              <div className="adminx-lock-grid compact">
                <ToggleRow settingKey="SYSTEM_LOCK_SCHEDULE_ENABLED" title="Khóa theo lịch" desc="Dùng khung giờ đã cài ở trên." />
              </div>
              <div className="adminx-section-actions">
                <button
                  className="adminx-section-save"
                  type="button"
                  onClick={() => saveSystemSection(SCHEDULE_LOCK_SETTING_KEYS, "schedule-lock")}
                  disabled={!canWriteSettings || busy === "schedule-lock"}
                >
                  {busy === "schedule-lock" ? "Đang lưu..." : "Lưu khóa theo lịch"}
                </button>
              </div>
            </section>

            <section className="adminx-system-card">
              <div className="adminx-system-card-head">
                <span>05</span>
                <div>
                  <h3>Khóa trang nhân viên</h3>
                  <p>Chặn toàn bộ trang nhân viên hoặc khóa từng tab nghiệp vụ.</p>
                </div>
              </div>
              <div className="adminx-lock-grid">
                <ToggleRow settingKey="STAFF_PAGE_LOCKED" title="Khóa trang nhân viên" desc="Chặn truy cập cổng tra giá nhân viên." />
                <ToggleRow
                  settingKey="STAFF_TRADEIN_LOCKED"
                  title="Khóa nhân viên - Thu cũ đổi mới"
                  desc="Khóa tab Thu cũ đổi mới trên trang nhân viên."
                  disabled={staffPageLockedInForm}
                />
                <ToggleRow
                  settingKey="STAFF_BUYONLY_LOCKED"
                  title="Khóa nhân viên - Chỉ thu cũ"
                  desc="Khóa tab Chỉ thu cũ trên trang nhân viên."
                  disabled={staffPageLockedInForm}
                />
              </div>
              <div className="adminx-lock-help">
                Khóa trang nhân viên sẽ làm mờ luồng Nhân viên ở trang chủ/trang chọn bảng giá và chặn truy cập hẳn.
                Khóa từng tab con chỉ khóa đúng tab nghiệp vụ bên trong tool, nhân viên vẫn vào được trang tra giá.
              </div>
              <div className="adminx-section-actions">
                <button
                  className="adminx-section-save"
                  type="button"
                  onClick={() => saveSystemSection(STAFF_LOCK_SETTING_KEYS, "staff-locks")}
                  disabled={!canWriteSettings || busy === "staff-locks"}
                >
                  {busy === "staff-locks" ? "Đang lưu..." : "Lưu khóa nhân viên"}
                </button>
              </div>
            </section>

            <section className="adminx-system-card">
              <div className="adminx-system-card-head">
                <span>06</span>
                <div>
                  <h3>Khóa trang khách hàng</h3>
                  <p>Chặn trang khách hàng hoặc khóa từng chế độ tra giá cho khách.</p>
                </div>
              </div>
              <div className="adminx-lock-grid">
                <ToggleRow settingKey="CUSTOMER_PAGE_LOCKED" title="Khóa trang khách hàng" desc="Chặn truy cập trang khách hàng cá nhân." />
                <ToggleRow
                  settingKey="CUSTOMER_TRADEIN_LOCKED"
                  title="Khóa khách - Thu cũ đổi mới"
                  desc="Khóa tab Thu cũ đổi mới trên trang khách hàng."
                  disabled={customerPageLockedInForm}
                />
                <ToggleRow
                  settingKey="CUSTOMER_BUYONLY_LOCKED"
                  title="Khóa khách - Chỉ thu cũ"
                  desc="Khóa tab Chỉ thu cũ trên trang khách hàng."
                  disabled={customerPageLockedInForm}
                />
              </div>
              <div className="adminx-lock-help">
                Khóa trang khách hàng sẽ làm mờ luồng Khách hàng ở trang chủ/trang chọn bảng giá và chặn truy cập hẳn.
                Khóa từng tab con chỉ khóa đúng chế độ tra giá bên trong trang khách hàng.
              </div>
              <div className="adminx-section-actions">
                <button
                  className="adminx-section-save"
                  type="button"
                  onClick={() => saveSystemSection(CUSTOMER_LOCK_SETTING_KEYS, "customer-locks")}
                  disabled={!canWriteSettings || busy === "customer-locks"}
                >
                  {busy === "customer-locks" ? "Đang lưu..." : "Lưu khóa khách hàng"}
                </button>
              </div>
            </section>

            <section className="adminx-system-card adminx-firewall-card">
              <div className="adminx-system-card-head">
                <span>07</span>
                <div>
                  <h3>Hệ thống tường lửa IP</h3>
                  <p>Chặn hoặc chỉ cho phép IP được cấu hình truy cập trang tra giá nhân viên và khách hàng.</p>
                </div>
              </div>

              <div className="adminx-firewall-panel">
                <label>
                  <span>Blacklist (chặn IP | lý do)</span>
                  <textarea
                    value={settings.FIREWALL_BLACKLIST || ""}
                    onChange={(e) => setSetting("FIREWALL_BLACKLIST", e.target.value)}
                    placeholder={"42.113.79.11 | Truy cập bất thường\n183.80.38.199 | Spam tra giá"}
                  />
                </label>
                <label>
                  <span>Whitelist (chỉ cho IP này vào)</span>
                  <textarea
                    value={settings.FIREWALL_WHITELIST || ""}
                    onChange={(e) => setSetting("FIREWALL_WHITELIST", e.target.value)}
                    placeholder={"Nếu ô này có dữ liệu, toàn bộ IP khác bên ngoài danh sách sẽ bị chặn.\nVD: 113.190.25.10"}
                  />
                </label>
                <label className="adminx-firewall-message">
                  <span>Nội dung hiển thị khi bị chặn</span>
                  <input
                    value={settings.FIREWALL_MESSAGE || ""}
                    onChange={(e) => setSetting("FIREWALL_MESSAGE", e.target.value)}
                    placeholder="IP của bạn không được phép truy cập hệ thống tra giá."
                  />
                </label>
              </div>

              <div className="adminx-firewall-panel adminx-firewall-user-panel">
                <label>
                  <span>Blacklist User (chặn user | lý do)</span>
                  <textarea
                    value={settings.FIREWALL_USER_BLACKLIST || ""}
                    onChange={(e) => setSetting("FIREWALL_USER_BLACKLIST", e.target.value)}
                    placeholder={"NV36964 | Tạm khóa truy cập\n12345 | Spam tra giá"}
                  />
                </label>
                <label>
                  <span>Whitelist User (chỉ user này vào)</span>
                  <textarea
                    value={settings.FIREWALL_USER_WHITELIST || ""}
                    onChange={(e) => setSetting("FIREWALL_USER_WHITELIST", e.target.value)}
                    placeholder={"Nếu ô này có dữ liệu, toàn bộ user khác sẽ bị chặn.\nVD: NV36964"}
                  />
                </label>
                <label className="adminx-firewall-message">
                  <span>Nội dung hiển thị khi user bị chặn</span>
                  <input
                    value={settings.FIREWALL_USER_MESSAGE || ""}
                    onChange={(e) => setSetting("FIREWALL_USER_MESSAGE", e.target.value)}
                    placeholder="Tài khoản của bạn không được phép truy cập hệ thống tra giá."
                  />
                </label>
              </div>

              <div className="adminx-lock-help">
                Blacklist chặn đúng IP/User, có thể ghi kèm lý do bằng dấu |. Whitelist nếu có dữ liệu sẽ chuyển sang chế độ chỉ cho các IP/User trong danh sách truy cập.
              </div>

              <div className="adminx-section-actions">
                <button
                  className="adminx-section-save"
                  type="button"
                  onClick={() => saveSystemSection(FIREWALL_SETTING_KEYS, "firewall-settings")}
                  disabled={!canWriteSettings || busy === "firewall-settings"}
                >
                  {busy === "firewall-settings" ? "Đang lưu..." : "Lưu tường lửa IP/User"}
                </button>
              </div>
            </section>
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
            <div className="adminx-dashboard-head-actions">
              <div className="adminx-dashboard-source-switch" role="tablist" aria-label="Chọn nguồn dashboard">
                <button
                  type="button"
                  className={dashboardSource === "staff" ? "active" : ""}
                  onClick={() => changeDashboardSource("staff")}
                  disabled={dashboardLoading}
                >
                  Nhân viên
                </button>
                <button
                  type="button"
                  className={dashboardSource === "customer" ? "active" : ""}
                  onClick={() => changeDashboardSource("customer")}
                  disabled={dashboardLoading}
                >
                  Khách hàng
                </button>
              </div>
              <button className="adminx-action-btn" type="button" onClick={() => loadDashboard()} disabled={dashboardLoading}>
                {dashboardLoading ? "Đang tải..." : dashboardLoaded ? "Tải lại" : "Tải dashboard"}
              </button>
            </div>
          </div>

          <div className="adminx-metric-grid adminx-dashboard-metrics">
            <div className="adminx-metric-card dark">
              <span>Tổng lượt log</span>
              <b>{formatNumber(dashboardData.totalLogs)}</b>
              <p>Số lượt thao tác tra giá đã ghi nhận.</p>
            </div>
            <div className="adminx-metric-card">
              <span>Tổng giá trị</span>
              <b>{money(dashboardData.totalValue)}</b>
              <p>Tổng tiền khách nhận trong các log gần nhất.</p>
            </div>
            <div className="adminx-metric-card">
              <span>{dashboardIsCustomer ? "Thiết bị" : "Nhân viên"}</span>
              <b>{formatNumber(dashboardIsCustomer ? dashboardDeviceRanking.length : dashboardData.topStaff.length)}</b>
              <p>
                {dashboardIsCustomer
                  ? "Số nhóm thiết bị khách hàng phát sinh log gần đây."
                  : "Số nhân viên có phát sinh log trong dữ liệu tải về."}
              </p>
            </div>
            <div className="adminx-metric-card">
              <span>{dashboardIsCustomer ? "IP gần đây" : "Siêu thị"}</span>
              <b>{formatNumber(dashboardIsCustomer ? dashboardIpRanking.length : dashboardData.topStores.length)}</b>
              <p>
                {dashboardIsCustomer
                  ? "Số IP khách hàng có phát sinh log gần đây."
                  : "Số siêu thị có phát sinh log tra giá."}
              </p>
            </div>
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
              <h3>{dashboardIsCustomer ? "Thiết bị khách dùng" : "Top nhân viên tra giá"}</h3>
              <div className="adminx-ranking-list">
                {dashboardIsCustomer ? (
                  dashboardDeviceRanking.length === 0 ? (
                    <p>Chưa có dữ liệu.</p>
                  ) : (
                    dashboardDeviceRanking.map((item, index) => (
                      <div key={`${item.label}-${index}`}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <b>{item.label}</b>
                        <em>{item.count} lượt · {money(item.totalValue)}</em>
                      </div>
                    ))
                  )
                ) : dashboardData.topStaff.length === 0 ? (
                  <p>Chưa có dữ liệu.</p>
                ) : (
                  dashboardData.topStaff.map((item, index) => (
                    <div key={`${item.maNV}-${index}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <b>{item.staffName || `NV ${item.maNV}`}</b>
                      <em>{item.count} lượt · {money(item.totalValue)}</em>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="adminx-analytics-card">
              <h3>{dashboardIsCustomer ? "IP khách phát sinh log" : "Top siêu thị phát sinh log"}</h3>
              <div className="adminx-ranking-list">
                {dashboardIsCustomer ? (
                  dashboardIpRanking.length === 0 ? (
                    <p>Chưa có dữ liệu.</p>
                  ) : (
                    dashboardIpRanking.map((item, index) => (
                      <div key={`${item.ip}-${index}`}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <b>{maskIpAddress(item.ip, isFullAdmin)}</b>
                        <em>{item.count} lượt · {money(item.totalValue)}</em>
                      </div>
                    ))
                  )
                ) : dashboardData.topStores.length === 0 ? (
                  <p>Chưa có dữ liệu.</p>
                ) : (
                  dashboardData.topStores.map((item, index) => (
                    <div key={`${item.maST}-${index}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <b>ST {item.maST || "Không rõ"}</b>
                      <em>{item.count} lượt · {money(item.totalValue)}</em>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="adminx-analytics-card">
              <h3>Lượt tra giá theo ngày</h3>
              <div className="adminx-ranking-list">
                {dashboardData.dailyLogs.length === 0 ? (
                  <p>Chưa có dữ liệu.</p>
                ) : (
                  dashboardData.dailyLogs.map((item, index) => (
                    <div key={`${item.day}-${index}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <b>{item.day}</b>
                      <em>{item.count} lượt</em>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="adminx-analytics-card">
              <h3>Loại thao tác</h3>
              <div className="adminx-ranking-list">
                {dashboardData.actionCounts.length === 0 ? (
                  <p>Chưa có dữ liệu.</p>
                ) : (
                  dashboardData.actionCounts.map((item, index) => (
                    <div key={`${item.action}-${index}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <b>{item.action}</b>
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
                        {item.time} • {dashboardIsCustomer ? "Khách hàng" : `NV ${item.maNV}`} • {item.action} • {money(item.tongTien)}
                      </span>
                      <small className="adminx-log-meta">
                        <em>{item.deviceLabel || "Không rõ"}</em>
                        <em>{maskIpAddress(item.ip, isFullAdmin)}</em>
                        <em>{item.networkType || "Không rõ mạng"}</em>
                      </small>
                    </div>
                  ))
                )}
              </div>
            </div>
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

            <div className="adminx-confirm-actions">
              <button type="button" className="ghost" onClick={() => setBulkStandbyOpen(false)} disabled={busy === "STANDBY_BULK"}>
                Hủy
              </button>
              <button
                type="button"
                className="danger"
                onClick={runBulkStandby}
                disabled={busy === "STANDBY_BULK" || (!bulkStandbyRoles.user && !bulkStandbyRoles.mod)}
              >
                {busy === "STANDBY_BULK" ? "Đang áp dụng..." : "Áp dụng"}
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

      {confirmDialog && (
        <div className="adminx-confirm-layer" role="alertdialog" aria-modal="true" aria-labelledby="adminConfirmTitle">
          <div className="adminx-confirm-card">
            <span>{confirmDialog.danger ? "Cần xác nhận" : "Xác nhận thao tác"}</span>
            <h3 id="adminConfirmTitle">{confirmDialog.title}</h3>
            <p>{confirmDialog.message}</p>
            <div>
              <button type="button" className="ghost" onClick={() => setConfirmDialog(null)}>
                Hủy
              </button>
              <button
                type="button"
                className={confirmDialog.danger ? "danger" : "primary"}
                onClick={runConfirmDialogAction}
              >
                {confirmDialog.confirmText || "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
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
.adminx-inline-actions button,
.adminx-filter-bar button,
.adminx-pagination button,
.adminx-staff-actions button,
.adminx-section-save {
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
.adminx-staff-actions button:disabled,
.adminx-section-save:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.adminx-button-stack {
  display: flex;
  gap: 8px;
}

.adminx-button-stack.no-system-save .adminx-action-btn:not(.secondary),
.adminx-button-stack.no-reload .adminx-action-btn.secondary {
  display: none;
}

.adminx-dashboard-head-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.adminx-dashboard-source-switch {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.adminx-dashboard-source-switch button {
  min-height: 36px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  font-size: 11px;
  line-height: 1;
  font-weight: 950;
  cursor: pointer;
}

.adminx-dashboard-source-switch button.active {
  background: #07111f;
  color: #ffd400;
  box-shadow: 0 10px 22px rgba(15, 23, 42, .12);
}

.adminx-dashboard-source-switch button:disabled {
  opacity: .55;
  cursor: wait;
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

.adminx-form-grid {
  grid-template-columns: repeat(2, 1fr);
}

.adminx-form-wide {
  grid-column: 1 / -1;
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

.adminx-notify-stack {
  display: grid;
  gap: 14px;
}

.adminx-notify-card {
  padding: 18px;
  border-radius: 24px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 16px 42px rgba(15, 23, 42, .06);
}

.adminx-notify-card-head,
.adminx-popup-card-head {
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.adminx-notify-card-head h3,
.adminx-popup-card-head h3 {
  margin: 0;
  color: #0f172a;
  font-size: 16px;
  line-height: 1.15;
  font-weight: 1000;
  letter-spacing: -.02em;
}

.adminx-notify-card-head p,
.adminx-popup-card-head p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.42;
  font-weight: 800;
}

.adminx-hot-push-card {
  background: linear-gradient(135deg, #ffffff, #f8fbff);
}

.adminx-push-now-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.adminx-push-now-row input {
  width: 100%;
  min-height: 46px;
  border-radius: 18px;
  border: 1px solid #dbe3ef;
  background: #f8fafc;
  padding: 0 14px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 850;
}

.adminx-push-now-row button,
.adminx-popup-save,
.adminx-notify-card-head button {
  min-height: 44px;
  border: 0;
  border-radius: 16px;
  background: #dbeafe;
  color: #2563eb;
  font-size: 12px;
  font-weight: 1000;
  cursor: pointer;
}

.adminx-push-now-row button,
.adminx-popup-save {
  width: 100%;
}

.adminx-popup-config-card {
  display: grid;
  gap: 14px;
}

.adminx-popup-toggle {
  display: inline-grid;
  cursor: pointer;
}

.adminx-popup-toggle input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.adminx-popup-toggle input:checked + .adminx-switch {
  background: #22c55e;
}

.adminx-popup-toggle input:checked + .adminx-switch::after {
  transform: translateX(20px);
}

.adminx-popup-field,
.adminx-popup-time {
  display: grid;
  gap: 8px;
}

.adminx-popup-field > span,
.adminx-popup-time > span {
  color: #64748b;
  font-size: 10px;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-popup-field textarea {
  min-height: 90px;
  border-radius: 18px;
  border: 1px solid #dbe3ef;
  background: #f8fafc;
  padding: 14px;
  color: #0f172a;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 850;
  resize: vertical;
}

.adminx-popup-time {
  grid-template-columns: auto 120px 1fr;
  align-items: center;
}

.adminx-popup-time input {
  min-height: 44px;
  border-radius: 16px;
  border: 1px solid #dbe3ef;
  background: #f8fafc;
  padding: 0 14px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 850;
}

.adminx-popup-time small {
  color: #64748b;
  font-size: 11px;
  line-height: 1.3;
  font-weight: 800;
}

.adminx-section-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.adminx-section-save {
  width: min(100%, 320px);
}

.adminx-system-sections {
  display: grid;
  gap: 12px;
}

.adminx-system-sections.reload-only .adminx-system-card:not(.adminx-reload-card) {
  display: none;
}

.adminx-system-card {
  padding: 14px;
  border-radius: 22px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 12px 30px rgba(15, 23, 42, .045);
}

.adminx-system-card-head {
  margin-bottom: 12px;
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 10px;
  align-items: start;
}

.adminx-system-card-head > span {
  width: 34px;
  height: 34px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  background: #0f172a;
  color: #ffd400;
  font-size: 11px;
  font-weight: 1000;
}

.adminx-system-card h3 {
  margin: 0;
  color: #0f172a;
  font-size: 17px;
  line-height: 1.15;
  font-weight: 1000;
  letter-spacing: -.02em;
}

.adminx-system-card p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
  font-weight: 800;
}

.adminx-lock-grid {
  margin-top: 14px;
  grid-template-columns: repeat(2, 1fr);
}

.adminx-lock-grid.compact {
  grid-template-columns: 1fr;
}

.adminx-lock-help {
  margin-top: 10px;
  padding: 11px 12px;
  border-radius: 16px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 12px;
  line-height: 1.45;
  font-weight: 850;
}

.adminx-firewall-card {
  background:
    radial-gradient(circle at 100% 0%, rgba(14, 165, 233, .16), transparent 34%),
    #ffffff;
}

.adminx-firewall-panel {
  padding: 16px;
  border-radius: 22px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  background: #020617;
  border: 1px solid #0f172a;
}

.adminx-firewall-user-panel {
  margin-top: 12px;
  background: #111827;
}

.adminx-firewall-panel label {
  display: grid;
  gap: 8px;
}

.adminx-firewall-panel label > span {
  color: #94a3b8;
  font-size: 10px;
  line-height: 1.1;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-firewall-panel textarea,
.adminx-firewall-panel input {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, .28);
  border-radius: 18px;
  background: rgba(248, 250, 252, .92);
  color: #0f172a;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 850;
}

.adminx-firewall-panel textarea {
  min-height: 118px;
  padding: 14px;
  resize: vertical;
}

.adminx-firewall-panel input {
  min-height: 48px;
  padding: 0 14px;
}

.adminx-firewall-message {
  grid-column: 1 / -1;
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

.adminx-toggle-row.disabled {
  opacity: .54;
  cursor: not-allowed;
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

.adminx-dashboard-metrics {
  margin-bottom: 10px;
}

.adminx-dashboard-metrics .adminx-metric-card b {
  font-size: 24px;
  line-height: 1.1;
  letter-spacing: 0;
  word-break: break-word;
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

.adminx-log-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 3px;
}

.adminx-log-meta em {
  width: fit-content;
  padding: 5px 8px;
  border-radius: 999px;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  color: #334155;
  font-size: 10px;
  line-height: 1;
  font-style: normal;
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

  .adminx-metric-grid,
  .adminx-overview-grid,
  .adminx-staff-summary,
  .adminx-form-grid,
  .adminx-lock-grid,
  .adminx-firewall-panel,
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

  .adminx-notify-card-head,
  .adminx-popup-card-head {
    align-items: start;
  }

  .adminx-popup-time {
    grid-template-columns: 1fr;
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

.adminx-command-search button,
.adminx-ops-head button {
  border: 0;
  border-radius: 16px;
  background: #ffd400;
  color: #07111f;
  font-size: 11px;
  font-weight: 1000;
  cursor: pointer;
}

.adminx-command-search button:disabled,
.adminx-ops-head button:disabled {
  opacity: .62;
  cursor: wait;
}

.adminx-ops-panel {
  margin-top: 14px;
  padding: 16px;
  border-radius: 26px;
  background: #07111f;
  border: 1px solid rgba(255, 212, 0, .28);
  box-shadow: 0 18px 46px rgba(15, 23, 42, .14);
}

.adminx-ops-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.adminx-ops-head span {
  display: inline-flex;
  width: fit-content;
  padding: 7px 10px;
  border-radius: 999px;
  background: #ffd400;
  color: #07111f;
  font-size: 9.5px;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-ops-head h3 {
  margin-top: 10px;
  color: #ffffff;
  font-size: 28px;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: -.04em;
}

.adminx-ops-head p {
  margin-top: 6px;
  color: rgba(255, 255, 255, .68);
  font-size: 12px;
  line-height: 1.35;
  font-weight: 800;
}

.adminx-ops-head button {
  min-height: 40px;
  padding: 0 13px;
}

.adminx-health-grid,
.adminx-ops-grid {
  margin-top: 14px;
  display: grid;
  gap: 10px;
}

.adminx-health-grid {
  grid-template-columns: repeat(4, 1fr);
}

.adminx-health-grid div,
.adminx-ops-grid article {
  border-radius: 18px;
  background: rgba(255, 255, 255, .08);
  border: 1px solid rgba(255, 255, 255, .12);
  padding: 12px;
}

.adminx-health-grid div.ok {
  border-color: rgba(34, 197, 94, .42);
}

.adminx-health-grid div.warn {
  border-color: rgba(248, 113, 113, .48);
}

.adminx-health-grid span,
.adminx-ops-grid h4 {
  display: block;
  color: #ffd400;
  font-size: 10px;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.adminx-health-grid b {
  display: block;
  margin-top: 10px;
  color: #ffffff;
  font-size: 19px;
  line-height: 1;
  font-weight: 1000;
}

.adminx-health-grid p,
.adminx-ops-list p {
  margin-top: 8px;
  color: rgba(255, 255, 255, .68);
  font-size: 11.5px;
  line-height: 1.35;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.adminx-ops-grid {
  grid-template-columns: repeat(3, 1fr);
}

.adminx-ops-list {
  margin-top: 10px;
  display: grid;
  gap: 8px;
  max-height: 260px;
  overflow: auto;
  padding-right: 2px;
}

.adminx-error-filter {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr 112px 112px 56px;
  gap: 6px;
}

.adminx-error-filter input,
.adminx-error-filter button {
  min-height: 34px;
  border-radius: 11px;
  border: 1px solid rgba(255, 255, 255, .14);
  background: rgba(255, 255, 255, .09);
  color: #ffffff;
  padding: 0 9px;
  font-size: 10.5px;
  font-weight: 850;
  outline: none;
}

.adminx-error-filter input::placeholder {
  color: rgba(255, 255, 255, .48);
}

.adminx-error-filter button {
  background: #ffd400;
  color: #07111f;
  border-color: #ffd400;
  font-weight: 1000;
  cursor: pointer;
}

.adminx-ops-list div {
  padding: 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, .08);
  border: 1px solid rgba(255, 255, 255, .1);
}

.adminx-ops-list b {
  display: block;
  color: #ffffff;
  font-size: 12px;
  line-height: 1.25;
  font-weight: 1000;
  overflow-wrap: anywhere;
}

.adminx-ops-list span {
  display: block;
  margin-top: 5px;
  color: rgba(255, 255, 255, .58);
  font-size: 10.5px;
  line-height: 1.3;
  font-weight: 850;
}

@media screen and (max-width: 560px) {
  .adminx-command-search {
    grid-template-columns: 1fr;
  }

  .adminx-online-head {
    display: grid;
  }

  .adminx-online-grid {
    grid-template-columns: 1fr;
  }

  .adminx-ops-head,
  .adminx-ops-grid {
    display: grid;
  }

  .adminx-health-grid,
  .adminx-ops-grid {
    grid-template-columns: 1fr;
  }

  .adminx-error-filter {
    grid-template-columns: 1fr 1fr;
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
.admin-saas-page {
  background:
    linear-gradient(90deg, rgba(15,23,42,.035) 1px, transparent 1px),
    linear-gradient(180deg, rgba(15,23,42,.035) 1px, transparent 1px),
    linear-gradient(180deg, #f8fafc 0%, #eef3f8 100%);
  background-size: 36px 36px, 36px 36px, auto;
}

.admin-saas-shell {
  width: min(100%, 1220px);
  gap: 12px;
}

.admin-saas-hero {
  min-height: 176px;
  padding: 22px 24px;
  border-radius: 28px;
  align-items: flex-start;
  box-shadow: 0 20px 54px rgba(15, 23, 42, .16);
}

.admin-saas-hero h1 {
  margin-top: 22px;
  font-size: clamp(40px, 5vw, 62px);
  line-height: .9;
}

.admin-saas-hero p {
  max-width: 600px;
  margin-top: 10px;
}

.admin-saas-hero-meta {
  margin-top: 11px;
}

.admin-saas-hero-meta span,
.admin-saas-ghost-link,
.admin-saas-logout {
  min-height: 36px;
  padding: 0 12px;
  font-size: 10px;
}

.admin-saas-hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: flex-start;
  max-width: 360px;
}

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

.adminx-metric-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.adminx-metric-card {
  min-height: 96px;
  padding: 13px;
  border-radius: 18px;
}

.adminx-metric-card b {
  margin-top: 8px;
  font-size: clamp(24px, 2.3vw, 34px);
}

.adminx-metric-card p {
  margin-top: 7px;
  font-size: 11px;
}

.adminx-online-panel {
  margin-top: 10px;
  padding: 13px;
  border-radius: 20px;
}

.adminx-overview-grid {
  gap: 9px;
}

.adminx-soft-card {
  min-height: 104px;
  padding: 14px;
  border-radius: 18px;
}

.adminx-staff-summary,
.adminx-dashboard-metrics {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.adminx-filter-bar {
  margin-top: 12px;
  grid-template-columns: minmax(0, 1fr) 160px 112px;
  gap: 8px;
}

.adminx-filter-bar input,
.adminx-filter-bar select,
.adminx-form-grid input,
.adminx-form-grid textarea,
.adminx-firewall-panel input,
.adminx-firewall-panel textarea,
.adminx-popup-card textarea,
.adminx-popup-card input,
.adminx-notify-card input {
  border-radius: 15px;
  background: #f8fafc;
  border-color: #dbe4ef;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.75);
}

.adminx-filter-bar button,
.adminx-action-btn,
.adminx-section-save,
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

.adminx-system-sections {
  gap: 10px;
}

.adminx-system-card {
  padding: 13px;
  border-radius: 20px;
  box-shadow: none;
}

.adminx-system-card-head {
  margin-bottom: 10px;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 9px;
}

.adminx-system-card-head > span {
  width: 31px;
  height: 31px;
  border-radius: 11px;
  font-size: 10px;
}

.adminx-system-card h3 {
  font-size: 16px;
}

.adminx-system-card p {
  font-size: 11.5px;
}

.adminx-form-grid,
.adminx-firewall-panel {
  gap: 9px;
}

.adminx-lock-grid {
  margin-top: 10px;
  gap: 8px;
}

.adminx-toggle-row {
  min-height: 60px;
  padding: 10px;
  border-radius: 16px;
}

.adminx-toggle-row p {
  margin-top: 3px;
  font-size: 11px;
}

.adminx-lock-help {
  margin-top: 8px;
  padding: 10px 11px;
  border-radius: 14px;
  font-size: 11.5px;
}

.adminx-section-actions {
  margin-top: 10px;
}

.adminx-section-save {
  min-height: 46px;
}

.adminx-dashboard-grid {
  gap: 10px;
}

.adminx-dashboard-card {
  border-radius: 20px;
}

.adminx-dashboard-list {
  max-height: 430px;
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

@media (min-width: 1180px) {
  .adminx-system-sections {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }

  .adminx-system-card.adminx-firewall-card {
    grid-column: 1 / -1;
  }

  .adminx-firewall-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .adminx-firewall-message {
    grid-column: 1 / -1;
  }
}

@media (max-width: 920px) {
  .admin-saas-hero {
    min-height: 168px;
    padding: 18px;
    border-radius: 24px;
  }

  .admin-saas-hero h1 {
    margin-top: 18px;
    font-size: clamp(36px, 9vw, 48px);
  }

  .admin-saas-hero-actions {
    max-width: none;
    justify-content: flex-start;
  }

  .adminx-tabs {
    top: 0;
    margin-inline: -2px;
    border-radius: 18px;
  }

  .adminx-tabs button {
    min-width: 132px;
  }

  .adminx-metric-grid,
  .adminx-staff-summary,
  .adminx-dashboard-metrics {
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

  .adminx-dashboard-head-actions {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 520px) {
  .admin-saas-page {
    padding: 10px 8px 20px;
  }

  .adminx-dashboard-head-actions,
  .adminx-dashboard-source-switch {
    width: 100%;
  }

  .adminx-dashboard-source-switch button {
    flex: 1;
  }

  .admin-saas-shell {
    gap: 10px;
  }

  .admin-saas-hero {
    border-radius: 22px;
  }

  .admin-saas-hero-meta {
    display: none;
  }

  .adminx-panel {
    padding: 12px;
    border-radius: 20px;
  }

  .adminx-panel h2 {
    font-size: 23px;
  }

  .adminx-metric-grid,
  .adminx-staff-summary,
  .adminx-dashboard-metrics,
  .adminx-overview-grid,
  .adminx-lock-grid,
  .adminx-form-grid,
  .adminx-firewall-panel {
    grid-template-columns: 1fr;
  }

  .adminx-metric-card,
  .adminx-soft-card {
    min-height: auto;
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
  const [permission, setPermission] = useState(item.permission || "");
  const [accessItems, setAccessItems] = useState<string[]>(parseAdminAccessItems(item.modulePermissions));

  useEffect(() => {
    setPermission(item.permission || "");
    setAccessItems(parseAdminAccessItems(item.modulePermissions));
  }, [item.permission, item.modulePermissions, item.maNV]);

  function setRole(next: "" | "mod" | "admin") {
    setPermission(next);
    if (next !== "mod") setAccessItems([]);
  }

  function toggleModule(key: string) {
    setAccessItems((current) => {
      if (!current.includes(key)) return [...current, key];
      if (key === "tcdm" || key === "tools") {
        const actionKeys = key === "tools" ? TOOL_ACTION_KEYS : TCDM_ACTION_KEYS;
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
      if (current.includes(token)) return current.filter((item) => item !== token);

      const parentModule = TOOL_ACTION_KEYS.has(key) ? "tools" : "tcdm";
      const next = current.includes(parentModule)
        ? [...current, token]
        : [parentModule, ...current, token];

      return parseAdminAccessItems(next.join(","));
    });
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
          onClick={() => onSave(item.maNV, permission, accessItems.join(","))}
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
              <section className={`adminx-tree-group ${groupActive ? "active" : ""}`} key={group.title}>
                <button
                  type="button"
                  className="adminx-tree-head"
                  disabled={disabled || !groupModule}
                  onClick={() => {
                    if (groupModule) toggleModule(groupModule);
                  }}
                >
                  <i>{groupActive ? "✓" : "+"}</i>
                  <span>
                    <b>{group.title}</b>
                    <small>{group.desc}</small>
                  </span>
                </button>

                <div className="adminx-tree-children">
                  {group.children.map((child) => {
                    if ("key" in child) {
                      const token = adminActionToken(child.key);

                      return (
                        <button
                          key={child.key}
                          type="button"
                          disabled={disabled}
                          className={accessItems.includes(token) ? "active" : ""}
                          onClick={() => toggleAction(child.key)}
                        >
                          <span>{child.label}</span>
                          <small>{child.desc}</small>
                        </button>
                      );
                    }

                    const moduleKey = String(child.module);

                    return (
                      <button
                        key={`${moduleKey}-${child.label}`}
                        type="button"
                        disabled={disabled}
                        className={accessItems.includes(moduleKey) ? "active" : ""}
                        onClick={() => toggleModule(moduleKey)}
                      >
                        <span>{child.label}</span>
                        <small>{child.desc}</small>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {permission === "mod" && (
        <>
          <div className="adminx-permission-section-title">
            <span>Hạng mục truy cập</span>
            <small>Cho phép Mod mở từng khu vực quản trị.</small>
          </div>
          <div className="adminx-module-buttons">
            {ADMIN_MODULE_OPTIONS.map((module) => (
              <button
                key={module.key}
                type="button"
                disabled={disabled}
                className={accessItems.includes(module.key) ? "active" : ""}
                onClick={() => toggleModule(module.key)}
              >
                <span>{module.label}</span>
                <small>{module.key}</small>
              </button>
            ))}
          </div>

          <div className="adminx-permission-section-title">
            <span>Quyền thao tác trong TCDM</span>
            <small>Nếu bỏ trống, Mod TCDM cũ vẫn dùng theo quyền module.</small>
          </div>
          <div className="adminx-module-buttons adminx-action-buttons">
            {ADMIN_ACTION_OPTIONS.map((action) => {
              const token = `${ADMIN_ACTION_PREFIX}${action.key}`;

              return (
                <button
                  key={action.key}
                  type="button"
                  disabled={disabled}
                  className={accessItems.includes(token) ? "active" : ""}
                  onClick={() => toggleAction(action.key)}
                >
                  <span>{action.label}</span>
                  <small>{action.desc}</small>
                </button>
              );
            })}
          </div>
        </>
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
    desc: "Quản trị PMH, Pincode và hồ sơ thẩm định nhân viên gửi lên.",
    badge: "PMH / thẩm định",
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
            <div className="cms-preview-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(body || "<p>Nội dung đang cập nhật.</p>") }} />
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
  initialSettings,
  adminRole = "admin",
  adminName = "Admin",
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
  const [toast, setToast] = useState<ToastState>(null);

  const isAdmin = adminRole === "admin";
  const allowedModules = parseModuleList(adminModules);
  const visibleAdminModules = isAdmin
    ? ADMIN_MODULES
    : ADMIN_MODULES.filter((item) => allowedModules.includes(item.key));
  const activeModuleAllowed = visibleAdminModules.some((item) => item.key === module);
  const firstVisibleModule = visibleAdminModules[0]?.key || "tcdm";

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

  useEffect(() => {
    if (activeModuleAllowed) return;
    setModule(firstVisibleModule);
  }, [activeModuleAllowed, firstVisibleModule]);

  const activeMeta = ADMIN_MODULES.find((item) => item.key === module) || ADMIN_MODULES[0];
  const activeAccess = canAccess(module);

  return (
    <section className="admin-cms-shell-v5">
      <style suppressHydrationWarning>{ADMIN_CMS_STYLE}</style>

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
        {visibleAdminModules.map((item) => {
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
              </div>
            </div>
            <TcdmAdminConsole
              initialSettings={initialSettings}
              adminRole={adminRole}
              adminName={adminName}
              adminModules={adminModules}
              adminActions={adminActions}
              adminHasExplicitActions={adminHasExplicitActions}
            />
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
          <AdminToolsDashboard
            initialSettings={initialSettings}
            adminRole={adminRole}
            adminModules={adminModules}
            adminActions={adminActions}
            adminHasExplicitActions={adminHasExplicitActions}
          />
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
