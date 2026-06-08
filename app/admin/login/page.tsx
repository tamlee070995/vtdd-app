import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";

type PageProps = {
  searchParams?: Promise<{ error?: string }> | { error?: string };
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const error = typeof params?.error === "string" ? params.error : "";

  return (
    <main className="admin-login-v5-page">
      <section className="admin-login-v5-shell">
        <div className="admin-login-v5-brand">
          <div className="brand-mark">VT</div>

          <div>
            <div className="brand-title">Viễn Thông Di Động</div>
            <div className="brand-subtitle">Enterprise Admin Access</div>
          </div>
        </div>

        <section className="admin-login-v5-hero">
          <div className="hero-kicker">PRIVATE ADMIN</div>

          <h1>
            ADMIN
            <span>CONSOLE</span>
          </h1>

          <p>
            Trung tâm điều phối tài khoản nhân viên, lock web khẩn cấp,
            thông báo hệ thống và dashboard tra giá.
          </p>
        </section>

        <form className="admin-login-v5-card" action="/api/auth/admin-login" method="POST" noValidate>
          <label htmlFor="admin-password">PIN / Mật khẩu quản trị</label>

          <PasswordInput
            id="admin-password"
            name="password"
            placeholder="Nhập PIN admin"
            autoComplete="current-password"
          />

          {error ? (
            <div className="admin-error-banner" role="alert">
              ⚠️ {error}
            </div>
          ) : null}

          <button type="submit">
            ĐĂNG NHẬP ADMIN
          </button>

          <Link className="admin-login-back" href="/">
            QUAY VỀ TRANG CHỦ
          </Link>
        </form>
      </section>
    </main>
  );
}
