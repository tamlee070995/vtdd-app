import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Trang Chủ Ngành Hàng | Viễn Thông Di Động",
  description: "Trung Tâm Chính Sách & Nghiệp Vụ Sản Phẩm ngành hàng Viễn Thông Di Động.",
};

type ToolItem = {
  title: string;
  desc: string;
  href?: string;
  status?: string;
  primary?: boolean;
};

type ModuleItem = {
  no: string;
  title: string;
  desc: string;
  accent: "yellow" | "blue" | "green" | "violet" | "slate";
  tools: ToolItem[];
};

const MODULES: ModuleItem[] = [
  {
    no: "01",
    title: "Hệ Thu Cũ Đổi Mới",
    desc: "Công cụ, quy trình và bảng giá phục vụ vận hành Thu cũ đổi mới.",
    accent: "yellow",
    tools: [
      {
        title: "Bảng giá thu cũ đổi mới",
        desc: "Tra cứu bảng giá, trợ giá và chọn luồng nhân viên / khách hàng.",
        href: "/tradein-price",
        primary: true,
      },
      {
        title: "Quy trình thu cũ đổi mới",
        desc: "Tài liệu quy trình thao tác, kiểm tra và xử lý hồ sơ.",
        status: "Đang cập nhật",
      },
    ],
  },
  {
    no: "02",
    title: "Hệ Máy Mới",
    desc: "Chính sách liên quan sản phẩm mới, bán ra và bảo hành.",
    accent: "blue",
    tools: [
      {
        title: "Chính sách bảo hành",
        desc: "Thông tin chính sách bảo hành theo ngành hàng.",
        status: "Đang cập nhật",
      },
    ],
  },
  {
    no: "03",
    title: "Hệ Máy Cũ",
    desc: "Quản lý nhóm máy đã sử dụng, máy thu mua và nghiệp vụ liên quan.",
    accent: "green",
    tools: [
      {
        title: "Máy ĐSD, Máy Cũ Thu Mua",
        desc: "Thông tin nghiệp vụ dành cho máy đã sử dụng / máy cũ thu mua.",
        status: "Đang cập nhật",
      },
    ],
  },
  {
    no: "04",
    title: "Demo",
    desc: "Công cụ hỗ trợ xử lý máy trưng bày, demo và chuyển đổi.",
    accent: "violet",
    tools: [
      {
        title: "Gỡ Demo",
        desc: "Hướng dẫn và công cụ hỗ trợ xử lý gỡ demo.",
        status: "Đang cập nhật",
      },
    ],
  },
  {
    no: "05",
    title: "Công Cụ Hỗ Trợ",
    desc: "Khu vực tập hợp các tiện ích hỗ trợ vận hành ngành hàng.",
    accent: "slate",
    tools: [
      {
        title: "Công cụ hỗ trợ",
        desc: "Các tiện ích nội bộ sẽ được bổ sung tại đây.",
        status: "Đang cập nhật",
      },
    ],
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function renderTool(tool: ToolItem) {
  const body = (
    <>
      <span className={styles.toolCopy}>
        <strong>{tool.title}</strong>
        <small>{tool.desc}</small>
      </span>

      {tool.href ? (
        <span className={styles.goButton} aria-hidden="true">
          ›
        </span>
      ) : (
        <span className={styles.statusBadge}>{tool.status || "Đang cập nhật"}</span>
      )}
    </>
  );

  if (tool.href) {
    return (
      <Link
        key={tool.title}
        href={tool.href}
        className={cx(styles.toolCard, tool.primary && styles.primaryTool)}
      >
        {body}
      </Link>
    );
  }

  return (
    <div key={tool.title} className={cx(styles.toolCard, styles.disabledTool)}>
      {body}
    </div>
  );
}

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="Viễn Thông Di Động">
          <span className={styles.logoFrame}>
            <img src="/mwg-logo.svg" alt="MWG" />
          </span>

          <span className={styles.brandCopy}>
            <strong>VTDD</strong>
            <small>Viễn Thông Di Động</small>
          </span>
        </Link>

        <Link className={styles.adminButton} href="/admin">
          Admin
        </Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <span className={styles.heroKicker}>Ngành hàng</span>
          <h1>Viễn Thông Di Động</h1>
          <p>Trung Tâm Chính Sách &amp; Nghiệp Vụ Sản Phẩm.</p>
        </div>
      </section>

      <section className={styles.moduleGrid} aria-label="Danh mục nghiệp vụ ngành hàng">
        {MODULES.map((module) => (
          <article
            key={module.no}
            className={cx(styles.moduleCard, styles[`accent_${module.accent}`])}
          >
            <div className={styles.moduleHeader}>
              <span className={styles.moduleNo}>{module.no}</span>
              <div className={styles.moduleTitleBlock}>
                <h2>{module.title}</h2>
                <p>{module.desc}</p>
              </div>
            </div>

            <div className={styles.toolList}>{module.tools.map(renderTool)}</div>
          </article>
        ))}
      </section>
    </main>
  );
}
