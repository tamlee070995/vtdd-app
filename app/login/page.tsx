import Link from "next/link";

type PageProps = {
  searchParams?: Promise<{ error?: string }> | { error?: string };
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const error = typeof params?.error === "string" ? params.error : "";

  return (
    <main className="staff-auth-page">
      <section className="staff-auth-shell">
        <header className="staff-auth-topbar">
          <Link className="staff-auth-brand" href="/">
            <span className="staff-auth-logo">
              <img src="/mwg-logo.svg" alt="MWG" />
            </span>
            <span>
              <b>Viễn Thông Di Động</b>
              <small>Staff Portal</small>
            </span>
          </Link>

          <Link className="staff-auth-home" href="/">
            Trang chủ
          </Link>
        </header>

        <section className="staff-auth-hero" aria-label="Đăng nhập nhân viên">
          <div className="staff-auth-hero-copy">
            <span className="staff-auth-kicker">EMPLOYEE ACCESS</span>
            <h1>
              Tra cứu nhanh,
              <span>vào ca gọn hơn.</span>
            </h1>
            <p>
              Đăng nhập bằng mã nhân viên để tra bảng giá TCDM, xem lịch sử báo giá
              và thao tác các công cụ nội bộ.
            </p>
          </div>

          <div className="staff-auth-signal" aria-hidden="true">
            <i />
            <span>Hệ thống sẵn sàng</span>
          </div>
        </section>

        <form
          className="staff-auth-form"
          action="/api/auth/staff-login"
          method="POST"
          noValidate
        >
          <div className="staff-auth-form-head">
            <span>01</span>
            <div>
              <h2>Đăng nhập nhân viên</h2>
              <p>Dành cho tài khoản đã được duyệt sử dụng.</p>
            </div>
          </div>

          <label htmlFor="maNV">Mã nhân viên</label>
          <input
            id="maNV"
            name="maNV"
            type="text"
            inputMode="text"
            placeholder="NV12345"
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
            <div className="staff-auth-error" role="alert">
              <b>Không đăng nhập được</b>
              <span>{error}</span>
            </div>
          ) : null}

          <button type="submit">Vào trang tra cứu</button>

          <div className="staff-auth-actions">
            <Link href="/register">Tạo tài khoản</Link>
            <Link href="/forgot-password">Quên mật khẩu</Link>
          </div>
        </form>

        <footer className="staff-auth-footer">
          <span>VTDD Internal</span>
          <span>Secure Staff Login</span>
        </footer>
      </section>
    </main>
  );
}
