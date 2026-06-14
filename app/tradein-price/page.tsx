import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import { getPublicSystemSettings } from "@/lib/system-store";
import { settingEnabled } from "@/lib/system-lock";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bảng Giá Thu Cũ Đổi Mới | Viễn Thông Di Động",
  description: "Chọn luồng tra cứu bảng giá thu cũ đổi mới dành cho nhân viên, khách hàng hoặc in sticker trợ giá.",
};

type EntryItem = {
  index: string;
  badge: string;
  title: string;
  desc: string;
  href: string;
  tone: "internal" | "public" | "print";
  locked?: boolean;
  lockText?: string;
};

function getEntryItems(settings: Record<string, string>): EntryItem[] {
  const staffPageLocked = settingEnabled(settings, "STAFF_PAGE_LOCKED");
  const customerPageLocked = settingEnabled(settings, "CUSTOMER_PAGE_LOCKED");

  return [
  {
    index: "01",
    badge: "INTERNAL",
    title: "Nhân viên TGDD / ĐMX",
    desc: "Đăng nhập nội bộ để tra bảng giá, trợ giá và xuất báo giá nhanh.",
    href: "/login",
    tone: "internal",
    locked: staffPageLocked,
    lockText: "Trang nhân viên đang tạm khóa theo cài đặt Admin.",
  },
  {
    index: "02",
    badge: "PUBLIC",
    title: "Khách hàng cá nhân",
    desc: "Trang tra cứu công khai, đơn giản và dễ hiểu cho khách hàng.",
    href: "/khach-hang",
    tone: "public",
    locked: customerPageLocked,
    lockText: "Trang khách hàng đang tạm khóa theo cài đặt Admin.",
  },
  {
    index: "03",
    badge: "PRINT",
    title: "In sticker trợ giá",
    desc: "Tạo sticker trợ giá thu cũ đổi mới và in tối đa 6 tem trên A4.",
    href: "/tradein-price/sticker-tcdm",
    tone: "print",
  },
  ];
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default async function TradeInPriceEntryPage() {
  const settings = await getPublicSystemSettings();
  const items = getEntryItems(settings);

  return (
    <main className={styles.tradeEntryPage}>
      <section className={styles.tradeEntryShell}>
        <header className={styles.tradeEntryTopbar}>
          <Link href="/" className={styles.tradeEntryBrand} aria-label="Về trang chủ ngành hàng">
            <span className={styles.tradeEntryLogoBox}>
              <img src="/mwg-logo.svg" alt="MWG" />
            </span>

            <span className={styles.tradeEntryBrandText}>
              <strong>Viễn Thông Di Động</strong>
              <small>Bảng giá thu cũ đổi mới</small>
            </span>
          </Link>

          <Link href="/" className={styles.tradeEntryBackButton}>
            Về trang chủ
          </Link>
        </header>

        <section className={styles.tradeEntryHero}>
          <div className={styles.tradeEntryHeroGrid} />

          <div className={styles.tradeEntryHeroContent}>
            <div className={styles.tradeEntryKicker}>TRA CỨU GIÁ THU CŨ</div>

            <h1>
              Chọn luồng
              <span>Thu Cũ Đổi Mới</span>
            </h1>

            <p>
              Mở đúng trang sử dụng cho nhân viên nội bộ, khách hàng cá nhân hoặc công cụ in sticker trợ giá.
            </p>
          </div>

          <aside className={styles.tradeEntryInfoBox}>
            <b>Hướng dẫn nhanh</b>
            <span>Nhân viên: cần đăng nhập nội bộ.</span>
            <span>Khách hàng: tra cứu công khai.</span>
            <span>Sticker: chỉnh chữ trực tiếp và in A4.</span>
          </aside>
        </section>

        <section className={styles.tradeEntryCards} aria-label="Chọn luồng bảng giá thu cũ đổi mới">
          {items.map((item) => {
            const content = (
              <>
              <span className={styles.tradeEntryCardNumber}>{item.index}</span>

              <span className={styles.tradeEntryCardBody}>
                <em>{item.locked ? "TẠM KHÓA" : item.badge}</em>
                <strong>{item.title}</strong>
                <small>{item.desc}</small>
                {item.locked && item.lockText ? <small className={styles.tradeEntryLockText}>{item.lockText}</small> : null}
              </span>

              <span className={styles.tradeEntryArrow}>›</span>
              </>
            );

            return item.locked ? (
              <div
                key={item.index}
                className={cx(styles.tradeEntryCard, styles[`tone_${item.tone}`], styles.tradeEntryCardLocked)}
                aria-disabled="true"
              >
                {content}
              </div>
            ) : (
              <Link
                href={item.href}
                key={item.index}
                className={cx(styles.tradeEntryCard, styles[`tone_${item.tone}`])}
              >
                {content}
              </Link>
            );
          })}
        </section>

        <footer className={styles.tradeEntryFooter}>
          <span className={styles.tradeEntryOnlineDot} />
          SYSTEM ONLINE
        </footer>
      </section>
    </main>
  );
}
