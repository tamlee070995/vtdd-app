"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type StickerTemplate = {
  id: string;
  name: string;
  styleClass: string;
};

type StickerText = {
  title: string;
  amount: string;
  footer: string;
};

const TEMPLATES: StickerTemplate[] = [
  { id: "classic-red", name: "01 - Trợ giá đỏ", styleClass: "classicRed" },
  { id: "ticket", name: "02 - Vé trợ giá", styleClass: "ticket" },
  { id: "bubble", name: "03 - Bong bóng", styleClass: "bubble" },
  { id: "tag", name: "04 - Tag dán máy", styleClass: "tag" },
];

const DEFAULT_TEXT: StickerText = {
  title: "TRỢ GIÁ",
  amount: "0 TRIỆU",
  footer: "LÊN ĐỜI !",
};

function clampQuantity(value: string) {
  const n = Number(value.replace(/\D/g, ""));
  if (!n || n < 1) return 1;
  if (n > 6) return 6;
  return n;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function css(name: string) {
  return styles[name as keyof typeof styles] || "";
}

function EditableText({
  value,
  onChange,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className: string;
  ariaLabel: string;
}) {
  return (
    <span
      className={className}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      aria-label={ariaLabel}
      onInput={(event) => onChange(event.currentTarget.textContent || "")}
      onBlur={(event) => onChange((event.currentTarget.textContent || "").trim())}
    >
      {value}
    </span>
  );
}

function StickerPreview({
  template,
  text,
  onChange,
  editable = true,
}: {
  template: StickerTemplate;
  text: StickerText;
  onChange: (next: StickerText) => void;
  editable?: boolean;
}) {
  const shapeClass = css(template.styleClass);

  const setTitle = (title: string) => onChange({ ...text, title });
  const setAmount = (amount: string) => onChange({ ...text, amount });
  const setFooter = (footer: string) => onChange({ ...text, footer });

  return (
    <div className={cx(styles.sticker, shapeClass)}>
      <div className={styles.leftBlank} aria-hidden="true" />

      <div className={styles.stickerArtwork}>
        <div className={styles.topLayer}>
          {editable ? (
            <EditableText
              value={text.title}
              onChange={setTitle}
              ariaLabel="Sửa dòng tiêu đề"
              className={styles.titleText}
            />
          ) : (
            <span className={styles.titleText}>{text.title}</span>
          )}
        </div>

        <div className={styles.mainLayer}>
          {editable ? (
            <EditableText
              value={text.amount}
              onChange={setAmount}
              ariaLabel="Sửa số tiền trợ giá"
              className={styles.amountText}
            />
          ) : (
            <span className={styles.amountText}>{text.amount}</span>
          )}

          {editable ? (
            <EditableText
              value={text.footer}
              onChange={setFooter}
              ariaLabel="Sửa dòng phụ"
              className={styles.footerText}
            />
          ) : (
            <span className={styles.footerText}>{text.footer}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StickerTcdmPage() {
  const [selectedId, setSelectedId] = useState(TEMPLATES[0].id);
  const [quantity, setQuantity] = useState(6);
  const [text, setText] = useState<StickerText>(DEFAULT_TEXT);

  useEffect(() => {
    document.title = "In Sticker Trợ Giá | Viễn Thông Di Động";
  }, []);

  const selectedTemplate = useMemo(
    () => TEMPLATES.find((template) => template.id === selectedId) || TEMPLATES[0],
    [selectedId]
  );

  const printItems = useMemo(
    () => Array.from({ length: quantity }, (_, index) => index),
    [quantity]
  );

  function handlePrint() {
    window.print();
  }

  function resetText() {
    setText(DEFAULT_TEXT);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/tradein-price" className={styles.brand}>
          <span className={styles.logoBox}>
            <img src="/mwg-logo.svg" alt="MWG" />
          </span>

          <span>
            <strong>Viễn Thông Di Động</strong>
            <small>Sticker trợ giá thu cũ đổi mới</small>
          </span>
        </Link>

        <div className={styles.headerActions}>
          <Link href="/huong-dan-noi-bo#in-sticker" className={styles.guideButton}>
            Hướng dẫn
          </Link>
          <Link href="/tradein-price" className={styles.backButton}>
            Quay lại
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.kicker}>PRINT CENTER</span>
          <h1>In Sticker Trợ Giá</h1>
          <p>
            Chọn mẫu, sửa chữ trực tiếp trên sticker hoặc nhập nhanh bên dưới.
            Một trang A4 in tối đa 6 sticker.
          </p>
        </div>

        <div className={styles.printGuide}>
          <b>Gợi ý in A4</b>
          <span>Số lượng: tối đa 6 sticker / trang</span>
          <span>Lề: Không hoặc Minimum</span>
          <span>In màu hoặc trắng đen đều rõ chữ</span>
        </div>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.controlPanel}>
          <div className={styles.panelTitle}>
            <span>01</span>
            <div>
              <h2>Chọn mẫu sticker</h2>
              <p>Mẫu số 1 bám sát kiểu sticker đỏ như hình mẫu.</p>
            </div>
          </div>

          <div className={styles.templateGrid}>
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                className={cx(
                  styles.templateButton,
                  selectedId === template.id && styles.templateActive
                )}
                onClick={() => setSelectedId(template.id)}
              >
                <span>{template.name}</span>
              </button>
            ))}
          </div>

          <div className={styles.quickEdit}>
            <label>
              <span>Dòng tiêu đề</span>
              <input
                value={text.title}
                onChange={(event) => setText({ ...text, title: event.target.value })}
                placeholder="TRỢ GIÁ"
              />
            </label>

            <label>
              <span>Số tiền</span>
              <input
                value={text.amount}
                onChange={(event) => setText({ ...text, amount: event.target.value })}
                placeholder="0 TRIỆU"
              />
            </label>

            <label>
              <span>Dòng phụ</span>
              <input
                value={text.footer}
                onChange={(event) => setText({ ...text, footer: event.target.value })}
                placeholder="LÊN ĐỜI !"
              />
            </label>

            <label>
              <span>Số lượng in</span>
              <input
                value={quantity}
                inputMode="numeric"
                onChange={(event) => setQuantity(clampQuantity(event.target.value))}
              />
              <small>Tối đa 6 sticker / 1 trang A4.</small>
            </label>
          </div>

          <div className={styles.panelActions}>
            <button type="button" className={styles.clearButton} onClick={resetText}>
              Về mặc định
            </button>
            <button type="button" className={styles.printButton} onClick={handlePrint}>
              In ngay
            </button>
          </div>
        </aside>

        <section className={styles.previewPanel}>
          <div className={styles.previewHeader}>
            <div>
              <span>02</span>
              <div>
                <h2>Bản xem trước</h2>
                <p>Bấm trực tiếp vào chữ trên sticker để sửa nhanh.</p>
              </div>
            </div>
          </div>

          <div className={styles.livePreview}>
            <StickerPreview
              template={selectedTemplate}
              text={text}
              onChange={setText}
              editable
            />
          </div>

          <div className={styles.printSheetWrap}>
            <div className={styles.printSheet}>
              {printItems.map((index) => (
                <div className={styles.printSlot} key={index}>
                  <StickerPreview
                    template={selectedTemplate}
                    text={text}
                    onChange={setText}
                    editable={false}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
