import Link from "next/link";

type PageProps = {
  searchParams?: Promise<{ error?: string }> | { error?: string };
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const error = typeof params?.error === "string" ? params.error : "";

  return (
    <main className="login-page-v2">
      <section className="login-card-v2">
        <div className="login-brand-v2">
          <div className="brand-mark">
            <img src="/mwg-logo.svg" alt="MWG" />
          </div>

          <div>
            <div className="brand-title">Viễn Thông Di Động</div>
            <div className="brand-subtitle">Staff Secure Login</div>
          </div>
        </div>

        <section className="login-hero-v2">
          <div className="hero-kicker">EMPLOYEE ACCOUNT</div>

          <h1>
            ĐĂNG NHẬP
            <span>NHÂN VIÊN</span>
          </h1>

          <p>
            Sử dụng tài khoản nội bộ gồm mã nhân viên và mật khẩu đã được cấp trên hệ thống.
          </p>
        </section>

        <form
          className="login-form-v2"
          action="/api/auth/staff-login"
          method="POST"
          noValidate
        >
          <label htmlFor="maNV">Mã nhân viên</label>

          <input
            id="maNV"
            name="maNV"
            type="text"
            inputMode="numeric"
            placeholder="VD: 36964"
            autoComplete="username"
          />

          <label htmlFor="password">Mật khẩu</label>

          <input
            id="password"
            name="password"
            type="password"
            placeholder="Nhập mật khẩu"
            autoComplete="current-password"
          />

          {error ? (
            <div className="staff-error-banner" role="alert">
              ⚠️ {error}
            </div>
          ) : null}

          <button type="submit">
            ĐĂNG NHẬP
          </button>

          <div className="login-extra-actions">
            <Link href="/register">Tạo tài khoản mới</Link>
            <Link href="/forgot-password">Quên mật khẩu?</Link>
          </div>

          <Link className="login-back-v2" href="/">
            QUAY VỀ TRANG CHỦ
          </Link>
        </form>
      </section>
    </main>
  );
}