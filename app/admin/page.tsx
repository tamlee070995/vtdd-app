import { redirect } from "next/navigation";
import Link from "next/link";
import AdminConsole from "@/components/AdminConsole";
import AdminProfileButton from "@/components/AdminProfileButton";
import { getSystemSettings } from "@/lib/system-store";
import { requireAdminPage } from "@/lib/admin-auth";
import { ensureStaffAdminHeaders } from "@/lib/staff-store";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdminPage();

  if (!admin) {
    redirect("/admin/login");
  }

  await ensureStaffAdminHeaders();
  const settings = await getSystemSettings();

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
          initialSettings={settings}
          adminRole={admin.permission}
          adminName={admin.name}
          adminModules={admin.modules.join(",")}
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
          .admin-cms-pro-actions { position: relative; top: auto; right: auto; }
          .admin-cms-pro-title h1 { font-size: 44px; }
        }
      `}</style>
    </main>
  );
}
