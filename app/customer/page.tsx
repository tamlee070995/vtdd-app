export default function CustomerPage() {
  return (
    <main className="gateway-page">
      <section className="gateway-shell">
        <div className="hero-card">
          <div className="hero-kicker">CUSTOMER PORTAL</div>
          <h1>
            KHÁCH HÀNG
            <span>TRA CỨU</span>
          </h1>
          <p>Trang này sẽ chuyển giao diện customer.html hiện tại sang web thật.</p>
        </div>

        <a className="access-card" href="/">
          <div className="card-number">←</div>
          <div>
            <div className="card-label">BACK</div>
            <h2>Quay về cổng chính</h2>
            <p>Trở lại trang chọn cổng truy cập.</p>
          </div>
          <div className="card-arrow">›</div>
        </a>
      </section>
    </main>
  );
}