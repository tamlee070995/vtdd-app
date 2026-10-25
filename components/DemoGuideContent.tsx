import { demoGuideHtml, demoUrl, demoVideoEmbed, hasDemoContent, type DemoGuide } from "@/lib/demo-content";
import styles from "./Demo.module.css";

function safeUrl(value: string) { try { return demoUrl(value); } catch { return ""; } }
export default function DemoGuideContent({ guide }: { guide: DemoGuide }) {
  const video = safeUrl(guide.videoUrl);
  const embed = video ? demoVideoEmbed(video) : "";
  return <>
    {hasDemoContent(guide) ? null : <div className={styles.empty}>Hướng dẫn đang được cập nhật. Vui lòng quay lại sau.</div>}
    {guide.features.text && guide.body ? <div className={styles.richBody} dangerouslySetInnerHTML={{ __html: demoGuideHtml(guide) }} /> : null}
    {guide.features.images && guide.images.length > 0 ? <section className={styles.gallery} aria-label="Ảnh minh họa">
      {guide.images.map((image, index) => safeUrl(image.url) ? <figure key={index}><img src={safeUrl(image.url)} alt={image.label || `Ảnh minh họa ${index + 1}`} loading="lazy" />{image.label ? <figcaption>{image.label}</figcaption> : null}</figure> : null)}
    </section> : null}
    {guide.features.video && video ? <section className={styles.mediaSection} aria-label="Video hướng dẫn"><h2>Video hướng dẫn</h2>
      {embed ? <iframe className={styles.video} src={embed} title={`Video hướng dẫn ${guide.name}`} loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <video className={styles.video} src={video} controls preload="metadata" />}
    </section> : null}
    {guide.features.files && guide.files.length > 0 ? <section className={styles.mediaSection}><h2>Tài liệu &amp; công cụ tải về</h2><div className={styles.downloads}>
      {guide.files.map((file, index) => safeUrl(file.url) ? <a key={index} href={safeUrl(file.url)} target="_blank" rel="noopener noreferrer">{file.label || `Tệp đính kèm ${index + 1}`} <span aria-hidden="true">↗</span></a> : null)}
    </div></section> : null}
  </>;
}
