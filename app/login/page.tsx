import Link from "next/link";
import StaffLoginForm from "@/components/StaffLoginForm";

type PageProps = {
  searchParams?: Promise<{ error?: string; next?: string }> | { error?: string; next?: string };
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const error = typeof params?.error === "string" ? params.error : "";
  const next = typeof params?.next === "string" ? params.next : "";

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
              Truy cập nội bộ,
              <span>thao tác nhanh hơn.</span>
            </h1>
            <p>
              Đăng nhập bằng mã nhân viên để sử dụng các công cụ được cấp quyền
              và theo dõi thông tin phục vụ vận hành.
            </p>
          </div>

          <div className="staff-auth-signal" aria-hidden="true">
            <i />
            <span>Hệ thống sẵn sàng</span>
          </div>
        </section>

        <StaffLoginForm initialError={error} next={next} />

        <footer className="staff-auth-footer">
          <span>VTDD Internal</span>
          <span>Secure Staff Login</span>
        </footer>
      </section>
    </main>
  );
}
