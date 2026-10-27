import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Demo.module.css";

export default function DemoShell({ children, brand }: { children: ReactNode; brand?: string }) {
  return <main data-portal-page className={`${styles.page} ui-public-page`}>
    <header data-page-header className={`${styles.topbar} ui-topbar`}><Link className={styles.brand} href="/"><span className={styles.logo}><img src="/brand/vtdd-logo-header-v3.webp" alt="Viễn Thông Di Động" /></span><span><b>Viễn Thông Di Động</b><small>Chính sách &amp; nghiệp vụ sản phẩm</small></span></Link><Link className={styles.homeLink} href={brand ? "/p/demo" : "/"}>{brand ? "Danh mục hãng" : "Trang chủ"}</Link></header>
    <div className={styles.shell}><nav className={styles.breadcrumb} aria-label="Đường dẫn"><Link href="/">Trang chủ</Link><span>›</span><Link href="/p/demo">Gỡ Demo</Link>{brand ? <><span>›</span><span aria-current="page">{brand}</span></> : null}</nav>{children}</div>
  </main>;
}
