import styles from "@/components/NavigationFeedback.module.css";

export default function Loading() {
  return <main className={styles.loadingPage}>
    <section className={styles.loadingCard} role="status" aria-live="polite">
      <img src="/brand/vtdd-logo-v2.webp" width={110} height={110} alt="Viễn Thông Di Động" />
      <span className={styles.spinner} aria-hidden="true" />
      <strong>Đang mở trang…</strong>
      <p>Vui lòng chờ trong giây lát.</p>
    </section>
  </main>;
}
