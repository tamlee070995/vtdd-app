const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "caption",
  "code",
  "col",
  "colgroup",
  "div",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const VOID_TAGS = new Set(["br", "col", "hr", "img"]);
const URI_ATTRS = new Set(["href", "src"]);
const GLOBAL_ATTRS = new Set(["class", "title", "aria-label"]);
const TABLE_ATTRS = new Set(["colspan", "rowspan"]);
const MEDIA_ATTRS = new Set(["alt", "height", "loading", "width"]);
const SAFE_STYLE_ATTRS = new Set([
  "background",
  "background-color",
  "border-color",
  "color",
  "font-size",
  "font-style",
  "font-weight",
  "line-height",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "text-align",
  "text-decoration",
]);

const DANGEROUS_BLOCKS =
  /<\s*(script|style|iframe|object|embed|link|meta|base|form|input|button|select|textarea|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const DANGEROUS_SELF_CLOSING =
  /<\s*(script|style|iframe|object|embed|link|meta|base|form|input|button|select|textarea|svg|math)[^>]*\/?\s*>/gi;

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isSafeUrl(value: string) {
  const url = value.trim().replace(/[\u0000-\u001F\u007F\s]+/g, "");
  const lower = url.toLowerCase();

  if (!url) return false;
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return false;
  }

  return (
    lower.startsWith("https://") ||
    lower.startsWith("http://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("/") ||
    lower.startsWith("#")
  );
}

function isAllowedAttribute(tag: string, attr: string) {
  if (attr.startsWith("on")) return false;
  if (GLOBAL_ATTRS.has(attr)) return true;
  if (attr === "style") return true;
  if (URI_ATTRS.has(attr)) return tag === "a" || tag === "img";
  if (tag === "a" && (attr === "target" || attr === "rel")) return true;
  if (tag === "img" && MEDIA_ATTRS.has(attr)) return true;
  if ((tag === "td" || tag === "th") && TABLE_ATTRS.has(attr)) return true;
  return false;
}

function sanitizeStyle(value: string) {
  const safeRules = String(value || "")
    .split(";")
    .map((rule) => rule.trim())
    .map((rule) => {
      const splitAt = rule.indexOf(":");
      if (splitAt <= 0) return "";

      const prop = rule.slice(0, splitAt).trim().toLowerCase();
      const rawValue = rule.slice(splitAt + 1).trim();
      const lowerValue = rawValue.toLowerCase();

      if (!SAFE_STYLE_ATTRS.has(prop)) return "";
      if (!rawValue || /[<>]/.test(rawValue)) return "";
      if (lowerValue.includes("url(") || lowerValue.includes("expression(") || lowerValue.includes("javascript:")) return "";
      if (rawValue.length > 140) return "";

      return `${prop}: ${rawValue}`;
    })
    .filter(Boolean);

  return safeRules.join("; ");
}

function sanitizeAttributes(tag: string, rawAttrs: string) {
  const attrs: string[] = [];
  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(rawAttrs))) {
    const attr = match[1].toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? "";

    if (!isAllowedAttribute(tag, attr)) continue;
    if (URI_ATTRS.has(attr) && !isSafeUrl(value)) continue;
    if (attr === "style") {
      const safeStyle = sanitizeStyle(value);
      if (safeStyle) attrs.push(`${attr}="${escapeAttribute(safeStyle)}"`);
      continue;
    }

    if (tag === "a" && attr === "target" && value !== "_blank") continue;

    attrs.push(`${attr}="${escapeAttribute(value)}"`);
  }

  if (tag === "a" && attrs.some((attr) => attr.startsWith('target="_blank"'))) {
    const hasRel = attrs.some((attr) => attr.startsWith("rel="));
    if (!hasRel) attrs.push('rel="noopener noreferrer"');
  }

  return attrs.length ? ` ${attrs.join(" ")}` : "";
}

export function sanitizeHtml(input: string) {
  const html = String(input || "")
    .replace(DANGEROUS_BLOCKS, "")
    .replace(DANGEROUS_SELF_CLOSING, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>/g, (full, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    const isClosing = /^<\s*\//.test(full);

    if (!ALLOWED_TAGS.has(tag)) {
      return "";
    }

    if (isClosing) {
      return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
    }

    const attrs = sanitizeAttributes(tag, rawAttrs || "");
    return VOID_TAGS.has(tag) ? `<${tag}${attrs}>` : `<${tag}${attrs}>`;
  });
}
