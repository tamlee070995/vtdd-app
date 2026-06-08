import Link from "next/link";
import styles from "./page.module.css";

type ToolItem = {
  title: string;
  desc: string;
  href?: string;
  status?: string;
};

type ToolGroup = {
  number: string;
  title: string;
  desc: string;
  items: ToolItem[];
};

const GROUPS: ToolGroup[] = [
  {
    number: "01",
    title: "Hệ Thu Cũ Đổi Mới",
    desc: "Công cụ, quy trình và bảng giá phục vụ vận hành Thu cũ đổi mới.",
    items: [
      {
        title: "Bảng giá thu cũ đổi mới",
        desc: "Tra cứu bảng giá, trợ giá và chọn luồng nhân viên / khách hàng.",
        href: "/tradein-price",
      },
      {
        title: "Quy trình thu cũ đổi mới",
        desc: "Tài liệu quy trình thao tác, kiểm tra và xử lý hồ sơ.",
        status: "Đang cập nhật",
      },
    ],
  },
  {
    number: "02",
    title: "Hệ Máy Mới",
    desc: "Chính sách liên quan sản phẩm mới, bán ra và bảo hành.",
    items: [
      {
        title: "Chính sách bảo hành",
        desc: "Thông tin chính sách bảo hành theo ngành hàng.",
        status: "Đang cập nhật",
      },
    ],
  },
  {
    number: "03",
    title: "Hệ Máy Cũ",
    desc: "Quản lý nhóm máy đã sử dụng, máy thu mua và nghiệp vụ liên quan.",
    items: [
      {
        title: "Máy ĐSD, Máy Cũ Thu Mua",
        desc: "Thông tin nghiệp vụ dành cho máy đã sử dụng / máy cũ thu mua.",
        status: "Đang cập nhật",
      },
    ],
  },
  {
    number: "04",
    title: "Demo",
    desc: "Công cụ hỗ trợ xử lý máy trưng bày, demo và chuyển đổi.",
    items: [
      {
        title: "Gỡ Demo",
        desc: "Hướng dẫn và công cụ hỗ trợ xử lý gỡ demo.",
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
        <Link className={styles.brand} href="/" aria-label="Về trang chủ">
          <span className={styles.logoShell}>
            <img src="/mwg-logo.svg" alt="MWG" className={styles.logo} />
          </span>

          <span className={styles.brandText}>
            <strong>VTDD</strong>
            <small>Viễn Thông Di Động</small>
          </span>
        </Link>

        <nav className={styles.nav}>
          <Link className={styles.adminButton} href="/admin">
            Admin
          </Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroPattern} />

        <div className={styles.heroContent}>
          <div className={styles.kicker}>NGÀNH HÀNG</div>

          <h1>Viễn Thông Di Động</h1>

          <p>Trung Tâm Chính Sách &amp; Nghiệp Vụ Sản Phẩm.</p>
        </div>
      </section>

      <section className={styles.desktopModuleGrid} aria-label="Danh mục nghiệp vụ">
        {GROUPS.map((group) => (
          <article className={styles.moduleCard} key={group.number}>
            <div className={styles.moduleHead}>
              <div className={styles.moduleNumber}>{group.number}</div>

              <div>
                <h2>{group.title}</h2>
                <p>{group.desc}</p>
              </div>
            </div>

            <div className={styles.toolList}>
              {group.items.map((item) => {
                const content = (
                  <>
                    <span className={styles.toolText}>
                      <strong>{item.title}</strong>
                      <small>{item.desc}</small>
                    </span>

                    {item.href ? (
                      <span className={styles.openIcon}>›</span>
                    ) : (
                      <span className={styles.statusBadge}>{item.status}</span>
                    )}
                  </>
                );

                return item.href ? (
                  <Link
                    key={item.title}
                    href={item.href}
                    className={cx(styles.toolCard, styles.activeTool)}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={item.title}
                    className={cx(styles.toolCard, styles.disabledTool)}
                    aria-disabled="true"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </section>

      <section className={styles.mobileModuleList} aria-label="Danh mục nghiệp vụ mobile">
        {GROUPS.map((group) => (
          <article className={styles.mobileGroup} key={group.number}>
            <div className={styles.mobileGroupHeader}>
              <span>{group.number}</span>
              <div>
                <h2>{group.title}</h2>
                <p>{group.desc}</p>
              </div>
            </div>

            <div className={styles.mobileTools}>
              {group.items.map((item) =>
                item.href ? (
                  <Link className={styles.mobileTool} href={item.href} key={item.title}>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.desc}</small>
                    </span>
                    <b>›</b>
                  </Link>
                ) : (
                  <div className={styles.mobileToolDisabled} key={item.title}>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.desc}</small>
                    </span>
                    <em>{item.status}</em>
                  </div>
                )
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}