"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { calculateTradeinQuote, formatTradeinRange, TRADEIN_GRADES,
  type NewTradeinProduct, type OldTradeinProduct, type PriceRange } from "@/lib/tradein-pricing";
import useTradeinPage from "./useTradeinPage";
import TradeinUpdateNotice from "./TradeinUpdateNotice";
import styles from "./Tradein.module.css";
import { suggestTradeinProducts } from "@/lib/tradein-search";
import UiNotice from "./UiNotice";

type SearchProduct = { id: string; brand: string; model: string; storage?: string };
const priceNumber = new Intl.NumberFormat("vi-VN");
function ProductName({ name, query }: { name: string; query: string }) {
  const tokens = query.trim().split(/[\s_]+/).filter(Boolean).map(token => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!tokens.length) return <>{name}</>;
  const pattern = new RegExp(`(${tokens.join("|")})`, "ig");
  return <>{name.split(pattern).map((part, index) => index % 2 ? <mark key={index}>{part}</mark> : part)}</>;
}
function RangeValue({ range, allowZero = false }: { range: Pick<PriceRange, "min" | "max"> & { incomplete?: boolean }; allowZero?: boolean }) {
  const label = formatTradeinRange(range, allowZero);
  if (range.incomplete || (!allowZero && !range.min && !range.max)) return <span className={styles.rangeValue}>{label}</span>;
  return <span className={styles.rangeValue} aria-label={label}>
    <span>{priceNumber.format(range.min)}</span>{range.min !== range.max ? <><span aria-hidden="true">–</span><span>{priceNumber.format(range.max)}</span></> : null}
  </span>;
}
function ProductSearch<T extends SearchProduct>({ label, placeholder, products, selected, disabled, onSelect, onClear }: {
  label: string; placeholder: string; products: T[]; selected: T | null; disabled?: boolean;
  onSelect: (product: T) => void; onClear: () => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const result = useMemo(() => suggestTradeinProducts(products, query), [products, query]);
  const matches = result.products;
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => { if (open && active >= 0) root.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [active, open]);
  const pick = (product: T) => { root.current?.querySelector("input")?.blur(); onSelect(product); setQuery(""); setOpen(false); setActive(-1); };
  return <div className={styles.searchField} ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={selected ? undefined : id}>{label}</label>
    {selected ? <div className={styles.selection}><span><b>{selected.model}</b><small>{selected.brand}{selected.storage ? ` · ${selected.storage}` : ""}</small></span>
      <button type="button" onClick={() => { onClear(); setQuery(""); setOpen(false); }}>Đổi máy</button></div> : <>
      <div className={styles.inputWrap}><span aria-hidden="true">⌕</span><input id={id} value={query} placeholder={placeholder} disabled={disabled}
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-describedby={`${id}-hint`} aria-activedescendant={open && active >= 0 && active < matches.length ? `${id}-${active}` : undefined}
        autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="search" maxLength={150}
        onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === "Escape") { setOpen(false); return; }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            setActive(current => event.key === "ArrowDown" ? Math.min(current + 1, matches.length - 1) : Math.max(0, current - 1));
          }
          if (event.key === "Enter" && open && matches.length) { event.preventDefault(); pick(matches[Math.max(active, 0)]); }
        }} /></div>
      {open && !disabled ? <div className={styles.suggestions} role="listbox" id={`${id}-list`} aria-label={`Kết quả ${label.toLowerCase()}`}>
        {matches.length ? matches.map((product, index) => <button type="button" tabIndex={-1} key={product.id} id={`${id}-${index}`} role="option" aria-selected={active === index}
          className={`${styles.option} ${active === index ? styles.activeOption : ""}`}
          onMouseDown={event => event.preventDefault()} onClick={() => pick(product)}>
          <b><ProductName name={product.model} query={query} /></b><small>{product.brand}{product.storage ? ` · ${product.storage}` : ""}</small>
        </button>) : <p className={styles.noResults}>{query.trim() ? "Không tìm thấy máy phù hợp. Thử tên model hoặc dung lượng khác." : "Nhập tên máy để xem gợi ý ngay. Ví dụ: iPhone 11 256 hoặc OPPO A60."}</p>}
        {result.total > matches.length ? <p className={styles.resultHint}>Đang hiện {matches.length}/{result.total} máy. Nhập thêm dung lượng để thu hẹp.</p> : null}
      </div> : null}
      <small className={styles.liveHint} id={`${id}-hint`} role="status">{query.trim() ? result.total ? `${result.total} máy phù hợp. Chọn gợi ý hoặc nhấn Enter.` : "Thử tên model hoặc dung lượng khác." : "Gợi ý theo tên máy, hãng và dung lượng."}</small>
    </>}
  </div>;
}

export default function TradeinLookup() {
  const { data, status, loading, error, refreshReason, retry } = useTradeinPage();
  const [old, setOld] = useState<OldTradeinProduct | null>(null);
  const [next, setNext] = useState<NewTradeinProduct | null>(null);
  const updatedAt = data ? new Date(data.syncedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false }) : "";
  return <><main className={styles.page} inert={Boolean(refreshReason)}>
    <header className={`${styles.topbar} ui-topbar`}><Link className={styles.brand} href="/" aria-label="Viễn Thông Di Động — Trang chủ">
      <Image src="/brand/vtdd-logo-header-v3.webp" width={46} height={46} alt="" /><span><b>Viễn Thông Di Động</b><small>Chính sách &amp; nghiệp vụ sản phẩm</small></span>
    </Link><Link className={styles.homeLink} href="/">Trang chủ <span aria-hidden="true">↗</span></Link></header>
    <div className={styles.shell}>
      <nav className={styles.breadcrumb} aria-label="Đường dẫn"><Link href="/">Trang chủ</Link><span>›</span><Link href="/#he-thu-cu-doi-moi">Hệ Thu Cũ Đổi Mới</Link><span>›</span><span aria-current="page">Tra giá</span></nav>
      <section className={styles.hero}><div><p className={styles.eyebrow}>HỆ THU CŨ ĐỔI MỚI</p><h1>Tra giá thu cũ đổi mới</h1><p className={styles.intro}>Chọn máy cũ để xem giá thu. Chọn thêm máy mới để xem trợ giá lên đời.</p></div>
        <span className={styles.publicBadge}>● Không cần đăng nhập</span>
      </section>
      <div className={styles.dataBar} aria-live="polite"><span>{loading ? "Đang tải bảng giá…" : data ? <>Cập nhật: <b>{updatedAt}</b></> : "Bảng giá thu cũ đổi mới"}</span>
        <button type="button" disabled={loading} onClick={() => window.location.reload()}>{loading ? "Đang tải…" : "Tải lại trang ↻"}</button></div>
      {status?.locked ? <section className={styles.maintenance} role="status"><span aria-hidden="true">⌁</span><h2>Trang tra giá đang tạm khóa</h2><p>{status.message}</p><small>Trang tự kiểm tra mỗi 30 giây. Khi mở lại, bạn sẽ nhận thông báo tải lại trang.</small></section> : <>
      {error ? <UiNotice onRetry={retry} busy={loading}>{error}</UiNotice> : null}
      {!data && loading ? <UiNotice tone="loading">Đang chuẩn bị danh sách máy và bảng giá…</UiNotice> : null}
      {data ? <div className={styles.steps} aria-busy={loading}>
        <section className={styles.step} aria-labelledby="old-heading"><div className={styles.stepHeading}><span className={styles.stepNumber}>01</span><div><p>MÁY ĐANG SỬ DỤNG</p><h2 id="old-heading">Tra giá máy cũ</h2></div><span className={styles.stepTag}>5 loại tình trạng</span></div>
          <ProductSearch key={`old-${data.version}`} label="Tìm máy cũ" placeholder="Nhập tên máy, hãng hoặc dung lượng…" products={data.oldProducts} selected={old} disabled={loading}
            onSelect={setOld} onClear={() => { setOld(null); setNext(null); }} />
          {old ? <div aria-live="polite"><div className={styles.resultsHeading}><h3>Giá thu theo tình trạng máy</h3><span>Đơn vị: đ</span></div>
            <div className={styles.priceGrid}>{TRADEIN_GRADES.map(grade => <article className={styles.priceCard} key={grade} aria-label={`Giá thu Loại ${grade}`}>
              <span className={styles.grade}>Loại {grade}</span><strong><RangeValue range={old.ranges[grade]} /></strong>
            </article>)}</div>
            <p className={styles.note}>Giá thu cụ thể được xác định sau khi kiểm tra tình trạng máy.</p>
            <a className={styles.nextStep} href="#may-moi">Tiếp: chọn máy mới để xem trợ giá <span aria-hidden="true">↓</span></a>
          </div> : <p className={styles.searchHint}>Tìm model và dung lượng máy để xem giá thu Loại 1–5.</p>}
        </section>
        <section id="may-moi" className={`${styles.step} ${!old ? styles.pendingStep : ""}`} aria-labelledby="new-heading"><div className={styles.stepHeading}><span className={styles.stepNumber}>02</span><div><p>MÁY MUỐN ĐỔI LÊN</p><h2 id="new-heading">Xem trợ giá lên đời</h2></div><span className={styles.stepTag}>{next ? "Đã chọn máy mới" : "Chọn thêm máy mới"}</span></div>
          <ProductSearch key={`new-${data.version}-${old?.id || "none"}`} label="Tìm máy mới" placeholder={old ? "Nhập tên máy mới muốn đổi lên…" : "Chọn máy cũ ở bước 1 trước"} products={data.newProducts} selected={next} disabled={!old || loading}
            onSelect={setNext} onClear={() => setNext(null)} />
          {old && next ? <div aria-live="polite"><div className={styles.resultsHeading}><h3>Giá thu + trợ giá theo tình trạng</h3><span>Đơn vị: đ</span></div><div className={styles.quoteGrid}>{TRADEIN_GRADES.map(grade => {
            const quote = calculateTradeinQuote(old, next, grade);
            return <article className={styles.quoteCard} key={grade} aria-label={`Giá thu và trợ giá Loại ${grade}`}><span className={styles.grade}>Loại {grade}</span>
              <div className={styles.oldValue}><small>Giá thu máy cũ</small><b><RangeValue range={old.ranges[grade]} /></b></div>
              <div className={styles.support}><small>Trợ giá lên đời</small><b>{quote ? <RangeValue range={quote.support} allowZero /> : "—"}</b></div>
              <div className={styles.total}><small>Tổng giá thu + trợ giá</small><strong>{quote ? <RangeValue range={quote.total} /> : "Chưa đủ dữ liệu"}</strong></div>
            </article>;
          })}</div></div> : <div className={styles.emptyQuote}><span aria-hidden="true">↗</span><p>{old ? "Chọn máy mới để xem trợ giá và tổng giá trị thu đổi cho cả 5 loại." : "Bắt đầu bằng việc chọn máy cũ. Mức trợ giá sẽ được tính theo máy mới bạn chọn."}</p></div>}
        </section>
      </div> : null}</>}
      <footer className={styles.footer}><span>VIỄN THÔNG DI ĐỘNG</span><Link href="/#he-thu-cu-doi-moi">Hệ Thu Cũ Đổi Mới <span aria-hidden="true">↗</span></Link></footer>
    </div>
  </main>{refreshReason ? <TradeinUpdateNotice reason={refreshReason} /> : null}</>;
}
