import Link from "next/link";
import AdminLoginKeyBridge from "@/components/AdminLoginKeyBridge";

type PageProps = {
  searchParams?: Promise<{ error?: string }> | { error?: string };
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const error = typeof params?.error === "string" ? params.error : "";

  return (
    <main className="admin-login-premium-page admin-login-premium-v2-page">
      <section className="admin-login-premium-shell admin-login-premium-v2-shell">
        <aside className="admin-login-premium-hero admin-login-premium-v2-hero">
          <div className="admin-login-logo-mark admin-login-logo-v2">
            <img src="/mwg-logo.svg" alt="MWG" />
          </div>

          <div className="admin-login-hero-content admin-login-hero-v2-content">
            <span>ENTERPRISE ADMIN</span>
            <h1>
              Admin
              <b>Console</b>
            </h1>
            <p>Trang quản trị vận hành ngành hàng.</p>
          </div>

          <div className="admin-login-v2-tags">
            <i>STAFF VERIFIED</i>
            <i>CMS SECURE</i>
            <i>VIENTHONGDIDONG</i>
          </div>
        </aside>

        <section className="admin-login-premium-panel admin-login-premium-v2-panel">
          <div className="admin-login-panel-head admin-login-v2-head">
            <div>
              <h2>Viễn Thông Di Động</h2>
              <p>ADMIN CMS CONSOLE</p>
            </div>
          </div>

          <form
            className="admin-login-premium-form admin-login-v2-form"
            action="/api/auth/admin-login"
            method="POST"
            noValidate
          >
            <AdminLoginKeyBridge />

            <label htmlFor="admin-maNV">Mã nhân viên</label>
            <input
              id="admin-maNV"
              name="maNV"
              type="text"
              inputMode="numeric"
              placeholder="Ví dụ: 123123"
              autoComplete="username"
            />

            <label htmlFor="admin-password">Mật khẩu</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              placeholder="Nhập mật khẩu tài khoản"
              autoComplete="current-password"
            />

            {error ? (
              <div className="admin-error-banner" role="alert">
                ⚠️ {error}
              </div>
            ) : null}

            <button type="submit">ĐĂNG NHẬP ADMIN</button>

            <div className="admin-login-actions-v2 admin-login-actions-v3">
              <Link href="/admin/forgot-password">Quên mật khẩu Admin?</Link>
              <Link href="/">Quay về trang chủ</Link>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
