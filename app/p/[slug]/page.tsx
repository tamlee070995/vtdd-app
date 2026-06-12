import Link from "next/link";
import { notFound } from "next/navigation";
import { getHomeCmsItem } from "@/lib/home-cms-store";
import { sanitizeHtml } from "@/lib/html-sanitize";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function bodyToHtml(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "<p>Nội dung đang cập nhật.</p>";
  if (raw.includes("<") && raw.includes(">")) return sanitizeHtml(raw);
  const html = raw
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");
  return sanitizeHtml(html);
}

export default async function PublishedCmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getHomeCmsItem(slug);

  if (!item || !item.published) {
    notFound();
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <span><img src="/mwg-logo.svg" alt="MWG" /></span>
          <b>Viễn Thông Di Động</b>
        </Link>
        <Link href="/" className={styles.back}>Trang chủ</Link>
      </header>

      <article className={styles.article}>
        <div className={styles.kicker}>{item.label}</div>
        <h1>{item.title}</h1>
        <p className={styles.summary}>{item.summary}</p>

        <div
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: bodyToHtml(item.body) }}
        />
      </article>
    </main>
  );
}
