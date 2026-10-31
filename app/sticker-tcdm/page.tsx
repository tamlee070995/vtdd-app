"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import TradeinStickerArt, { stickerAmountSize, type StickerInk, type StickerStyle } from "@/components/TradeinStickerArt";
import styles from "./page.module.css";
const TEMPLATES: Array<{
    id: StickerStyle;
    name: string;
}> = [
    { id: "original", name: "Mẫu gốc" }, { id: "step", name: "Bậc lệch" },
    { id: "diagonal", name: "Vát chéo" }, { id: "scoop", name: "Bo khuyết" },
];
const DEFAULT_AMOUNTS = Array<string>(6).fill("0 TRIỆU");
function PrintIcon() {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 8V3h10v5M7 17H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-3"/><path d="M7 14h10v7H7zM17 11h1"/></svg>;
}
export default function StickerTcdmPage() {
    const [template, setTemplate] = useState<StickerStyle>("original");
    const [ink, setInk] = useState<StickerInk>("mono");
    const [quantity, setQuantity] = useState(6);
    const [amounts, setAmounts] = useState(DEFAULT_AMOUNTS);
    const [commonAmount, setCommonAmount] = useState("0 TRIỆU");
    const [title, setTitle] = useState("TRỢ GIÁ");
    const [footer, setFooter] = useState("LÊN ĐỜI !");
    const [mobileView, setMobileView] = useState<"edit" | "preview">("preview");
    const [printing, setPrinting] = useState(false);
    const [notice, setNotice] = useState("");
    const [paperWidth, setPaperWidth] = useState(794);
    const paperRef = useRef<HTMLDivElement>(null);
    const lastReset = useRef<{
        template: StickerStyle;
        ink: StickerInk;
        quantity: number;
        amounts: string[];
        commonAmount: string;
        title: string;
        footer: string;
    } | null>(null);
    const currentTemplate = TEMPLATES.find(item => item.id === template)!;
    useEffect(() => { document.title = "In Sticker Trợ Giá | Viễn Thông Di Động"; }, []);
    useEffect(() => {
        const node = paperRef.current;
        if (!node)
            return;
        const measure = () => { if (node.clientWidth)
            setPaperWidth(node.clientWidth); };
        measure();
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
        observer?.observe(node);
        window.addEventListener("resize", measure);
        return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
    }, []);
    useEffect(() => {
        if (!notice)
            return;
        const timer = window.setTimeout(() => setNotice(""), notice === "Đã về mẫu mặc định." ? 7000 : 3500);
        return () => window.clearTimeout(timer);
    }, [notice]);
    function updateAmount(index: number, value: string) {
        setNotice("");
        setAmounts(previous => previous.map((amount, position) => position === index ? value.slice(0, 20) : amount));
    }
    function applyAmount(value: string) {
        const next = value.trim().toUpperCase().slice(0, 20) || "0 TRIỆU";
        setCommonAmount(next);
        setAmounts(Array(6).fill(next));
        setNotice("Đã áp dụng " + next + " cho cả 6 sticker.");
    }
    function reset() {
        lastReset.current = { template, ink, quantity, amounts: [...amounts], commonAmount, title, footer };
        setTemplate("original");
        setInk("mono");
        setQuantity(6);
        setAmounts([...DEFAULT_AMOUNTS]);
        setCommonAmount("0 TRIỆU");
        setTitle("TRỢ GIÁ");
        setFooter("LÊN ĐỜI !");
        setNotice("Đã về mẫu mặc định.");
    }
    function undoReset() {
        const previous = lastReset.current;
        if (!previous)
            return;
        setTemplate(previous.template);
        setInk(previous.ink);
        setQuantity(previous.quantity);
        setAmounts(previous.amounts);
        setCommonAmount(previous.commonAmount);
        setTitle(previous.title);
        setFooter(previous.footer);
        lastReset.current = null;
        setNotice("Đã khôi phục nội dung vừa nhập.");
    }
    async function print() {
        setPrinting(true);
        try {
            await document.fonts.ready;
            window.print();
        }
        finally {
            setPrinting(false);
        }
    }
    return <main data-portal-page className={styles.page} data-mobile-view={mobileView}>
    <header data-page-header className={styles.header}>
      <Link className={styles.brand} href="/"><img src="/brand/vtdd-logo-header-v3.webp" width="42" height="42" alt=""/><span><b>Viễn Thông Di Động</b><small>Công cụ thu cũ đổi mới</small></span></Link>
      <Link className={styles.homeLink} href="/#he-thu-cu-doi-moi"><span aria-hidden="true">←</span> Hệ thu cũ</Link>
    </header>
    <div className={styles.shell}>
      <nav className={styles.breadcrumb} aria-label="Đường dẫn"><Link href="/">Trang chủ</Link><span>›</span><Link href="/#he-thu-cu-doi-moi">Hệ thu cũ đổi mới</Link><span>›</span><span aria-current="page">In sticker</span></nav>
      <section className={styles.heading}><div><span className={styles.eyebrow}>CÔNG CỤ TRƯNG BÀY</span><h1>In sticker trợ giá</h1><p>Nhập giá, chọn mẫu và in. Mỗi sticker có thể mang một mức trợ giá riêng.</p></div><span className={styles.a4Badge}>▤ &nbsp; A4 · Tối đa 6 sticker</span></section>
      <div className={styles.mobileTabs} role="tablist" aria-label="Chế độ sticker"><button type="button" role="tab" aria-selected={mobileView === "edit"} aria-controls="sticker-controls" onClick={() => setMobileView("edit")}>Nhập nội dung</button><button type="button" role="tab" aria-selected={mobileView === "preview"} aria-controls="sticker-preview" onClick={() => setMobileView("preview")}>Xem trang in</button></div>
      <div className={styles.workspace}>
        <aside className={styles.controls} id="sticker-controls" aria-label="Nội dung sticker">
          <section className={styles.controlSection}><div className={styles.sectionHeading}><span>01</span><div><h2>Chọn mẫu</h2><p>4 mẫu có chân giấy trắng để dán vào lưng máy.</p></div></div>
            <div className={styles.templateGrid}>{TEMPLATES.map(item => <button type="button" key={item.id} aria-pressed={template === item.id} className={styles.templateButton + (template === item.id ? " " + styles.selectedTemplate : "")} onClick={() => setTemplate(item.id)}><TradeinStickerArt style={item.id} ink={ink} amount="2 TRIỆU" id={"thumb-" + item.id}/><span>{item.name}</span>{template === item.id && <i aria-hidden="true">✓</i>}</button>)}</div>
            <div className={styles.inkSelector} role="group" aria-label="Màu in sticker"><button type="button" aria-pressed={ink === "mono"} onClick={() => setInk("mono")}>Đen trắng</button><button type="button" aria-pressed={ink === "color"} onClick={() => setInk("color")}>Màu đỏ</button></div>
            <p className={styles.adhesiveHint}>Giữ nguyên phần giấy trắng dưới bên trái để dán vào điện thoại. Chỉ cắt mép ngoài theo nét đứt.</p>
          </section>
          <section className={styles.controlSection}><div className={styles.sectionHeading}><span>02</span><div><h2>Nội dung trợ giá</h2><p>Dùng cùng một giá hoặc sửa riêng từng tem.</p></div></div>
            <label className={styles.label} htmlFor="common-amount">Áp dụng nhanh cùng một giá</label><div className={styles.applyRow}><input id="common-amount" maxLength={20} value={commonAmount} onChange={event => setCommonAmount(event.target.value)} placeholder="Ví dụ: 2 TRIỆU" onKeyDown={event => { if (event.key === "Enter") {
        event.preventDefault();
        applyAmount(commonAmount);
    } }}/><button type="button" onClick={() => applyAmount(commonAmount)}>Áp dụng</button></div>
            <div className={styles.quickAmounts} aria-label="Mức trợ giá gợi ý">{["300 NGÀN", "500 NGÀN", "1 TRIỆU", "2 TRIỆU", "3 TRIỆU"].map(amount => <button type="button" key={amount} onClick={() => applyAmount(amount)}>{amount}</button>)}</div>
            <div className={styles.amountGrid}>{amounts.slice(0, quantity).map((amount, index) => <label className={styles.amountField} key={index}><span><i>{String(index + 1).padStart(2, "0")}</i> Sticker {index + 1}</span><input aria-label={"Giá sticker " + (index + 1)} maxLength={20} value={amount} placeholder="0 TRIỆU" onChange={event => updateAmount(index, event.target.value)}/></label>)}</div>
            <details className={styles.moreText}><summary>Chỉnh tiêu đề &amp; dòng phụ</summary><label className={styles.label}>Dòng tiêu đề<input maxLength={18} value={title} onChange={event => setTitle(event.target.value)} placeholder="TRỢ GIÁ"/></label><label className={styles.label}>Dòng phụ<input maxLength={24} value={footer} onChange={event => setFooter(event.target.value)} placeholder="LÊN ĐỜI !"/></label></details>
          </section>
          <section className={styles.controlSection}><div className={styles.sectionHeading}><span>03</span><div><h2>Số lượng trên trang</h2><p>Giữ vị trí 2 cột × 3 hàng trên A4.</p></div></div><div className={styles.quantity} aria-label="Số lượng sticker">{[1, 2, 3, 4, 5, 6].map(value => <button type="button" aria-label={"In " + value + " sticker"} aria-pressed={quantity === value} key={value} onClick={() => setQuantity(value)}>{value}</button>)}</div></section>
          <div className={styles.controlFooter}><button type="button" onClick={reset}>↺ &nbsp; Về mặc định</button><span>{currentTemplate.name}</span></div>
        </aside>
        <section className={styles.preview} id="sticker-preview" aria-label="Trang in A4">
          <div className={styles.previewToolbar}><div><h2>Trang in A4</h2><p>Chạm vào số tiền trên từng sticker để sửa.</p></div><span>{quantity}/6 sticker</span></div>
          <div className={styles.paperStage}><div className={styles.paper} ref={paperRef} style={{ "--paper-width": paperWidth + "px" } as CSSProperties}>
            {Array.from({ length: 6 }, (_, index) => <div className={styles.slot + (index >= quantity ? " " + styles.emptySlot : "")} key={index}>
              {index < quantity ? <><span className={styles.slotNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div className={styles.stickerItem} data-template={template} data-print-mode={ink}>
                <TradeinStickerArt style={template} ink={ink} title={title} amount={amounts[index]} footer={footer} id={"paper-" + index} amountClassName={styles.artAmount}/>
                <input aria-label={"Sửa trực tiếp giá sticker " + (index + 1)} className={styles.paperInput} maxLength={20} value={amounts[index]} onChange={event => updateAmount(index, event.target.value)} style={{ fontSize: "max(16px, calc(var(--paper-width) * " + stickerAmountSize(amounts[index]) * .001083333 + "))" }}/>
              </div></> : <span className={styles.emptyText}>Vị trí trống · Không in</span>}
            </div>)}
          </div></div>
          <div className={styles.paperCaption}><span>210 × 297 mm · {ink === "mono" ? "Đen trắng" : "Màu đỏ"}</span><span>Giấy trắng dưới bên trái là chân dán, không cắt bỏ.</span></div>
          <details className={styles.printHelp}><summary>Cài đặt in để ra đúng khổ</summary><ol><li>Chọn khổ giấy <b>A4</b> và hướng <b>Dọc</b>.</li><li>Đặt tỷ lệ <b>100%</b>, lề <b>Không</b>.</li><li>Tắt <b>Đầu trang và chân trang</b>. {ink === "mono" ? "Chọn in Đen trắng. Không cần bật đồ họa nền." : "Chọn máy in màu để giữ màu đỏ của mẫu."}</li><li>Cắt theo <b>nét đứt ngoài cùng</b>, giữ phần giấy trắng dưới bên trái để dán vào lưng máy. Không cắt theo viền trang trí bên trong.</li></ol><p>Trên điện thoại, dùng chức năng In hoặc Chia sẻ → In của trình duyệt nếu nút In không mở hộp thoại.</p></details>
        </section>
      </div>
      {notice && <div className={styles.notice} role="status"><span>✓ {notice}</span>{notice === "Đã về mẫu mặc định." && <button type="button" onClick={undoReset}>Hoàn tác</button>}<button type="button" aria-label="Đóng thông báo" onClick={() => setNotice("")}>×</button></div>}
      <div className={styles.printBar}><div><b>{quantity} sticker <span>trên 1 trang A4</span></b><small>{currentTemplate.name} · Sẵn sàng in</small></div><button type="button" className={styles.printButton} onClick={() => void print()} disabled={printing}><PrintIcon />{printing ? "Đang mở…" : "In ngay"}</button></div>
    </div>
  </main>;
}
