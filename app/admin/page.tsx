import { redirect } from "next/navigation";
import Link from "next/link";
import AdminConsole from "@/components/AdminConsole";
import AdminProfileButton from "@/components/AdminProfileButton";
import { getSystemSettings } from "@/lib/system-store";
import { adminCanUsePmhTool, adminHasAction, requireAdminPage } from "@/lib/admin-auth";
import { ensureStaffAdminHeaders } from "@/lib/staff-store";

export const dynamic = "force-dynamic";

const TCDM_CLIENT_SETTING_KEYS = [
  "MARQUEE_MESSAGE",
  "FIXED_BANNER_MESSAGE",
  "PUSH_NOTIFY_MESSAGE",
  "PUSH_NOTIFY_VERSION",
  "PRICE_EFFECTIVE_FROM",
  "PRICE_EFFECTIVE_TO",
  "DATA_VERSION",
  "SYSTEM_LOCK_ENABLED",
  "SYSTEM_LOCK_MESSAGE",
  "SYSTEM_LOCK_SCHEDULE_ENABLED",
  "SYSTEM_LOCK_START_AT",
  "SYSTEM_LOCK_END_AT",
  "SYSTEM_LOCK_REASON",
  "STAFF_PAGE_LOCKED",
  "CUSTOMER_PAGE_LOCKED",
  "STAFF_TRADEIN_LOCKED",
  "STAFF_BUYONLY_LOCKED",
  "CUSTOMER_TRADEIN_LOCKED",
  "CUSTOMER_BUYONLY_LOCKED",
];

const PMH_CLIENT_SETTING_KEYS = [
  "TOOL_PMH_ENABLED",
  "TOOL_PMH_SCHEDULE_ENABLED",
  "TOOL_PMH_START_AT",
  "TOOL_PMH_END_AT",
  "TOOL_PMH_LOCK_REASON",
];

const TELEGRAM_CLIENT_SETTING_KEYS = [
  "TELEGRAM_CHIENGIA_ENABLED",
  "TELEGRAM_NGOAIDS_ENABLED",
];

function isSensitiveSettingKey(key: string) {
  return /(TOKEN|SECRET|HASH|PASSWORD|PASS|PIN)/i.test(key);
}

function buildClientSettings(settings: Record<string, string>, admin: Awaited<ReturnType<typeof requireAdminPage>>) {
  if (!admin) return {};
  if (admin.permission === "admin") {
    return Object.fromEntries(
      Object.entries(settings).filter(([key]) => !isSensitiveSettingKey(key))
    );
  }

  const keys = new Set<string>();

  if (
    adminHasAction(admin, "settings-write", "tcdm") ||
    adminHasAction(admin, "reload-data", "tcdm") ||
    adminHasAction(admin, "dashboard-view", "tcdm")
  ) {
    TCDM_CLIENT_SETTING_KEYS.forEach((key) => keys.add(key));
  }

  if (adminCanUsePmhTool(admin)) {
    PMH_CLIENT_SETTING_KEYS.forEach((key) => keys.add(key));
  }

  if (adminHasAction(admin, "tools-telegram")) {
    TELEGRAM_CLIENT_SETTING_KEYS.forEach((key) => keys.add(key));
  }

  const filtered: Record<string, string> = {};
  keys.forEach((key) => {
    if (isSensitiveSettingKey(key)) return;
    filtered[key] = String(settings[key] ?? "");
  });
  return filtered;
}

export default async function AdminPage() {
  const admin = await requireAdminPage();

  if (!admin) {
    redirect("/admin/login");
  }

  await ensureStaffAdminHeaders();
  const settings = await getSystemSettings();
  const clientSettings = buildClientSettings(settings, admin);

  return (
    <main className="admin-cms-pro-page">
      <section className="admin-cms-pro-shell">
        <header className="admin-cms-pro-hero">
          <div className="admin-cms-pro-brand">
            <span className="admin-cms-pro-logo"><img src="/mwg-logo.svg" alt="MWG" /></span>
            <div>
              <b>Viễn Thông Di Động</b>
            </div>
          </div>

          <div className="admin-cms-pro-title">
            <h1>Quản trị vận hành</h1>
            <p>Điều phối nội dung, nghiệp vụ, công cụ trên trang.</p>
          </div>

          <div className="admin-cms-pro-meta">
            <span>{admin.permission.toUpperCase()}: {admin.name}</span>
            <span>NV: {admin.maNV}</span>
            <span>Modules: {admin.permission === "admin" ? "ALL" : admin.modules.join(", ") || "Chưa cấp"}</span>
            <span>Data version: {settings.DATA_VERSION || "1"}</span>
          </div>

          <div className="admin-cms-pro-actions">
            <Link href="/" className="admin-cms-pro-ghost">Cổng chính</Link>
            <AdminProfileButton />
            <a href="/api/auth/admin-logout" className="admin-cms-pro-logout">Đăng xuất</a>
          </div>
        </header>

        <AdminConsole
          initialSettings={clientSettings}
          adminRole={admin.permission}
          adminName={admin.name}
          adminModules={admin.modules.join(",")}
          adminActions={admin.actions.join(",")}
          adminHasExplicitActions={admin.hasExplicitActions}
        />
      </section>

      <style>{`
        .admin-cms-pro-page {
          min-height: 100dvh;
          padding: clamp(12px, 1.4vw, 24px);
          background: radial-gradient(circle at 10% 0%, rgba(255,212,0,.18), transparent 30%), radial-gradient(circle at 92% 8%, rgba(59,130,246,.12), transparent 28%), #eef3f8;
          color: #07111f;
          font-family: Roboto, Arial, sans-serif;
        }
        .admin-cms-pro-shell { width: min(100%, 1480px); margin: 0 auto; display: grid; gap: 14px; }
        .admin-cms-pro-hero {
          min-height: 230px;
          padding: clamp(22px, 3vw, 40px);
          border-radius: 34px;
          position: relative;
          overflow: hidden;
          display: grid;
          gap: 18px;
          background: radial-gradient(circle at 88% 12%, rgba(255,212,0,.55), transparent 30%), linear-gradient(135deg, #07111f, #020617);
          color: #fff;
          box-shadow: 0 28px 90px rgba(15,23,42,.16);
        }
        .admin-cms-pro-hero:after {
          content: "";
          position: absolute;
          inset: 0;
          opacity: .22;
          background-image: linear-gradient(to right, rgba(255,255,255,.14) 1px, transparent 1px);
          background-size: 28px 28px;
          pointer-events: none;
        }
        .admin-cms-pro-brand, .admin-cms-pro-title, .admin-cms-pro-meta, .admin-cms-pro-actions { position: relative; z-index: 1; }
        .admin-cms-pro-brand { display: flex; align-items: center; gap: 12px; }
        .admin-cms-pro-logo { width: 54px; height: 54px; border-radius: 18px; background: #ffd400; overflow: hidden; display: grid; place-items: center; box-shadow: 0 0 0 7px rgba(255,212,0,.12); }
        .admin-cms-pro-logo img { width: 100%; height: 100%; object-fit: contain; }
        .admin-cms-pro-brand b { display: block; font-size: 20px; line-height: 1; font-weight: 1000; }
        .admin-cms-pro-brand small { display: block; margin-top: 5px; color: rgba(255,255,255,.66); font-size: 11px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
        .admin-cms-pro-title span { display: inline-flex; padding: 9px 13px; border-radius: 999px; background: rgba(255,255,255,.1); color: #ffd400; font-size: 11px; font-weight: 1000; letter-spacing: .14em; }
        .admin-cms-pro-title h1 { max-width: 840px; margin: 16px 0 0; font-size: clamp(42px, 5.6vw, 86px); line-height: .9; font-weight: 1000; letter-spacing: -.08em; }
        .admin-cms-pro-title p { max-width: 650px; margin: 18px 0 0; color: rgba(255,255,255,.76); font-size: 15px; line-height: 1.55; font-weight: 800; }
        .admin-cms-pro-meta { display: flex; flex-wrap: wrap; gap: 8px; }
        .admin-cms-pro-meta span { min-height: 32px; padding: 0 12px; border-radius: 999px; display: inline-flex; align-items: center; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.12); color: rgba(255,255,255,.8); font-size: 11px; font-weight: 900; }
        .admin-cms-pro-actions { position: absolute; top: clamp(18px, 2vw, 28px); right: clamp(18px, 2vw, 28px); display: flex; gap: 10px; }
        .admin-cms-pro-ghost, .admin-cms-pro-logout { min-height: 42px; padding: 0 16px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; font-size: 12px; font-weight: 1000; letter-spacing: .08em; text-transform: uppercase; }
        .admin-cms-pro-ghost { color: #fff; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.16); }
        .admin-cms-pro-logout { color: #07111f; background: #ffd400; }
        @media (max-width: 760px) {
          .admin-cms-pro-page { padding: 8px; }
          .admin-cms-pro-shell { gap: 10px; }
          .admin-cms-pro-hero {
            min-height: auto;
            padding: 14px;
            border-radius: 22px;
            gap: 10px;
          }
          .admin-cms-pro-logo { width: 42px; height: 42px; border-radius: 14px; }
          .admin-cms-pro-brand b { font-size: 16px; }
          .admin-cms-pro-actions { position: relative; top: auto; right: auto; }
          .admin-cms-pro-title h1 {
            margin-top: 8px;
            font-size: 30px;
            line-height: .96;
            letter-spacing: 0;
          }
          .admin-cms-pro-title p { display: none; }
          .admin-cms-pro-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
          }
          .admin-cms-pro-meta span {
            min-height: 30px;
            padding: 0 9px;
            border-radius: 12px;
            font-size: 10px;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .admin-cms-pro-meta span:nth-child(3) { grid-column: 1 / -1; }
          .admin-cms-pro-actions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }
          .admin-cms-pro-ghost,
          .admin-cms-pro-logout {
            min-height: 38px;
            padding: 0 8px;
            font-size: 10px;
          }
        }
      `}</style>
    </main>
  );
}
