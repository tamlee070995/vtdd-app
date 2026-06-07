import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminConsole from "@/components/AdminConsole";
import { getSystemSettings } from "@/lib/system-store";

const ADMIN_COOKIE = "vtdd_admin_token";

export const dynamic = "force-dynamic";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return value || "";
  }
}

export default async function AdminPage() {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_COOKIE)?.value || "";

  if (adminToken !== "admin-ok") {
    redirect("/admin/login");
  }

  const settings = await getSystemSettings();
  const adminName = safeDecode(cookieStore.get("vtdd_admin_name")?.value || "Admin");

  return (
    <main className="admin-saas-page">
      <section className="admin-saas-shell">
        <header className="admin-saas-hero">
          <div className="admin-saas-hero-left">
            <div className="admin-saas-kicker">ENTERPRISE ADMIN CONSOLE</div>

            <h1>
              QUẢN TRỊ
              <span>VTDD.ONLINE</span>
            </h1>

            <p>
              Điều phối tài khoản nhân viên, thông báo hệ thống, lock web khẩn cấp,
              dashboard tra giá và cấu hình vận hành.
            </p>

            <div className="admin-saas-hero-meta">
              <span>Admin: {adminName}</span>
              <span>Data version: {settings.DATA_VERSION || "1"}</span>
            </div>
          </div>

          <div className="admin-saas-hero-actions">
            <Link href="/" className="admin-saas-ghost-link">
              Cổng chính
            </Link>

            <a className="admin-saas-logout" href="/api/auth/admin-logout">
              Đăng xuất
            </a>
          </div>
        </header>

        <AdminConsole initialSettings={settings} />
      </section>
    </main>
  );
}
