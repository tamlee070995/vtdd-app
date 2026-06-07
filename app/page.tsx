import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="home-v4-page">
      <section className="home-v4-shell">
        <header className="home-v4-topbar">
          <div className="home-v4-logo">
            <span>VT</span>
          </div>

          <div>
            <h1>VTDD.ONLINE</h1>
            <p>Trade-in Value Portal</p>
          </div>
        </header>

        <section className="home-v4-hero">
          <div className="home-v4-staff-chip">© 36964</div>

          <div className="home-v4-hero-content">
            <h2>
              TRA CỨU GIÁ
              <span>THU CŨ ĐỔI MỚI</span>
            </h2>

            <p>
              Công định giá thiết bị cũ, tối ưu cho nhân viên thao tác nhanh trên điện thoại.
            </p>
          </div>
        </section>

        <section className="home-v4-menu">
          <Link className="home-v4-card internal" href="/login">
            <div className="home-v4-card-index">01</div>

            <div className="home-v4-card-content">
              <span>INTERNAL</span>
              <h3>Nhân viên TGDD / ĐMX</h3>
              <p>Đăng nhập nội bộ để tra bảng giá, trợ giá và xuất báo giá.</p>
            </div>

            <div className="home-v4-card-arrow">›</div>
          </Link>

          <Link className="home-v4-card public" href="/khach-hang">
            <div className="home-v4-card-index">02</div>

            <div className="home-v4-card-content">
              <span>PUBLIC</span>
              <h3>Khách hàng cá nhân</h3>
              <p>Trang tra cứu công khai, đơn giản và dễ hiểu cho khách hàng.</p>
            </div>

            <div className="home-v4-card-arrow">›</div>
          </Link>
        </section>

        <Link className="home-v4-system-pill" href="/admin">
          <i></i>
          SYSTEM ONLINE
        </Link>
      </section>
    </main>
  );
}