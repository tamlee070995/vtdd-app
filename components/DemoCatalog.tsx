import Link from "next/link";
import { getPublishedDemoBrands } from "@/lib/demo-store";
import { getHomeCmsItem } from "@/lib/home-cms-store";
import { hasDemoContent } from "@/lib/demo-content";
import { sanitizeHtml } from "@/lib/html-sanitize";
import DemoShell from "./DemoShell";
import styles from "./Demo.module.css";

export default async function DemoCatalog() {
  const [brands, page] = await Promise.all([getPublishedDemoBrands(), getHomeCmsItem("demo")]);
  return <DemoShell><section className={styles.hero}>
    <p className={styles.kicker}>HƯỚNG DẪN THEO HÃNG</p><h1>{page?.published ? page.title : "Gỡ Demo"}</h1><p className={styles.summary}>Chọn hãng để xem hướng dẫn dành cho máy trưng bày.</p>
    <div className={styles.brandGrid}>{brands.map(brand => <Link className={styles.brandButton} href={`/p/demo/${brand.slug}`} key={brand.id}><b>{brand.guide.name}</b><small>{hasDemoContent(brand.guide) ? "Xem hướng dẫn ›" : "Đang cập nhật ›"}</small></Link>)}</div>
    {!brands.length ? <p className={styles.empty}>Danh mục hãng đang được cập nhật.</p> : null}
  </section>
  {page?.published && page.body ? <section className={styles.article}><h2>Thông tin &amp; công cụ chung</h2><div className={styles.richBody} dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.body) }} /></section> : null}
  </DemoShell>;
}
