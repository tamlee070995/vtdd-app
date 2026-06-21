import Link from "next/link";

type FirewallBlockedPageProps = {
  ip: string;
  message: string;
};

export default function FirewallBlockedPage({ ip, message }: FirewallBlockedPageProps) {
  return (
    <main className="vtdd-firewall-page">
      <section className="vtdd-firewall-card">
        <div className="vtdd-firewall-icon">!</div>
        <span>Tường lửa hệ thống</span>
        <h1>Truy cập bị chặn</h1>
        <p>{message || "IP của bạn không được phép truy cập hệ thống tra giá."}</p>
        <div className="vtdd-firewall-ip">IP: {ip || "Không xác định"}</div>
        <Link href="/">Quay về trang chủ</Link>
      </section>

      <style>{`
        .vtdd-firewall-page {
          min-height: 100dvh;
          padding: max(18px, env(safe-area-inset-top)) 14px max(18px, env(safe-area-inset-bottom));
          display: grid;
          place-items: center;
          background: radial-gradient(circle at 18% 0%, rgba(255,212,0,.22), transparent 34%), linear-gradient(180deg,#fff 0%,#f8fafc 48%,#eef2f7 100%);
          color: #0f172a;
          font-family: Roboto, Arial, sans-serif;
        }
        .vtdd-firewall-card {
          width: min(100%, 440px);
          padding: 24px 18px 18px;
          border-radius: 32px;
          background: radial-gradient(circle at 100% 0%, rgba(239,68,68,.14), transparent 38%), #fff;
          border: 1px solid #fecaca;
          box-shadow: 0 26px 80px rgba(15,23,42,.16);
          text-align: center;
        }
        .vtdd-firewall-icon {
          width: 62px;
          height: 62px;
          margin: 0 auto 14px;
          border-radius: 22px;
          display: grid;
          place-items: center;
          background: #0f172a;
          color: #ffd400;
          font-size: 26px;
          font-weight: 1000;
        }
        .vtdd-firewall-card span {
          width: fit-content;
          margin: 0 auto;
          padding: 8px 11px;
          border-radius: 999px;
          display: inline-flex;
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
          font-size: 9.5px;
          line-height: 1;
          font-weight: 1000;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .vtdd-firewall-card h1 {
          margin-top: 14px;
          color: #0f172a;
          font-size: 30px;
          line-height: 1.05;
          font-weight: 1000;
          letter-spacing: -.055em;
          text-transform: uppercase;
        }
        .vtdd-firewall-card p {
          margin-top: 10px;
          color: #475569;
          font-size: 13px;
          line-height: 1.5;
          font-weight: 850;
        }
        .vtdd-firewall-ip {
          margin-top: 14px;
          padding: 12px;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #0f172a;
          font-size: 12px;
          font-weight: 1000;
          word-break: break-word;
        }
        .vtdd-firewall-card a {
          min-height: 50px;
          margin-top: 14px;
          border-radius: 17px;
          display: grid;
          place-items: center;
          background: #ffd400;
          color: #111827;
          font-size: 11.5px;
          font-weight: 1000;
          letter-spacing: .06em;
          text-transform: uppercase;
          text-decoration: none;
        }
      `}</style>
    </main>
  );
}
