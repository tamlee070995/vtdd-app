export type StickerStyle = "outline" | "ticket" | "rounded" | "minimal";
export function stickerAmountSize(text: string) {
    return Math.min(62, Math.max(24, 560 / Math.max(text.trim().length, 8)));
}
export default function TradeinStickerArt({ style = "outline", title = "TRỢ GIÁ", amount = "0 TRIỆU", footer = "LÊN ĐỜI !", className, amountClassName }: {
    style?: StickerStyle;
    title?: string;
    amount?: string;
    footer?: string;
    id?: string;
    className?: string;
    amountClassName?: string;
}) {
    const radius = style === "rounded" ? 35 : style === "minimal" ? 0 : 12;
    return <svg className={className} viewBox="0 0 400 280" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <rect x="20" y="24" width="360" height="232" rx={radius} fill="#fff" stroke="#000" strokeWidth={style === "minimal" ? 2 : 3}/>
    {style === "outline" && <rect x="28" y="32" width="344" height="216" rx="7" fill="none" stroke="#000" strokeWidth="1"/>}
    {style === "ticket" && <><path d="M42 109H358" stroke="#000" strokeWidth="1.5" strokeDasharray="5 5"/><circle cx="20" cy="109" r="9" fill="#fff" stroke="#000" strokeWidth="2"/><circle cx="380" cy="109" r="9" fill="#fff" stroke="#000" strokeWidth="2"/></>}
    {style !== "ticket" && <path d="M48 109H352" stroke="#000" strokeWidth={style === "minimal" ? 1 : 2}/>}
    <text x="200" y="85" textAnchor="middle" fill="#000" fontFamily="Roboto,Arial,sans-serif" fontWeight="900" fontSize={Math.min(44, 540 / Math.max(title.length, 12))}>{title.toUpperCase()}</text>
    <text className={amountClassName} x="200" y="183" textAnchor="middle" fill="#000" fontFamily="Roboto,Arial,sans-serif" fontWeight="900" fontSize={stickerAmountSize(amount)} letterSpacing="-1.5">{amount.toUpperCase()}</text>
    <text x="200" y="232" textAnchor="middle" fill="#000" fontFamily="Roboto,Arial,sans-serif" fontWeight="700" fontSize={Math.min(22, 420 / Math.max(footer.length, 18))}>{footer.toUpperCase()}</text>
  </svg>;
}
