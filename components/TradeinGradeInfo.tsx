"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { TRADEIN_GRADES, type TradeinGrade } from "@/lib/tradein-pricing";
import type { GradeDescriptions } from "@/lib/tradein-grade-guide";
import styles from "./Tradein.module.css";

export default function TradeinGradeInfo({ grade, descriptions }: { grade?: TradeinGrade; descriptions: GradeDescriptions }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TradeinGrade>(grade || 1);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const node = dialog.current;
    const button = trigger.current;
    if (!open || !node) return;
    node.showModal();
    return () => { if (node.open) node.close(); button?.focus({ preventScroll: true }); };
  }, [open]);
  return <>
    <button type="button" className={styles.gradeInfo} ref={trigger} aria-label={grade ? `Xem định nghĩa Loại ${grade}` : "Xem định nghĩa Loại 1 đến 5"} onClick={() => { setSelected(grade || 1); setOpen(true); }}><span>{grade ? `Loại ${grade}` : "Loại 1–5"}</span><span aria-hidden="true">ⓘ</span></button>
    {open && <dialog ref={dialog} className={styles.gradeDialog} aria-labelledby={`${id}-title`} onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className={styles.gradeDialogBody}><header><div><p>PHÂN LOẠI TÌNH TRẠNG MÁY</p><h2 id={`${id}-title`}>Loại {selected} là máy như thế nào?</h2></div><button type="button" aria-label="Đóng định nghĩa" onClick={() => setOpen(false)}>×</button></header>
        <div className={styles.gradeChoices} aria-label="Chọn loại cần xem">{TRADEIN_GRADES.map(value => <button type="button" key={value} aria-pressed={selected === value} onClick={() => setSelected(value)}>Loại {value}</button>)}</div>
        {descriptions[selected] ? <p className={styles.gradeDefinition}>{descriptions[selected]}</p> : <p className={styles.gradeDefinition}>Tiêu chí Loại {selected} đang chờ cập nhật. Vui lòng đối chiếu quy trình thu cũ và kết quả kiểm tra máy trước khi báo giá.</p>}
        <p className={styles.gradeCaution}>Phân loại theo tình trạng thực tế của máy. Khoảng giá hiển thị không thay thế kết quả kiểm tra.</p>
        <Link className={styles.gradeGuideLink} href="/p/quy-trinh-thu-cu" onClick={() => setOpen(false)}>Xem quy trình thu cũ đổi mới <span aria-hidden="true">›</span></Link>
      </div>
    </dialog>}
  </>;
}
