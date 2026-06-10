import Link from "next/link";
import styles from "./page.module.css";
import { getHomeCmsItems } from "@/lib/home-cms-store";

export const dynamic = "force-dynamic";

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

export default async function HomePage() {
  const cms = await getHomeCmsItems();

  const groups: ToolGroup[] = [
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
        cms["quy-trinh-thu-cu"].published
          ? {
              title: cms["quy-trinh-thu-cu"].title,
              desc: cms["quy-trinh-thu-cu"].summary,
              href: "/p/quy-trinh-thu-cu",
            }
          : {
              title: cms["quy-trinh-thu-cu"].draftTitle || "Quy trình thu cũ đổi mới",
              desc: cms["quy-trinh-thu-cu"].draftSummary || "Tài liệu quy trình thao tác, kiểm tra và xử lý hồ sơ.",
              status: "Đang cập nhật",
            },
      ],
    },
    {
      number: "02",
      title: "Hệ Máy Mới",
      desc: "Chính sách liên quan sản phẩm mới, bán ra và bảo hành.",
      items: cms["may-moi"].published
        ? [
            {
              title: cms["may-moi"].title,
              desc: cms["may-moi"].summary,
              href: "/p/may-moi",
            },
          ]
        : [
            {
              title: cms["may-moi"].draftTitle || "Chính sách bảo hành",
              desc: cms["may-moi"].draftSummary || "Thông tin chính sách bảo hành theo ngành hàng.",
              status: "Đang cập nhật",
            },
          ],
    },
    {
      number: "03",
      title: "Hệ Máy Cũ",
      desc: "Quản lý nhóm máy đã sử dụng, máy thu mua và nghiệp vụ liên quan.",
      items: cms["may-cu"].published
        ? [
            {
              title: cms["may-cu"].title,
              desc: cms["may-cu"].summary,
              href: "/p/may-cu",
            },
          ]
        : [
            {
              title: cms["may-cu"].draftTitle || "Máy ĐSD, Máy Cũ Thu Mua",
              desc: cms["may-cu"].draftSummary || "Thông tin nghiệp vụ dành cho máy đã sử dụng / máy cũ thu mua.",
              status: "Đang cập nhật",
            },
          ],
    },
    {
      number: "04",
      title: "Demo",
      desc: "Công cụ hỗ trợ xử lý máy trưng bày, demo và chuyển đổi.",
      items: cms.demo.published
        ? [
            {
              title: cms.demo.title,
              desc: cms.demo.summary,
              href: "/p/demo",
            },
          ]
        : [
            {
              title: cms.demo.draftTitle || "Gỡ Demo",
              desc: cms.demo.draftSummary || "Hướng dẫn và công cụ hỗ trợ xử lý gỡ demo.",
              status: "Đang cập nhật",
            },
          ],
    },
    {
      number: "05",
      title: "Công Cụ Hỗ Trợ",
      desc: "Khu vực mở rộng cho các công cụ vận hành ngành hàng.",
      items: [
        {
          title: "Công cụ hỗ trợ",
          desc: "Khu vực công cụ nghiệp vụ đang được cập nhật.",
          status: "Đang cập nhật",
        },
      ],
    },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/" aria-label="Về trang chủ">
          <span className={styles.logoShell}>
            <img src="/mwg-logo.svg" alt="MWG" />
          </span>

          <span>
            <strong>VTDD</strong>
            <small>Viễn Thông Di Động</small>
          </span>
        </Link>

        <Link className={styles.adminButton} href="/admin">
          Admin
        </Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroPattern} />
        <div className={styles.heroContent}>
          <span>NGÀNH HÀNG</span>
          <h1>Viễn Thông Di Động</h1>
          <p>Trung Tâm Chính Sách &amp; Nghiệp Vụ Sản Phẩm.</p>
        </div>
      </section>

      <section className={styles.modules} aria-label="Danh mục nghiệp vụ">
        {groups.map((group) => (
          <article className={styles.moduleCard} key={group.number}>
            <div className={styles.moduleTop}>
              <div className={styles.moduleNo}>{group.number}</div>
              <div>
                <h2>{group.title}</h2>
                <p>{group.desc}</p>
              </div>
            </div>

            <div className={styles.moduleTools}>
              {group.items.map((item) => {
                const content = (
                  <>
                    <span>
                      <b>{item.title}</b>
                      <small>{item.desc}</small>
                    </span>
                    {item.href ? <i>›</i> : <em>{item.status}</em>}
                  </>
                );

                return item.href ? (
                  <Link className={styles.toolItem} href={item.href} key={item.title}>
                    {content}
                  </Link>
                ) : (
                  <div className={styles.toolItemDisabled} key={item.title}>
                    {content}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </section>

      <footer className={styles.footer}>
        <span />
        <b>copyright 36964</b>
        <span />
      </footer>
    </main>
  );
}
