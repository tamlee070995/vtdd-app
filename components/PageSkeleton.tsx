import styles from "./NavigationFeedback.module.css";

export default function PageSkeleton() {
  return <section className={styles.skeleton} role="status" aria-label="Đang tải nội dung">
    <span className={styles.skeletonEyebrow} />
    <span className={styles.skeletonHeading} />
    <span className={styles.skeletonLine} />
    <div className={styles.skeletonGrid}>{[0, 1, 2].map(index => <div className={styles.skeletonCard} key={index}><i /><span /><span /><span /></div>)}</div>
    <span className={styles.srOnly}>Đang tải nội dung…</span>
  </section>;
}
