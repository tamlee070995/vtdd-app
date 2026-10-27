export type StickerStyle = "classic-red" | "ticket" | "bubble" | "tag";
const PALETTES = {
    "classic-red": { light: "#ff3038", main: "#e50914", dark: "#a7070c", stroke: "#79090e", ink: "#fff", label: "#c4101c" },
    ticket: { light: "#253d60", main: "#112139", dark: "#07111f", stroke: "#07111f", ink: "#fff", label: "#112139" },
    bubble: { light: "#ff893b", main: "#f45413", dark: "#cc3208", stroke: "#9c280b", ink: "#fff", label: "#dd3f0f" },
    tag: { light: "#ffe96a", main: "#ffd400", dark: "#e4b600", stroke: "#aa8200", ink: "#07111f", label: "#07111f" },
};
export function stickerAmountSize(text: string) {
    return Math.min(62, Math.max(24, 560 / Math.max(text.trim().length, 8)));
}
export default function TradeinStickerArt({ style = "classic-red", title = "TRỢ GIÁ", amount = "0 TRIỆU", footer = "LÊN ĐỜI !", id, className, amountClassName }: {
    style?: StickerStyle;
    title?: string;
    amount?: string;
    footer?: string;
    id: string;
    className?: string;
    amountClassName?: string;
}) {
    const p = PALETTES[style], gradient = "sticker-fill-" + id, shine = "sticker-shine-" + id;
    const radius = style === "bubble" ? 44 : style === "ticket" ? 12 : 22;
    return <svg className={className} viewBox="0 0 400 280" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs><linearGradient id={gradient} x1="0" y1="0" x2="0.25" y2="1"><stop offset="0" stopColor={p.light}/><stop offset=".55" stopColor={p.main}/><stop offset="1" stopColor={p.dark}/></linearGradient><linearGradient id={shine} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff" stopOpacity=".26"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient></defs>
    <g transform="rotate(-5 200 150)">
      <rect x="41" y="41" width="286" height="118" rx={style === "bubble" ? 38 : 23} fill="#fff" stroke="#313131" strokeWidth="1.6"/>
      <text x="183" y="108" textAnchor="middle" fill={p.label} stroke="#fff" strokeWidth="6" paintOrder="stroke" fontFamily="Roboto,Arial,sans-serif" fontWeight="900" fontSize={Math.min(55, 430 / Math.max(title.length, 8))}>{title.toUpperCase()}</text>
      <rect x="23" y="108" width="355" height="153" rx={radius} fill="#000" opacity=".12" transform="translate(0 4)"/>
      <rect x="23" y="108" width="355" height="153" rx={radius} fill={"url(#" + gradient + ")"} stroke={p.stroke} strokeWidth="3"/>
      <rect x="30" y="115" width="341" height="139" rx={Math.max(8, radius - 6)} fill="none" stroke={p.light} strokeWidth="5"/>
      <path d="M47 119H352Q367 119 367 134V143H34V133Q34 119 47 119Z" fill={"url(#" + shine + ")"}/>
      <text className={amountClassName} x="201" y="204" textAnchor="middle" fill={p.ink} fontFamily="Roboto,Arial,sans-serif" fontWeight="900" fontSize={stickerAmountSize(amount)} letterSpacing="-1.8">{amount.toUpperCase()}</text>
      <text x="352" y="244" textAnchor="end" fill={p.ink} fontFamily="Roboto,Arial,sans-serif" fontWeight="900" fontSize={Math.min(20, 220 / Math.max(footer.length, 11))}>{footer.toUpperCase()}</text>
      {style === "ticket" && <><path d="M54 124v119" stroke="#ffffff55" strokeWidth="2" strokeDasharray="4 5"/><circle cx="23" cy="185" r="9" fill="#fff"/><circle cx="378" cy="185" r="9" fill="#fff"/></>}
    </g>
  </svg>;
}
