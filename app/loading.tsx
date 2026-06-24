export default function Loading() {
  return (
    <main className="vtdd-app-loading">
      <section className="vtdd-app-loading-card" aria-label="Đang tải VTDD App">
        <div className="vtdd-app-loading-logo">
          <img src="/mwg-logo.svg" alt="Viễn Thông Di Động" />
        </div>
        <h1>Viễn Thông Di Động</h1>
        <strong>VTDD App</strong>
        <p>Đang khởi động hệ thống</p>
        <div className="vtdd-app-loading-bar" aria-hidden="true">
          <span />
        </div>
      </section>
    </main>
  );
}
