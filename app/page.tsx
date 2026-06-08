import Link from "next/link";
import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Trang chủ Ngành Hàng Viễn Thông Di Động",
  description: "Trung Tâm Chính Sách & Nghiệp Vụ Sản Phẩm ngành hàng Viễn Thông Di Động.",
};

type ToolItem = {
  title: string;
  desc: string;
  href?: string;
  status?: string;
};

type ToolGroup = {
  id: string;
  title: string;
  desc: string;
  items: ToolItem[];
};

const GROUPS: ToolGroup[] = [
  {
    id: "01",
    title: "Hệ Thu Cũ Đổi Mới",
    desc: "Bảng giá và quy trình vận hành Thu cũ đổi mới.",
    items: [
      {
        title: "Bảng giá thu cũ đổi mới",
        desc: "Mở trang chọn nhân viên hoặc khách hàng để tra cứu giá.",
        href: "/tradein-price",
      },
      {
        title: "Quy trình thu cũ đổi mới",
        desc: "Tài liệu quy trình thao tác và xử lý hồ sơ.",
        status: "Đang cập nhật",
      },
    ],
  },
  {
    id: "02",
    title: "Hệ Máy Mới",
    desc: "Chính sách liên quan sản phẩm mới và bán ra.",
    items: [
      {
        title: "Chính sách bảo hành",
        desc: "Thông tin bảo hành theo ngành hàng.",
        status: "Đang cập nhật",
      },
    ],
  },
  {
    id: "03",
    title: "Hệ Máy Cũ",
    desc: "Nghiệp vụ máy đã sử dụng và máy cũ thu mua.",
    items: [
      {
        title: "Máy ĐSD, Máy Cũ Thu Mua",
        desc: "Cẩm nang nghiệp vụ dành cho máy đã sử dụng.",
        status: "Đang cập nhật",
      },
    ],
  },
  {
    id: "04",
    title: "Demo",
    desc: "Công cụ xử lý máy trưng bày và demo.",
    items: [
      {
        title: "Gỡ Demo",
        desc: "Hướng dẫn và công cụ hỗ trợ gỡ demo.",
        status: "Đang cập nhật",
      },
    ],
  },
  {
    id: "05",
    title: "Công Cụ Hỗ Trợ",
    desc: "Tiện ích hỗ trợ nghiệp vụ ngành hàng.",
    items: [
      {
        title: "Công cụ hỗ trợ",
        desc: "Tổng hợp các tiện ích nội bộ đang hoàn thiện.",
        status: "Đang cập nhật",
      },
    ],
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="Trang chủ">
          <span className={styles.logoBox}>
            <img src="/mwg-logo.svg" alt="MWG" />
          </span>

          <span className={styles.brandText}>
            <strong>VTDD</strong>
            <small>Viễn Thông Di Động</small>
          </span>
        </Link>

        <Link href="/admin" className={styles.adminButton}>
          Admin
        </Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroGrid} />

        <div className={styles.heroInner}>
          <div className={styles.kicker}>NGÀNH HÀNG</div>
          <h1>Viễn Thông Di Động</h1>
          <p>Trung Tâm Chính Sách &amp; Nghiệp Vụ Sản Phẩm.</p>
        </div>
      </section>

      <section className={styles.moduleBoard} aria-label="Danh mục nghiệp vụ">
        {GROUPS.map((group) => (
          <article className={styles.moduleRow} key={group.id}>
            <div className={styles.moduleInfo}>
              <span className={styles.moduleId}>{group.id}</span>

              <div className={styles.moduleTitleBlock}>
                <h2>{group.title}</h2>
                <p>{group.desc}</p>
              </div>
            </div>

            <div className={styles.actions}>
              {group.items.map((item) => {
                const content = (
                  <>
                    <span className={styles.actionText}>
                      <strong>{item.title}</strong>
                      <small>{item.desc}</small>
                    </span>

                    {item.href ? (
                      <span className={styles.actionArrow}>›</span>
                    ) : (
                      <span className={styles.statusBadge}>{item.status}</span>
                    )}
                  </>
                );

                return item.href ? (
                  <Link key={item.title} href={item.href} className={cx(styles.actionCard, styles.actionActive)}>
                    {content}
                  </Link>
                ) : (
                  <div key={item.title} className={cx(styles.actionCard, styles.actionDisabled)} aria-disabled="true">
                    {content}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
