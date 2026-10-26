"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import HomeNavigationFeedback from "./HomeNavigationFeedback";
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
  "cong-cu-ho-tro": {
    title: "Bắt đầu một nghiệp vụ hỗ trợ",
    steps: [
      { title: "Vào cổng công cụ", desc: "Mở danh mục công cụ hỗ trợ siêu thị." },
      { title: "Chọn nghiệp vụ", desc: "Tìm công cụ phù hợp như PMH, chiến giá hoặc thẩm định hồ sơ." },
      { title: "Chuẩn bị thông tin", desc: "Điền thông tin theo yêu cầu của công cụ đang sử dụng." },
    ],
  },
};

function Icon({ name }: { name: IconName }) {
  const paths = {
    tradein: <><path d="m8 4 2-2 3 5-5 1 1-2H6L3 11" /><path d="m20 10 2 2-3 5-3-4 2 1 1-3-3-5" /><path d="m13 21-3 1-3-5 5-1-1 2h4l3-5" /></>,
    phone: <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M10 5h4M11 19h2" /></>,
    used: <><path d="M3 9a9 9 0 0 1 15-4l3 3M21 3v5h-5M21 15a9 9 0 0 1-15 4l-3-3M3 21v-5h5" /><path d="M10 8h4v8h-4z" /></>,
    demo: <><rect x="3" y="3" width="18" height="13" rx="2" /><path d="m7 12 3-4 3 3 4-5M8 21h8M12 16v5" /></>,
    tools: <><path d="m14 6 4 4M3 21l9-9M3 3l18 18M3 3l5 1-4 4-1-5ZM17 3a5 5 0 0 0-6 6l4 4a5 5 0 0 0 6-6l-4 4-4-4 4-4Z" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    printer: <><path d="M7 8V3h10v5M7 17H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-3" /><path d="M7 14h10v7H7zM17 11h1" /></>,
    document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" /><path d="M14 2v6h6M8 12h8M8 16h6" /></>,
  };
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

export default function HomePortal({ groups }: { groups: HomeGroup[] }) {
  const [activeId, setActiveId] = useState(groups[0].id);
  const [query, setQuery] = useState("");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const search = useRef<HTMLInputElement>(null);
  const active = groups.find(group => group.id === activeId) || groups[0];
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const searching = terms.length > 0;
  const guide = quickGuides[active.id];
  const entries = (searching ? groups : [active]).flatMap(group => group.items
    .filter(item => !searching || terms.every(term => normalize(`${item.title} ${item.desc} ${group.title}`).includes(term)))
    .map(item => ({ ...item, group })));

  useEffect(() => {
    function restoreGroup() {
      const id = window.location.hash.slice(1);
      const selected = groups.find(group => group.id === id);
      if (selected || !id) {
        setActiveId(selected?.id || groups[0].id);
        setQuery("");
      }
    }
    restoreGroup();
    window.addEventListener("hashchange", restoreGroup);
    window.addEventListener("popstate", restoreGroup);
    return () => {
      window.removeEventListener("hashchange", restoreGroup);
      window.removeEventListener("popstate", restoreGroup);
    };
  }, [groups]);

  function selectGroup(id: string) {
    setActiveId(id);
    setQuery("");
    // Keep the selected category when opening a tool and returning with Back.
    window.history.replaceState(window.history.state, "", `#${id}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % groups.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + groups.length) % groups.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = groups.length - 1;
    else return;
    event.preventDefault();
    selectGroup(groups[next].id);
    tabs.current[next]?.focus();
  }

  return <HomeNavigationFeedback>
    <div className={styles.page}>
      <a className={styles.skipLink} href="#noi-dung">Đến nội dung</a>
      <aside className={styles.sidebar}>
        <header className={styles.brandRow}>
          <Link className={styles.brand} href="/" aria-label="Viễn Thông Di Động — Trang chủ">
            <Image src="/brand/vtdd-logo-header-v3.webp" width={52} height={52} alt="Viễn Thông Di Động" unoptimized priority />
            <span><strong>ICT</strong><small>Viễn Thông Di Động</small></span>
          </Link>
          <Link className={styles.mobileAdmin} href="/admin">Admin</Link>
        </header>
        <nav className={styles.navigation} aria-label="Danh mục nghiệp vụ">
          <div className={styles.navHeading}>DANH MỤC NGHIỆP VỤ</div>
          <div className={styles.tabs} role="tablist" aria-label="Nhóm nghiệp vụ">
            {groups.map((group, index) => <button className={styles.tab} key={group.id} ref={node => { tabs.current[index] = node; }} type="button" role="tab" id={`tab-${group.id}`} aria-selected={active.id === group.id} aria-controls="home-tools-panel" tabIndex={active.id === group.id ? 0 : -1} onClick={() => selectGroup(group.id)} onKeyDown={event => handleTabKey(event, index)}>
              <Icon name={group.icon} /><span className={styles.desktopLabel}>{group.navTitle}</span><span className={styles.mobileLabel}>{group.shortTitle}</span>
            </button>)}
          </div>
        </nav>
        <div className={styles.sidebarFooter}>
          <p>Chính sách &amp; nghiệp vụ<br />sản phẩm viễn thông</p>
          <Link className={styles.adminButton} href="/admin"><span>Quản trị hệ thống</span><span aria-hidden="true">↗</span></Link>
        </div>
      </aside>

      <main className={styles.main} id="noi-dung" tabIndex={-1}>
        <div className={styles.content} id="home-tools-panel" role="tabpanel" aria-labelledby={`tab-${active.id}`} tabIndex={0}>
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
      </main>
    </div>
  </HomeNavigationFeedback>;
}
