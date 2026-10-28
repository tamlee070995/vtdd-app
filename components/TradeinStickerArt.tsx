export type StickerStyle = "original" | "step" | "diagonal" | "scoop";
export type StickerInk = "mono" | "color";

export function stickerAmountSize(text: string) {
  return Math.min(70, Math.max(24, 590 / Math.max(text.trim().length, 8)));
}

const BODIES: Record<StickerStyle, string> = {
  original: "M42 103H358Q376 103 376 121V218Q376 236 358 236H42Q24 236 24 218V121Q24 103 42 103Z",
  step: "M42 103H358Q376 103 376 121V270Q376 288 358 288H266Q250 288 250 272V248Q250 232 234 232H42Q24 232 24 214V121Q24 103 42 103Z",
  diagonal: "M42 103H358Q376 103 376 121V273Q376 290 360 284L38 225Q24 222 24 208V121Q24 103 42 103Z",
  scoop: "M44 103H348Q376 103 376 131V260Q376 288 348 288H266C238 246 172 224 48 224Q24 224 24 200V127Q24 103 44 103Z",
};

export default function TradeinStickerArt({ style = "original", ink = "mono", title = "TRỢ GIÁ", amount = "0 TRIỆU", footer = "LÊN ĐỜI !", id = "sticker", className, amountClassName }: {
  style?: StickerStyle;
  ink?: StickerInk;
  title?: string;
  amount?: string;
  footer?: string;
  id?: string;
  className?: string;
  amountClassName?: string;
}) {
  const colored = ink === "color";
  const body = BODIES[style];
  const gradient = `sticker-red-${id}`;
  const inkColor = colored ? "#fff" : "#000";
  const footerY = style === "original" ? 222 : 266;
  return <svg className={className} data-sticker-design={style} data-sticker-ink={ink} viewBox="0 0 400 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    {colored && <defs><linearGradient id={gradient} x1="0" y1="0" x2="0.15" y2="1"><stop stopColor="#f92226"/><stop offset=".5" stopColor="#df0b12"/><stop offset="1" stopColor="#b6080f"/></linearGradient></defs>}
    {/* The whole white rectangle is the paper. Its lower-left corner stays intact for attachment. */}
    <rect data-sticker-paper x="8" y="8" width="384" height="304" rx="9" fill="#fff" stroke="#969696" strokeWidth=".9" strokeDasharray="4 4"/>
    <rect data-adhesive-area x="20" y="264" width="210" height="36" fill="#fff"/>
    <g transform="rotate(-6 184 76)">
      <rect x="40" y="26" width="288" height="95" rx="23" fill="#fff" stroke="#222" strokeWidth="1.6"/>
    </g>
    <g transform={style === "original" ? "rotate(-2 200 170)" : undefined}>
      <path d={body} fill={colored ? `url(#${gradient})` : "#fff"} stroke={colored ? "#800b10" : "#000"} strokeWidth="3" strokeLinejoin="round"/>
      {colored ? <path d={body} transform="translate(200 180) scale(.965 .94) translate(-200 -180)" fill="none" stroke="#ff3439" strokeWidth="4" strokeLinejoin="round"/> : style === "diagonal" ? <path d={body} transform="translate(200 180) scale(.96 .94) translate(-200 -180)" fill="none" stroke="#000" strokeWidth="1" strokeLinejoin="round"/> : null}
      <text className={amountClassName} x="200" y="185" textAnchor="middle" fill={inkColor} fontFamily="Roboto,Arial,sans-serif" fontWeight="900" fontSize={stickerAmountSize(amount)} letterSpacing="-1.5">{amount.toUpperCase()}</text>
      <text x="357" y={footerY} textAnchor="end" fill={inkColor} fontFamily="Roboto,Arial,sans-serif" fontWeight="900" fontSize={Math.min(19, 225 / Math.max(footer.length, 12))} textLength={style !== "original" && footer.length > 12 ? 98 : undefined} lengthAdjust="spacingAndGlyphs">{footer.toUpperCase()}</text>
    </g>
    {/* Draw the title last so neither its letters nor Vietnamese accents can be covered by the body. */}
    <text transform="rotate(-6 184 76)" x="184" y="86" textAnchor="middle" fill={colored ? "#bf1019" : "#000"} stroke="#fff" strokeWidth="3" paintOrder="stroke" fontFamily="Roboto,Arial,sans-serif" fontWeight="900" fontSize={Math.min(53, 480 / Math.max(title.length, 9))} letterSpacing="-1">{title.toUpperCase()}</text>
  </svg>;
}
