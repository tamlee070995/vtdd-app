"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePortalGroup } from "./PortalShell";
import styles from "@/app/page.module.css";

type IconName = "tradein" | "phone" | "used" | "demo" | "tools" | "search" | "printer" | "document";
export type HomeTool = { title: string; desc: string; mobileDesc?: string; featured?: boolean; href?: string; status?: string; icon: IconName };
export type HomeGroup = { id: string; title: string; navTitle: string; shortTitle: string; desc: string; mobileDesc?: string; icon: IconName; items: HomeTool[] };

const quickGuides: Record<string, { title: string; steps: { title: string; desc: string }[] }> = {
  "he-thu-cu-doi-moi": {
    title: "Tra giá và chuẩn bị hồ sơ thu cũ",
    steps: [
      { title: "Tìm đúng máy", desc: "Chọn tên máy cũ và dung lượng để xem giá theo Loại 1–5." },
      { title: "Xem trợ giá lên đời", desc: "Chọn thêm máy mới trong trang tra giá để xem mức trợ giá." },
      { title: "In tem, xem quy trình", desc: "Mở công cụ in sticker hoặc tài liệu quy trình để thực hiện bước tiếp theo." },
    ],
  },
  "he-may-moi": {
    title: "Tra cứu chính sách sản phẩm mới",
    steps: [
      { title: "Mở tài liệu", desc: "Chọn chính sách bảo hành trong nhóm Hệ máy mới." },
      { title: "Kiểm tra phạm vi áp dụng", desc: "Đối chiếu sản phẩm và các điều kiện được nêu trong tài liệu." },
      { title: "Xem nội dung hiện hành", desc: "Mở lại tài liệu khi cần tư vấn để đọc nội dung đang được xuất bản." },
    ],
  },
  "he-may-cu": {
    title: "Tìm nghiệp vụ dành cho máy cũ",
    steps: [
      { title: "Mở tài liệu máy cũ", desc: "Chọn mục máy đã sử dụng và máy cũ thu mua trong nhóm này." },
      { title: "Chọn nội dung phù hợp", desc: "Tìm phần liên quan đến loại máy và nghiệp vụ cần xử lý." },
      { title: "Đối chiếu quy trình", desc: "Đọc các bước và lưu ý trong tài liệu trước khi thực hiện." },
    ],
  },
  demo: {
    title: "Mở hướng dẫn gỡ demo theo hãng",
    steps: [
      { title: "Mở Gỡ Demo", desc: "Chọn công cụ Gỡ Demo để vào danh mục hãng." },
      { title: "Chọn đúng hãng", desc: "Mở trang hãng phù hợp với thiết bị đang xử lý." },
      { title: "Làm theo hướng dẫn", desc: "Xem các bước, ảnh minh họa hoặc tệp công cụ được đính kèm." },
    ],
  },

};

function Icon({ name }: { name: IconName }) {
  const paths = {
    tradein: <use href="/icons/home-navigation-v1.svg#icon-thu-cu-doi-moi" />,
    phone: <use href="/icons/home-navigation-v1.svg#icon-may-moi" />,
    used: <use href="/icons/home-navigation-v1.svg#icon-may-cu" />,
    demo: <use href="/icons/home-navigation-v1.svg#icon-demo" />,
    tools: <use href="/icons/home-navigation-v1.svg#icon-cong-cu" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    printer: <><path d="M7 8V3h10v5M7 17H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-3" /><path d="M7 14h10v7H7zM17 11h1" /></>,
    document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" /><path d="M14 2v6h6M8 12h8M8 16h6" /></>,
  };
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === "search" || name === "printer" || name === "document" ? 1.7 : 1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

export default function HomePortal({ groups }: { groups: HomeGroup[] }) {
  const { activeId } = usePortalGroup();
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const active = groups.find(group => group.id === activeId) || groups[0];
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const searching = terms.length > 0;
  const guide = quickGuides[active.id];
  const entries = (searching ? groups : [active]).flatMap(group => group.items
    .filter(item => !searching || terms.every(term => normalize(`${item.title} ${item.desc} ${group.title}`).includes(term)))
    .map(item => ({ ...item, group })));

  useEffect(() => { setQuery(""); }, [activeId]);

  return <main className={styles.main}>
        <div className={styles.content} id="home-tools-panel">
          <header className={styles.contentHeader}>
            <div className={styles.heading}>
              <p className={styles.eyebrow}>Viễn Thông Di Động</p>
              <div className={styles.titleRow}>
                <h1>{searching ? "Kết quả tìm kiếm" : active.title}</h1>
                <span className={styles.count} role="status" aria-live="polite" aria-atomic="true">{entries.length} {searching ? "kết quả" : "mục"}</span>
              </div>
              <p className={styles.groupDescription}>
                <span className={styles.desktopDescription}>{searching ? "Tìm trong tất cả nhóm nghiệp vụ" : active.desc}</span>
                <span className={styles.mobileDescription}>{searching ? "Tìm trong tất cả nhóm nghiệp vụ" : active.mobileDesc || active.desc}</span>
              </p>
            </div>
            <form className={styles.search} role="search" onSubmit={event => event.preventDefault()}>
              <Icon name="search" />
              <input ref={search} type="search" aria-label="Tìm nhanh công cụ" placeholder="Tìm nhanh…" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setQuery(""); }} />
              {query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => { setQuery(""); search.current?.focus(); }}>×</button>}
            </form>
          </header>
          <section className={styles.toolGrid} data-single={entries.length === 1 || undefined} aria-label={searching ? "Kết quả tìm kiếm công cụ" : `Công cụ ${active.title}`}>
            {entries.map(item => {
              const body = <>
                <span className={styles.toolVisual}><span className={styles.toolIcon}><Icon name={item.icon} /></span>{item.featured && <span className={styles.featuredBadge}>Dùng nhiều</span>}</span>
                <span className={styles.toolText}>
                  {searching && <span className={styles.category}>{item.group.title}</span>}
                  <b>{item.title}</b>
                  {item.href && <span className={styles.openingLabel}><i aria-hidden="true" />Đang mở…</span>}
                  <small className={styles.desktopDescription}>{item.desc}</small>
                  <small className={styles.mobileDescription} title={item.desc}>{item.mobileDesc || item.desc}</small>
                  {!item.href && <em>{item.status || "Đang cập nhật"}</em>}
                </span>
                {item.href && <span className={styles.openAction} aria-hidden="true"><span className={styles.actionLabel}>Xem ngay</span><i className={styles.arrow}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7" /></svg></i></span>}
              </>;
              return item.href ? <Link className={styles.toolItem} data-featured={item.featured || undefined} href={item.href} key={`${item.group.id}-${item.title}`}>{body}</Link> : <div className={styles.toolItemDisabled} key={`${item.group.id}-${item.title}`}>{body}</div>;
            })}
          </section>
          {!entries.length && <div className={styles.empty}><span className={styles.emptyIcon}><Icon name="search" /></span><h2>Chưa tìm thấy công cụ</h2><p>Thử tên ngắn hơn như “giá”, “sticker” hoặc “demo”.</p><button type="button" onClick={() => { setQuery(""); search.current?.focus(); }}>Xóa tìm kiếm</button></div>}
          {!searching && guide && <section className={styles.quickGuide} aria-label="Hướng dẫn nhanh">
            <div className={styles.guideHeading}><span><Icon name="document" /></span><div><p>HƯỚNG DẪN NHANH</p><h2>{guide.title}</h2></div></div>
            <ol className={styles.guideSteps}>{guide.steps.map((step, index) => <li key={step.title}><span className={styles.guideNumber}>{index + 1}</span><div><h3>{step.title}</h3><p>{step.desc}</p></div></li>)}</ol>
          </section>}
        </div>
      </main>;
}
