import Link from "next/link";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default function TradeInPriceEntryPage() {
  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.brand}>
          <Link href="/" className={styles.logoWrap} aria-label="Về trang chủ">
            <img src="/mwg-logo.svg" alt="MWG" />
          </Link>

          <div>
            <strong>Viễn Thông Di Động</strong>
            <span>Trade-in Value Portal</span>
          </div>
        </header>

        <section className={styles.hero}>
          <div className={styles.badge}>BẢNG GIÁ THU CŨ ĐỔI MỚI</div>

          <h1>
            TRA CỨU GIÁ
            <span>THU CŨ ĐỔI MỚI</span>
          </h1>

          <p>
            Chọn đúng luồng sử dụng để mở trang tra cứu phù hợp cho nhân viên nội bộ
            hoặc khách hàng cá nhân.
          </p>
        </section>

        <section className={styles.chooseGrid}>
          <Link href="/login" className={styles.chooseCard}>
            <div className={styles.cardNumber}>01</div>

            <div className={styles.cardText}>
              <span>INTERNAL</span>
              <h2>Nhân viên TGDD / ĐMX</h2>
              <p>Đăng nhập nội bộ để tra bảng giá, trợ giá và xuất báo giá.</p>
            </div>

            <div className={styles.arrow}>›</div>
          </Link>

          <Link href="/khach-hang" className={styles.chooseCard}>
            <div className={styles.cardNumber}>02</div>

            <div className={styles.cardText}>
              <span>PUBLIC</span>
              <h2>Khách hàng cá nhân</h2>
              <p>Trang tra cứu công khai, đơn giản và dễ hiểu cho khách hàng.</p>
            </div>

            <div className={styles.arrow}>›</div>
          </Link>
        </section>

        <Link href="/" className={styles.backHome}>
          ← Quay về trang chủ ngành hàng
        </Link>

        <div className={styles.status}>
          <i />
          SYSTEM ONLINE
        </div>
      </section>
    </main>
  );
}