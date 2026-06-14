import Link from "next/link";

type PmhToolClosedPageProps = {
  title: string;
  reason: string;
};

export default function PmhToolClosedPage({ title, reason }: PmhToolClosedPageProps) {
  return (
    <main className="pmh-closed-page">
      <style>{STYLE}</style>

      <section className="pmh-closed-shell">
        <header className="pmh-closed-topbar">
          <Link className="pmh-closed-brand" href="/cong-cu-ho-tro" aria-label="Về cổng hỗ trợ">
            <span>
              <img src="/mwg-logo.svg" alt="MWG" />
            </span>
            <b>Viễn Thông Di Động</b>
          </Link>

          <Link href="/" className="pmh-closed-home">
            Trang chủ
          </Link>
        </header>

        <section className="pmh-closed-card">
          <div className="pmh-closed-badge">Công cụ đang tạm đóng</div>
          <h1>{title}</h1>
          <p>{reason || "Công cụ PMH/Pincode đang tạm đóng theo cài đặt Admin."}</p>
          <div className="pmh-closed-actions">
            <Link href="/cong-cu-ho-tro">Về cổng hỗ trợ</Link>
            <Link href="/">Trang chủ</Link>
          </div>
        </section>
      </section>
    </main>
  );
}

const STYLE = `
.pmh-closed-page {
  min-height: 100dvh;
  padding: 22px;
  background:
    radial-gradient(circle at 10% 0%, rgba(255, 212, 0, .22), transparent 30%),
    radial-gradient(circle at 94% 10%, rgba(14, 165, 233, .13), transparent 32%),
    #eef3f8;
  color: #07111f;
  font-family: Roboto, Arial, sans-serif;
}

.pmh-closed-shell {
  width: min(100%, 740px);
  margin: 0 auto;
}

.pmh-closed-topbar {
  min-height: 74px;
  padding: 10px 16px;
  border-radius: 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #07111f;
  box-shadow: 0 24px 76px rgba(15,23,42,.16);
}

.pmh-closed-brand {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: #fff;
  text-decoration: none;
  font-size: 20px;
  font-weight: 1000;
  letter-spacing: -.04em;
}

.pmh-closed-brand span {
  width: 52px;
  height: 52px;
  border-radius: 17px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: #ffd400;
}

.pmh-closed-brand img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.pmh-closed-home,
.pmh-closed-actions a {
  min-height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #ffd400;
  color: #07111f;
  text-decoration: none;
  font-size: 12px;
  font-weight: 1000;
  text-transform: uppercase;
}

.pmh-closed-card {
  margin-top: 18px;
  padding: clamp(24px, 5vw, 44px);
  border-radius: 32px;
  background: radial-gradient(circle at 100% 0%, rgba(255, 212, 0, .2), transparent 36%), #ffffff;
  border: 1px solid #dbe4ef;
  box-shadow: 0 28px 88px rgba(15,23,42,.13);
}

.pmh-closed-badge {
  width: fit-content;
  padding: 9px 13px;
  border-radius: 999px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #c2410c;
  font-size: 11px;
  line-height: 1;
  font-weight: 1000;
}

.pmh-closed-card h1 {
  margin: 18px 0 10px;
  color: #07111f;
  font-size: clamp(34px, 7vw, 58px);
  line-height: .95;
  font-weight: 1000;
  letter-spacing: -.055em;
}

.pmh-closed-card p {
  max-width: 560px;
  margin: 0;
  color: #475569;
  font-size: 15px;
  line-height: 1.55;
  font-weight: 850;
}

.pmh-closed-actions {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.pmh-closed-actions a:last-child {
  background: #f8fafc;
  border: 1px solid #dbe4ef;
}

@media (max-width: 560px) {
  .pmh-closed-page { padding: 14px; }
  .pmh-closed-topbar { border-radius: 22px; }
  .pmh-closed-brand b { font-size: 17px; }
  .pmh-closed-card { border-radius: 26px; }
  .pmh-closed-actions { display: grid; }
}
`;
