"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { calculateTradeinQuote, formatTradeinRange, TRADEIN_GRADES, tradeinMatches,
  type NewTradeinProduct, type OldTradeinProduct, type TradeinData } from "@/lib/tradein-pricing";
import styles from "./Tradein.module.css";

type SearchProduct = { id: string; brand: string; model: string; storage?: string };
function ProductSearch<T extends SearchProduct>({ label, placeholder, products, selected, disabled, onSelect, onClear }: {
  label: string; placeholder: string; products: T[]; selected: T | null; disabled?: boolean;
  onSelect: (product: T) => void; onClear: () => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = useMemo(() => products.filter(product => tradeinMatches(product, query)).slice(0, 40), [products, query]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => { if (open && active >= 0) root.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [active, open]);
  const pick = (product: T) => { onSelect(product); setQuery(""); setOpen(false); setActive(-1); };
  return <div className={styles.searchField} ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={selected ? undefined : id}>{label}</label>
    {selected ? <div className={styles.selection}><span><b>{selected.model}</b><small>{selected.brand}{selected.storage ? ` · ${selected.storage}` : ""}</small></span>
      <button type="button" onClick={() => { onClear(); setQuery(""); setOpen(false); }}>Đổi máy</button></div> : <>
      <div className={styles.inputWrap}><span aria-hidden="true">⌕</span><input id={id} value={query} placeholder={placeholder} disabled={disabled}
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
        autoComplete="off" maxLength={150}
        onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === "Escape") { setOpen(false); return; }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            setActive(current => event.key === "ArrowDown" ? Math.min(current + 1, matches.length - 1) : Math.max(0, current - 1));
          }
          if (event.key === "Enter" && open && active >= 0 && matches[active]) { event.preventDefault(); pick(matches[active]); }
        }} /></div>
      {open && !disabled ? <div className={styles.suggestions} role="listbox" id={`${id}-list`} aria-label={`Kết quả ${label.toLowerCase()}`}>
        {matches.length ? matches.map((product, index) => <div key={product.id} id={`${id}-${index}`} role="option" aria-selected={active === index}
          className={`${styles.option} ${active === index ? styles.activeOption : ""}`}
          onPointerDown={event => event.preventDefault()} onClick={() => pick(product)}>
          <b>{product.model}</b><small>{product.brand}{product.storage ? ` · ${product.storage}` : ""}</small>
        </div>) : <p className={styles.noResults}>Không tìm thấy máy phù hợp. Thử tên model hoặc dung lượng khác.</p>}
        {matches.length === 40 ? <p className={styles.resultHint}>Nhập thêm model hoặc dung lượng để thu hẹp kết quả.</p> : null}
      </div> : null}
    </>}
  </div>;
}

export default function TradeinLookup() {
  const [data, setData] = useState<TradeinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [old, setOld] = useState<OldTradeinProduct | null>(null);
  const [next, setNext] = useState<NewTradeinProduct | null>(null);
  const loadId = useRef(0);
  async function load() {
    const requestId = ++loadId.current;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/tradein", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Chưa tải được bảng giá.");
      if (requestId !== loadId.current) return;
      setData(payload.data); setOld(null); setNext(null);
    } catch (reason) {
      if (requestId === loadId.current) setError(reason instanceof Error ? reason.message : "Chưa tải được bảng giá.");
    } finally { if (requestId === loadId.current) setLoading(false); }
  }
  useEffect(() => { const state = loadId; void load(); return () => { state.current++; }; }, []);
  const updatedAt = data ? new Date(data.syncedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false }) : "";
  return <main className={styles.page}>
    <header className={styles.topbar}><Link className={styles.brand} href="/" aria-label="Viễn Thông Di Động — Trang chủ">
      <Image src="/mwg-logo.svg" width={46} height={46} alt="" /><span><b>Viễn Thông Di Động</b><small>Chính sách &amp; nghiệp vụ sản phẩm</small></span>
    </Link><Link className={styles.homeLink} href="/">Trang chủ <span aria-hidden="true">↗</span></Link></header>
    <div className={styles.shell}>
      <nav className={styles.breadcrumb} aria-label="Đường dẫn"><Link href="/">Trang chủ</Link><span>›</span><Link href="/#he-thu-cu-doi-moi">Hệ Thu Cũ Đổi Mới</Link><span>›</span><span aria-current="page">Tra giá</span></nav>
      <section className={styles.hero}><div><p className={styles.eyebrow}>THU CŨ ĐỔI MỚI</p><h1>Máy cũ của bạn.<br /><span>Giá trị lên đời mới.</span></h1><p className={styles.intro}>Tra giá thu theo tình trạng máy và xem mức trợ giá khi đổi lên máy mới.</p></div>
        <div className={styles.heroAside}><span className={styles.publicBadge}>● Tra cứu không cần đăng nhập</span><p>Chọn máy cũ <span>→</span> Xem giá thu<br />Chọn máy mới <span>→</span> Xem tổng trợ giá</p></div>
      </section>
      <div className={styles.dataBar} aria-live="polite"><span>{loading ? "Đang tải bảng giá…" : data ? <>Cập nhật: <b>{updatedAt}</b></> : "Bảng giá thu cũ đổi mới"}</span>
        <button type="button" disabled={loading} onClick={() => void load()}>{loading ? "Đang tải…" : "Tải lại bảng giá ↻"}</button></div>
      {error ? <div role="alert" className={styles.error}>{error}{data ? <p>Bạn đang xem bản giá tải trước đó. Thử tải lại để lấy bản cập nhật.</p> : null}</div> : null}
      {!data && loading ? <div className={styles.loading} role="status">Đang chuẩn bị danh sách máy và bảng giá…</div> : null}
      {data ? <div className={styles.steps} aria-busy={loading}>
        <section className={styles.step} aria-labelledby="old-heading"><div className={styles.stepHeading}><span className={styles.stepNumber}>01</span><div><p>MÁY ĐANG SỬ DỤNG</p><h2 id="old-heading">Tra giá máy cũ</h2></div><span className={styles.stepTag}>5 loại tình trạng</span></div>
          <ProductSearch key={`old-${data.version}`} label="Tìm máy cũ" placeholder="Nhập tên máy, hãng hoặc dung lượng…" products={data.oldProducts} selected={old} disabled={loading}
            onSelect={setOld} onClear={() => { setOld(null); setNext(null); }} />
          <div className={styles.priceGrid} aria-live="polite">{TRADEIN_GRADES.map(grade => <article className={`${styles.priceCard} ${old ? styles.filled : ""}`} key={grade}>
            <span className={styles.grade}>Loại {grade}</span><strong>{old ? formatTradeinRange(old.ranges[grade]) : "—"}</strong><small>{old ? "Giá thu máy cũ" : "Chọn máy để xem giá"}</small>
          </article>)}</div>
          <p className={styles.note}>Giá hiển thị theo từng loại tình trạng. Giá thu cụ thể được xác định sau khi kiểm tra máy.</p>
        </section>
        <section className={`${styles.step} ${!old ? styles.pendingStep : ""}`} aria-labelledby="new-heading"><div className={styles.stepHeading}><span className={styles.stepNumber}>02</span><div><p>MÁY MUỐN ĐỔI LÊN</p><h2 id="new-heading">Xem trợ giá lên đời</h2></div><span className={styles.stepTag}>{next ? "Đã chọn máy mới" : "Chọn thêm máy mới"}</span></div>
          <ProductSearch key={`new-${data.version}-${old?.id || "none"}`} label="Tìm máy mới" placeholder={old ? "Nhập tên máy mới muốn đổi lên…" : "Chọn máy cũ ở bước 1 trước"} products={data.newProducts} selected={next} disabled={!old || loading}
            onSelect={setNext} onClear={() => setNext(null)} />
          {old && next ? <div className={styles.quoteGrid} aria-live="polite">{TRADEIN_GRADES.map(grade => {
            const quote = calculateTradeinQuote(old, next, grade);
            return <article className={styles.quoteCard} key={grade}><span className={styles.grade}>Loại {grade}</span>
              <div><small>Giá thu máy cũ</small><b>{formatTradeinRange(old.ranges[grade])}</b></div>
              <div className={styles.support}><small>Trợ giá lên đời</small><b>{quote ? formatTradeinRange(quote.support, true) : "—"}</b></div>
              <div className={styles.total}><small>Tổng giá thu + trợ giá</small><strong>{quote ? formatTradeinRange(quote.total) : "Chưa đủ dữ liệu"}</strong></div>
            </article>;
          })}</div> : <div className={styles.emptyQuote}><span aria-hidden="true">↗</span><p>{old ? "Chọn máy mới để xem trợ giá và tổng giá trị thu đổi cho cả 5 loại." : "Bắt đầu bằng việc chọn máy cũ. Mức trợ giá sẽ được tính theo máy mới bạn chọn."}</p></div>}
        </section>
      </div> : null}
      <footer className={styles.footer}><span>VIỄN THÔNG DI ĐỘNG</span><Link href="/#he-thu-cu-doi-moi">Hệ Thu Cũ Đổi Mới <span aria-hidden="true">↗</span></Link></footer>
    </div>
  </main>;
}
