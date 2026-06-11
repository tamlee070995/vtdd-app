"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

type SheetRow = any[];

type StaffTradeInAppProps = {
  maNV: string;
  maST: string;
  staffName: string;
  forceSetup?: boolean;
};


type SystemSettings = Record<string, string>;

type NotifySettings = {
  marquee: string;
  fixedBanner: string;
  pushMessage: string;
  pushVersion: string;
  priceEffectiveFrom: string;
  priceEffectiveTo: string;
};

const EMPTY_NOTIFY: NotifySettings = {
  marquee: "",
  fixedBanner: "",
  pushMessage: "",
  pushVersion: "",
  priceEffectiveFrom: "",
  priceEffectiveTo: "",
};

const SYSTEM_UI_CSS = `
.vtdd-system-marquee {
  position: relative;
  overflow: hidden;
  min-height: 42px;
  border-radius: 18px;
  border: 1px solid rgba(250, 204, 21, .45);
  background: #fffbea;
  color: #854d0e;
  box-shadow: 0 12px 24px rgba(245, 158, 11, .10);
}

.vtdd-system-marquee span {
  position: absolute;
  top: 50%;
  left: 100%;
  white-space: nowrap;
  transform: translateY(-50%);
  font-size: 12px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .02em;
  animation: vtddMarquee 18s linear infinite;
}

@keyframes vtddMarquee {
  from { left: 100%; }
  to { left: -140%; }
}

.vtdd-system-banner,
.vtdd-system-effective {
  padding: 12px 13px;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 12px 26px rgba(15, 23, 42, .06);
}

.vtdd-system-banner {
  border-color: rgba(59, 130, 246, .22);
  background: linear-gradient(135deg, #eff6ff, #ffffff);
}

.vtdd-system-banner span,
.vtdd-system-effective span {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 9.5px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .10em;
  text-transform: uppercase;
}

.vtdd-system-banner b,
.vtdd-system-effective b {
  display: block;
  color: #0f172a;
  font-size: 12.5px;
  line-height: 1.45;
  font-weight: 900;
}

.vtdd-system-effective {
  border-color: rgba(16, 185, 129, .22);
  background: linear-gradient(135deg, #ecfdf5, #ffffff);
}

.vtdd-system-effective b {
  color: #047857;
}

.vtdd-tab-locked-note {
  margin-top: 10px;
  padding: 12px;
  border-radius: 18px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.45;
  font-weight: 850;
}

.mode-switch button:disabled,
.customer-mode-card button:disabled {
  opacity: .48;
  cursor: not-allowed;
  filter: grayscale(.25);
}

.vtdd-lock-page {
  min-height: 100vh;
  padding: max(18px, env(safe-area-inset-top)) 14px max(18px, env(safe-area-inset-bottom));
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 18% 0%, rgba(255, 212, 0, .22), transparent 34%),
    linear-gradient(180deg, #ffffff 0%, #f8fafc 48%, #eef2f7 100%);
}

.vtdd-lock-card {
  width: min(100%, 440px);
  padding: 24px 18px 18px;
  border-radius: 32px;
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 212, 0, .26), transparent 38%),
    #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 26px 80px rgba(15, 23, 42, .16);
  text-align: center;
}

.vtdd-lock-icon {
  width: 62px;
  height: 62px;
  margin: 0 auto 14px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  background: #0f172a;
  color: #ffd400;
  font-size: 26px;
  font-weight: 900;
}

.vtdd-lock-card span {
  width: fit-content;
  margin: 0 auto;
  padding: 8px 11px;
  border-radius: 999px;
  display: inline-flex;
  background: #fffbea;
  border: 1px solid rgba(250, 204, 21, .45);
  color: #854d0e;
  font-size: 9.5px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .10em;
  text-transform: uppercase;
}

.vtdd-lock-card h1 {
  margin-top: 14px;
  color: #0f172a;
  font-size: 30px;
  line-height: 1.05;
  font-weight: 900;
  letter-spacing: -.055em;
  text-transform: uppercase;
}

.vtdd-lock-card p {
  margin-top: 10px;
  color: #475569;
  font-size: 13px;
  line-height: 1.5;
  font-weight: 800;
}

.vtdd-lock-card a {
  min-height: 50px;
  margin-top: 18px;
  border-radius: 17px;
  display: grid;
  place-items: center;
  background: #ffd400;
  color: #111827;
  font-size: 11.5px;
  font-weight: 900;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.vtdd-push-layer {
  position: fixed;
  inset: 0;
  z-index: 999999;
  padding: 16px;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, .58);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.vtdd-push-card {
  width: min(100%, 420px);
  padding: 20px;
  border-radius: 28px;
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 212, 0, .20), transparent 38%),
    #ffffff;
  border: 1px solid rgba(226, 232, 240, .95);
  box-shadow: 0 28px 88px rgba(15, 23, 42, .32);
}

.vtdd-push-card span {
  width: fit-content;
  padding: 8px 11px;
  border-radius: 999px;
  display: inline-flex;
  background: #0f172a;
  color: #ffd400;
  font-size: 9.5px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .10em;
  text-transform: uppercase;
}

.vtdd-push-card h2 {
  margin-top: 14px;
  color: #0f172a;
  font-size: 24px;
  line-height: 1.05;
  font-weight: 900;
  letter-spacing: -.045em;
}

.vtdd-push-card p {
  margin-top: 10px;
  color: #475569;
  font-size: 13px;
  line-height: 1.5;
  font-weight: 800;
}

.vtdd-push-card button {
  width: 100%;
  min-height: 52px;
  margin-top: 16px;
  border: 0;
  border-radius: 18px;
  background: #ffd400;
  color: #111827;
  font-size: 11.5px;
  font-weight: 900;
  letter-spacing: .06em;
  text-transform: uppercase;
}
/* STAFF ONLY - nổi bật thông báo hệ thống và tự xuống hàng */
.vtdd-system-banner-featured {
  padding: 14px !important;
  border-radius: 20px !important;
  border: 1px solid rgba(250, 204, 21, .55) !important;
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 212, 0, .24), transparent 38%),
    linear-gradient(135deg, #fffbea, #ffffff) !important;
  box-shadow: 0 14px 34px rgba(245, 158, 11, .13) !important;
}

.vtdd-system-banner-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.vtdd-system-banner-head span {
  margin: 0 !important;
  color: #854d0e !important;
}

.vtdd-system-banner-head strong {
  flex-shrink: 0;
  padding: 6px 9px;
  border-radius: 999px;
  background: #0f172a;
  color: #ffd400;
  font-size: 9px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.vtdd-system-banner-body {
  display: grid;
  gap: 7px;
}

.vtdd-system-banner-body p {
  margin: 0;
  padding-left: 12px;
  position: relative;
  color: #111827;
  font-size: 12.2px;
  line-height: 1.48;
  font-weight: 900;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.vtdd-system-banner-body p::before {
  content: "";
  position: absolute;
  left: 0;
  top: .62em;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #f59e0b;
}

.vtdd-system-marquee span {
  max-width: none;
}



.vtdd-product-trigger {
  width: 100%;
  min-height: 58px;
  padding: 0 44px 0 14px;
  border-radius: 17px;
  border: 1px solid #dbe3ee;
  background: #f8fafc;
  color: #0f172a;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  text-align: left;
  font: inherit;
  font-size: 16px;
  line-height: 1.25;
  font-weight: 900;
  position: relative;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .8);
  -webkit-tap-highlight-color: transparent;
}

.vtdd-product-trigger::after {
  content: "⌕";
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: #eef2f7;
  color: #475569;
  font-size: 15px;
  font-weight: 900;
}

.vtdd-product-trigger:disabled {
  opacity: .58;
  color: #94a3b8;
  cursor: not-allowed;
  background: repeating-linear-gradient(135deg, #f8fafc 0 6px, #f1f5f9 6px 12px);
}

.vtdd-product-trigger[data-empty="true"] span {
  color: #94a3b8;
}

.vtdd-product-layer {
  position: fixed;
  inset: 0;
  z-index: 999998;
  padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
  display: flex;
  align-items: flex-end;
  background: rgba(15, 23, 42, .56);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.vtdd-product-panel {
  width: 100%;
  max-height: min(88vh, 760px);
  min-height: min(520px, 84vh);
  border-radius: 28px 28px 22px 22px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, .96);
  box-shadow: 0 28px 90px rgba(15, 23, 42, .34);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.vtdd-product-panel-head {
  padding: 14px 14px 12px;
  border-bottom: 1px solid #e2e8f0;
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 212, 0, .22), transparent 36%),
    #ffffff;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: start;
}

.vtdd-product-panel-head span {
  display: inline-flex;
  width: fit-content;
  padding: 7px 10px;
  border-radius: 999px;
  background: #0f172a;
  color: #ffd400;
  font-size: 9px;
  line-height: 1;
  font-weight: 950;
  letter-spacing: .09em;
  text-transform: uppercase;
}

.vtdd-product-panel-head h3 {
  margin: 9px 0 0;
  color: #0f172a;
  font-size: 20px;
  line-height: 1.08;
  font-weight: 950;
  letter-spacing: -.045em;
}

.vtdd-product-close {
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 15px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 24px;
  line-height: 1;
  font-weight: 900;
}

.vtdd-product-search-wrap {
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.vtdd-product-search-wrap input {
  width: 100%;
  min-height: 54px;
  padding: 0 14px;
  border-radius: 17px;
  border: 1px solid #dbe3ee;
  background: #ffffff;
  color: #0f172a;
  font-size: 16px;
  font-weight: 900;
  outline: none;
}

.vtdd-product-search-wrap input:focus {
  border-color: #ffd400;
  box-shadow: 0 0 0 4px rgba(255, 212, 0, .18);
}

.vtdd-product-count {
  margin-top: 8px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.35;
  font-weight: 850;
}

.vtdd-product-suggest {
  margin-top: 9px;
  padding: 10px;
  border-radius: 16px;
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 212, 0, .20), transparent 34%),
    #fffbea;
  border: 1px solid rgba(250, 204, 21, .48);
  box-shadow: 0 10px 24px rgba(245, 158, 11, .08);
}

.vtdd-product-suggest > span {
  display: block;
  color: #854d0e;
  font-size: 10.5px;
  line-height: 1;
  font-weight: 950;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.vtdd-product-suggest > div {
  margin-top: 9px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.vtdd-product-suggest button {
  min-height: 38px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: #0f172a;
  color: #ffd400;
  font-size: 11px;
  line-height: 1.15;
  font-weight: 950;
  cursor: pointer;
}

.vtdd-product-suggest button:active {
  transform: scale(.96);
}

.vtdd-product-empty-suggest {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.vtdd-product-empty-suggest span {
  color: #854d0e;
  font-size: 11px;
  font-weight: 950;
}

.vtdd-product-empty-suggest button {
  min-height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: #0f172a;
  color: #ffd400;
  font-size: 11px;
  font-weight: 950;
}


.vtdd-product-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 10px calc(14px + env(safe-area-inset-bottom));
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

.vtdd-product-option {
  width: 100%;
  min-height: 54px;
  margin-bottom: 8px;
  padding: 12px 12px;
  border-radius: 17px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #0f172a;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  text-align: left;
  font-size: 14px;
  line-height: 1.25;
  font-weight: 900;
  letter-spacing: -.01em;
}

.vtdd-product-option.active {
  border-color: #ffd400;
  background: #fffbea;
  box-shadow: inset 0 0 0 1px rgba(255, 212, 0, .50);
}

.vtdd-product-option small {
  flex: 0 0 auto;
  padding: 7px 9px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 9px;
  line-height: 1;
  font-weight: 950;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.vtdd-product-option.active small {
  background: #0f172a;
  color: #ffd400;
}

.vtdd-product-empty {
  padding: 28px 14px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 850;
}

@media (min-width: 720px) {
  .vtdd-product-layer {
    align-items: center;
    justify-content: center;
  }

  .vtdd-product-panel {
    width: min(560px, 100%);
    border-radius: 30px;
  }
}
`;

function settingEnabled(settings: SystemSettings, key: string) {
  const value = String(settings?.[key] || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function getSystemText(settings: SystemSettings, key: string) {
  return String(settings?.[key] || "").trim();
}

function getEffectiveRange(notify: NotifySettings) {
  const from = String(notify.priceEffectiveFrom || "").trim();
  const to = String(notify.priceEffectiveTo || "").trim();

  if (from && to) return `Bảng giá áp dụng từ ${from} đến ${to}`;
  if (from) return `Bảng giá áp dụng từ ${from}`;
  if (to) return `Bảng giá áp dụng đến ${to}`;
  return "";
}

function formatSystemMessageLines(message: string) {
  const raw = String(message || "")
    .replace(/\r/g, "")
    // Giữ đúng thứ tự trên xuống dưới theo nội dung Admin nhập.
    // Nếu Admin nhập liền một dòng, hệ thống tự tách trước các mục kiểu A/, B/, 1/, 2/, bullet.
    .replace(/\s+(?=[A-Za-zÀ-ỹ]\s*\/\s*)/g, "\n")
    .replace(/\s+(?=\d+\s*\/\s*)/g, "\n")
    .replace(/\s+(?=[•▪▫●◆◇*-]\s*)/g, "\n")
    .trim();

  if (!raw) return [];

  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}


const TYPE_OPTIONS = [
  { label: "Loại 1", value: "1", index: 3 },
  { label: "Loại 2", value: "2", index: 4 },
  { label: "Loại 3", value: "3", index: 5 },
  { label: "Loại 4", value: "4", index: 6 },
  { label: "Loại 5", value: "5", index: 7 },
  { label: "Loại 5+", value: "5+", index: 8 },
];

const SECURITY_QUESTIONS = [
  "Tên thú cưng đầu tiên của bạn là gì?",
  "Tên giáo viên chủ nhiệm đầu tiên của bạn là gì?",
  "Món ăn yêu thích của bạn là gì?",
  "Tên người bạn thân nhất thời đi học là gì?",
];

function parseMoney(value: any) {
  if (typeof value === "number") return value;

  const s = String(value || "").trim();
  if (!s) return 0;

  // Trường hợp Google trả số dạng text: 1000000 hoặc 1000000.5
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);

  // Trường hợp hiển thị VN: 1.000.000 đ / 1,000,000
  const raw = s.replace(/[^\d]/g, "");
  return raw ? Number(raw) : 0;
}

function parseRate(value: any) {
  if (typeof value === "number") return value > 1 ? value / 100 : value;

  const s = String(value || "").trim();
  if (!s) return 0;

  // 50% => 0.5
  if (s.includes("%")) {
    const n = Number(s.replace("%", "").replace(",", ".").trim());
    return isNaN(n) ? 0 : n / 100;
  }

  const n = Number(s.replace(",", "."));
  if (isNaN(n)) return 0;

  // 50 => 0.5, 0.5 => 0.5
  return n > 1 ? n / 100 : n;
}

function formatMoney(value: number) {
  if (!value || value <= 0) return "0 đ";
  return value.toLocaleString("vi-VN") + " đ";
}

function formatNumberInput(value: string) {
  const raw = String(value || "").replace(/\D/g, "");
  if (!raw) return "";
  return Number(raw).toLocaleString("vi-VN");
}

function isAppleBrand(value: any) {
  const s = String(value || "").toUpperCase();
  return s.includes("APPLE") || s.includes("IPHONE") || s.includes("IPAD");
}

function unique(list: string[]) {
  return Array.from(new Set(list.filter(Boolean)));
}



type ProductPickerProps = {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  disabled?: boolean;
  onSelect: (value: string) => void;
};

function normalizeSearchText(value: any) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[_\-\/]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSearchText(value: any) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function getProductSearchParts(value: any) {
  const raw = String(value || "");
  const modelRaw = raw.split("_")[0] || raw;
  const full = normalizeSearchText(raw);
  const model = normalizeSearchText(modelRaw);

  return {
    raw,
    full,
    model,
    fullCompact: full.replace(/\s+/g, ""),
    modelCompact: model.replace(/\s+/g, ""),
    fullTokens: full ? full.split(" ") : [],
    modelTokens: model ? model.split(" ") : [],
  };
}

function productTokenMatches(
  token: string,
  product: ReturnType<typeof getProductSearchParts>,
  queryHasText: boolean
) {
  if (!token) return true;

  const isNumberOnly = /^\d+$/.test(token);

  /*
    Fix lỗi:
    - "iphone 8" không match nhầm IPHONE 11_128G vì số 8 nằm trong 128G.
    - Nhưng vẫn cho "iphone16" tìm được IPHONE 16 do dùng compactSearchText.
  */
  if (isNumberOnly && queryHasText && token.length <= 2) {
    return product.modelTokens.some((item) => item === token);
  }

  if (product.fullTokens.some((item) => item === token || item.startsWith(token))) return true;
  if (product.full.includes(token)) return true;
  if (product.fullCompact.includes(token)) return true;

  return false;
}

function rankProductSearch(item: string, query: string) {
  const product = getProductSearchParts(item);
  const q = normalizeSearchText(query);
  const qCompact = compactSearchText(query);

  if (!q) return 99;
  if (product.model === q) return 0;
  if (product.full === q) return 1;
  if (product.model.startsWith(q)) return 2;
  if (product.full.startsWith(q)) return 3;
  if (product.model.includes(q)) return 4;
  if (product.full.includes(q)) return 5;

  // Cho phép gõ dính liền: IPHONE16 vẫn ra IPHONE 16 / IPHONE 16_128G.
  if (qCompact && product.modelCompact.startsWith(qCompact)) return 6;
  if (qCompact && product.fullCompact.startsWith(qCompact)) return 7;
  if (qCompact && product.modelCompact.includes(qCompact)) return 8;
  if (qCompact && product.fullCompact.includes(qCompact)) return 9;

  return 50;
}

function levenshteinDistance(a: string, b: string) {
  const x = compactSearchText(a);
  const y = compactSearchText(b);

  if (!x) return y.length;
  if (!y) return x.length;
  if (x === y) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= y.length; i++) matrix[i] = [i];
  for (let j = 0; j <= x.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= y.length; i++) {
    for (let j = 1; j <= x.length; j++) {
      matrix[i][j] =
        y.charAt(i - 1) === x.charAt(j - 1)
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
    }
  }

  return matrix[y.length][x.length];
}

function getProductSuggestions(options: string[], keyword: string, limit = 2) {
  const q = normalizeSearchText(keyword);
  const qCompact = compactSearchText(keyword);

  if (!q || qCompact.length < 3) return [];

  return options
    .map((item) => {
      const product = getProductSearchParts(item);

      let score = 999;

      if (product.modelCompact.startsWith(qCompact)) score = 0;
      else if (product.fullCompact.startsWith(qCompact)) score = 1;
      else if (product.modelCompact.includes(qCompact)) score = 2;
      else if (product.fullCompact.includes(qCompact)) score = 3;
      else {
        const modelDistance = levenshteinDistance(qCompact, product.modelCompact);
        const fullDistance = levenshteinDistance(qCompact, product.fullCompact);
        const distance = Math.min(modelDistance, fullDistance);

        const allowedDistance =
          qCompact.length <= 5 ? 1 :
          qCompact.length <= 8 ? 2 :
          3;

        if (distance <= allowedDistance) {
          score = 10 + distance;
        }
      }

      return { item, score };
    })
    .filter((x) => x.score < 999)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;

      return a.item.localeCompare(b.item, "vi", {
        numeric: true,
        sensitivity: "base",
      });
    })
    .slice(0, limit)
    .map((x) => x.item);
}

function ProductPicker({ label, value, placeholder, options, disabled = false, onSelect }: ProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");

  const filteredOptions = useMemo(() => {
    const q = normalizeSearchText(keyword);
    if (!q) return options;

    const words = q.split(/\s+/).filter(Boolean);
    const queryHasText = words.some((word) => /[a-z]/.test(word));
    const qCompact = compactSearchText(keyword);

    return options
      .filter((item) => {
        const product = getProductSearchParts(item);

        const normalMatch = words.every((word) =>
          productTokenMatches(word, product, queryHasText)
        );

        const compactMatch = !!qCompact && product.fullCompact.includes(qCompact);

        return normalMatch || compactMatch;
      })
      .sort((a, b) => {
        const score = rankProductSearch(a, keyword) - rankProductSearch(b, keyword);
        if (score !== 0) return score;

        return a.localeCompare(b, "vi", {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [options, keyword]);

  const suggestedOptions = useMemo(() => {
    if (!keyword.trim()) return [];

    const currentSet = new Set(filteredOptions);
    return getProductSuggestions(options, keyword, 2).filter((item) => !currentSet.has(item));
  }, [options, keyword, filteredOptions]);

  function openPicker() {
    if (disabled) return;
    setKeyword("");
    setOpen(true);
  }

  function chooseProduct(product: string) {
    onSelect(product);
    setOpen(false);
    setKeyword("");
  }

  return (
    <>
      <button
        type="button"
        className="vtdd-product-trigger"
        data-empty={value ? "false" : "true"}
        disabled={disabled}
        onClick={openPicker}
      >
        <span>{value || placeholder}</span>
      </button>

      {open && (
        <section className="vtdd-product-layer" role="dialog" aria-modal="true">
          <div className="vtdd-product-panel">
            <div className="vtdd-product-panel-head">
              <div>
                <span>Danh sách sản phẩm</span>
                <h3>{label}</h3>
              </div>
              <button type="button" className="vtdd-product-close" onClick={() => setOpen(false)} aria-label="Đóng">
                ×
              </button>
            </div>

            <div className="vtdd-product-search-wrap">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tìm nhanh theo tên máy, mã máy, bộ nhớ..."
                inputMode="search"
              />
              <div className="vtdd-product-count">
                Đang hiển thị {filteredOptions.length.toLocaleString("vi-VN")} / {options.length.toLocaleString("vi-VN")} sản phẩm. Có thể kéo lên/xuống để chọn.
              </div>

              {suggestedOptions.length > 0 && (
                <div className="vtdd-product-suggest">
                  <span>Có phải bạn đang tìm:</span>
                  <div>
                    {suggestedOptions.map((item, index) => (
                      <button
                        key={`suggest-${item}-${index}`}
                        type="button"
                        onClick={() => chooseProduct(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="vtdd-product-list">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((item, index) => (
                  <button
                    key={`${item}-${index}`}
                    type="button"
                    className={item === value ? "vtdd-product-option active" : "vtdd-product-option"}
                    onClick={() => chooseProduct(item)}
                  >
                    <span>{item}</span>
                    <small>{item === value ? "Đã chọn" : "Chọn"}</small>
                  </button>
                ))
              ) : (
                <div className="vtdd-product-empty">
                  Không tìm thấy sản phẩm phù hợp. Thử gõ ngắn hơn, ví dụ: iPhone 15, 17T, A56.

                  {suggestedOptions.length > 0 && (
                    <div className="vtdd-product-empty-suggest">
                      <span>Có phải bạn đang tìm:</span>
                      {suggestedOptions.map((item, index) => (
                        <button
                          key={`empty-suggest-${item}-${index}`}
                          type="button"
                          onClick={() => chooseProduct(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}


type ProfilePasswordInputProps = {
  value: string;
  placeholder: string;
  autoComplete?: string;
  onChange: (value: string) => void;
};

function ProfilePasswordInput({
  value,
  placeholder,
  autoComplete = "current-password",
  onChange,
}: ProfilePasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="profile-v3-password-field" data-visible={visible ? "1" : "0"}>
      <input
        type="text"
        value={value}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        data-secure-password={visible ? "visible" : "hidden"}
        style={{ WebkitTextSecurity: visible ? "none" : "disc" } as any}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />

      <button
        type="button"
        className="profile-v3-eye"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
      >
        {visible ? "Ẩn" : "Hiện"}
      </button>
    </div>
  );
}

export default function StaffTradeInApp({ maNV, maST, staffName, forceSetup = false }: StaffTradeInAppProps) {
  const [loading, setLoading] = useState(true);
  const [loadMsg, setLoadMsg] = useState("Đang tải dữ liệu bảng giá.");
  const [dataMoi, setDataMoi] = useState<SheetRow[]>([]);
  const [dataCu, setDataCu] = useState<SheetRow[]>([]);
  const [dataTablet, setDataTablet] = useState<SheetRow[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({});
  const [notifySettings, setNotifySettings] = useState<NotifySettings>(EMPTY_NOTIFY);
  const [showSystemPush, setShowSystemPush] = useState(false);

  const [mode, setMode] = useState<"tradein" | "buyonly">("tradein");
  const [hang, setHang] = useState("");
  const [spMoi, setSpMoi] = useState("");
  const [giaBanMoiInput, setGiaBanMoiInput] = useState("");
  const [spCu, setSpCu] = useState("");
  const [loai, setLoai] = useState("");
  const [showQuote, setShowQuote] = useState(false);
  const [showCustomerView, setShowCustomerView] = useState(false);
  const [quoteTime, setQuoteTime] = useState("");
  const [lookupLogTick, setLookupLogTick] = useState(0);

  const [mustSetup, setMustSetup] = useState(forceSetup);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileCurrentPassword, setProfileCurrentPassword] = useState("");
  const [profileChangePassword, setProfileChangePassword] = useState(forceSetup);
  const [profileNewPassword, setProfileNewPassword] = useState("");
  const [profileConfirmPassword, setProfileConfirmPassword] = useState("");
  const [profileQuestion, setProfileQuestion] = useState("");
  const [profileCustomQuestion, setProfileCustomQuestion] = useState("");
  const [profileAnswer, setProfileAnswer] = useState("");
  const [profileGmail, setProfileGmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/data/super-fast", { cache: "no-store" });
        const json = await res.json();

        if (!json.success) {
          setLoadMsg(json.message || "Không tải được dữ liệu.");
          setLoading(false);
          return;
        }

        setDataMoi(json.data.moi || []);
        setDataCu(json.data.cu || []);
        setDataTablet(json.data.tablet || []);
        setSystemSettings(json.data.system || {});
        setNotifySettings({
          marquee: json.data.notify?.marquee || "",
          fixedBanner: json.data.notify?.fixedBanner || "",
          pushMessage: json.data.notify?.pushMessage || "",
          pushVersion: json.data.notify?.pushVersion || "",
          priceEffectiveFrom: json.data.notify?.priceEffectiveFrom || "",
          priceEffectiveTo: json.data.notify?.priceEffectiveTo || "",
        });
        setLoading(false);
      } catch {
        setLoadMsg("Lỗi kết nối dữ liệu.");
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    if (mustSetup) {
      setShowProfilePanel(true);
      setProfileChangePassword(true);
    }
  }, [mustSetup]);

  useEffect(() => {
    if (!showProfilePanel && !mustSetup) return;
    if (profileLoaded) return;

    async function loadProfile() {
      try {
        const res = await fetch("/api/staff/profile", { cache: "no-store" });
        const data = await res.json();

        if (!data.success) return;

        const question = String(data.profile?.securityQuestion || "").trim();
        const gmail = String(data.profile?.gmail || "").trim();

        if (question) {
          if (SECURITY_QUESTIONS.includes(question)) {
            setProfileQuestion(question);
            setProfileCustomQuestion("");
          } else {
            setProfileQuestion("custom");
            setProfileCustomQuestion(question);
          }
        }

        if (gmail) {
          setProfileGmail(gmail);
        }

        setProfileLoaded(true);
      } catch {
        // Không chặn thao tác nếu load thông tin cá nhân lỗi
      }
    }

    loadProfile();
  }, [showProfilePanel, mustSetup, profileLoaded]);

  const brands = useMemo(() => {
    return unique(dataMoi.slice(1).map((row) => String(row[0] || "").trim()));
  }, [dataMoi]);

  const newProducts = useMemo(() => {
    return unique(
      dataMoi
        .slice(1)
        .filter((row) => !hang || String(row[0] || "").trim() === hang)
        .map((row) => String(row[1] || "").trim())
        .filter(Boolean)
    );
  }, [dataMoi, hang]);

  const selectedNewRow = useMemo(() => {
    return dataMoi.find((row) => String(row[1] || "").trim() === spMoi) || null;
  }, [dataMoi, spMoi]);

  const activeOldData = useMemo(() => {
    if (mode === "buyonly") {
      return dataCu.concat(dataTablet.slice(1));
    }

    const nganh = String(selectedNewRow?.[5] || "").toLowerCase();

    if (nganh.includes("tablet") || nganh.includes("máy tính bảng")) {
      if (nganh.includes("điện thoại")) return dataCu.concat(dataTablet.slice(1));
      return dataTablet;
    }

    return dataCu;
  }, [mode, dataCu, dataTablet, selectedNewRow]);

  const oldProducts = useMemo(() => {
    return unique(
      activeOldData
        .slice(1)
        .map((row) => String(row[1] || "").trim())
        .filter(Boolean)
    );
  }, [activeOldData]);

  const selectedOldRow = useMemo(() => {
    return activeOldData.find((row) => String(row[1] || "").trim() === spCu) || null;
  }, [activeOldData, spCu]);

  const memory = selectedOldRow?.[2] ? String(selectedOldRow[2]) : "";

    const canChooseNewProduct = mode === "tradein" && !!hang;
    const canChooseOldProduct = mode === "buyonly" || (mode === "tradein" && !!spMoi);
    const canChooseType = !!selectedOldRow && !!spCu;

    const systemLocked = settingEnabled(systemSettings, "SYSTEM_LOCK_ENABLED");
    const staffPageLocked = settingEnabled(systemSettings, "STAFF_PAGE_LOCKED");
    const staffTradeinLocked = settingEnabled(systemSettings, "STAFF_TRADEIN_LOCKED");
    const staffBuyonlyLocked = settingEnabled(systemSettings, "STAFF_BUYONLY_LOCKED");
    const allStaffTabsLocked = staffTradeinLocked && staffBuyonlyLocked;
    const currentStaffTabLocked = mode === "tradein" ? staffTradeinLocked : staffBuyonlyLocked;
    const staffAccessLocked = systemLocked || staffPageLocked || allStaffTabsLocked;

  const subsidyMeta = useMemo(() => {
    if (mode !== "tradein" || !selectedNewRow) {
      return {
        visible: false,
        tiLe: 0,
        minTroGia: 0,
        maxTroGia: 0,
        isApple: false,
      };
    }

    const oldBrand = String(selectedOldRow?.[0] || "").trim().toUpperCase();
    const apple = selectedOldRow ? isAppleBrand(oldBrand) : false;

    return {
      visible: true,
      tiLe: apple ? parseRate(selectedNewRow[3]) : parseRate(selectedNewRow[2]),
      maxTroGia: parseMoney(selectedNewRow[4]),
      minTroGia: apple ? parseMoney(selectedNewRow[7]) : parseMoney(selectedNewRow[6]),
      isApple: apple,
    };
  }, [mode, selectedNewRow, selectedOldRow]);

  const priceInfo = useMemo(() => {
  const type = TYPE_OPTIONS.find((x) => x.value === loai);

  if (!selectedOldRow || !type) {
    return {
      giaXac: 0,
      troGiaHang: 0,
      troGiaMWG: 0,
      tongTien: 0,
      tiLe: 0,
      maxTroGia: 0,
      minTroGia: 0,
      giaBanMoi: 0,
      khachCanBu: 0,
    };
  }

  const oldBrand = String(selectedOldRow[0] || "").trim().toUpperCase();
  const apple = isAppleBrand(oldBrand);

  // Data_Cu:
  // Loại 1 -> cột index 3
  // Loại 2 -> index 4
  // ...
  // Loại 5+ -> index 8
  const giaXac = parseMoney(selectedOldRow[type.index]);

  // Trợ giá MWG chỉ áp dụng Loại 1 và Loại 2.
  // Apple/iPhone/iPad lấy cột 10, hãng khác lấy cột 11.
  let troGiaMWG = 0;
  if (type.index === 3 || type.index === 4) {
    troGiaMWG = apple ? parseMoney(selectedOldRow[10]) : parseMoney(selectedOldRow[11]);
  }

  // Data_Moi:
  // index 2 = tỷ lệ thường
  // index 3 = tỷ lệ Apple
  // index 4 = mức MAX
  // index 6 = mức MIN thường
  // index 7 = mức MIN Apple
  const giaBanMoi = mode === "tradein" ? parseMoney(giaBanMoiInput) : 0;

  let tiLe = 0;
  let maxTroGia = 0;
  let minTroGia = 0;

  if (mode === "tradein" && selectedNewRow) {
    tiLe = apple ? parseRate(selectedNewRow[3]) : parseRate(selectedNewRow[2]);
    maxTroGia = parseMoney(selectedNewRow[4]);
    minTroGia = apple ? parseMoney(selectedNewRow[7]) : parseMoney(selectedNewRow[6]);
  }

  let troGiaHang = 0;

  if (mode === "tradein" && giaXac > 0 && tiLe > 0) {
    troGiaHang = Math.round((giaXac * tiLe) / 5000) * 5000;

    if (maxTroGia > 0 && troGiaHang > maxTroGia) {
      troGiaHang = maxTroGia;
    }

    if (minTroGia > 0 && troGiaHang < minTroGia && giaXac > 0) {
      troGiaHang = minTroGia;
    }
  }

  const tongTien = giaXac + troGiaHang + troGiaMWG;
  const khachCanBu = giaBanMoi > 0 && mode === "tradein" ? Math.max(0, giaBanMoi - tongTien) : 0;

  return {
    giaXac,
    troGiaHang,
    troGiaMWG,
    tongTien,
    tiLe,
    maxTroGia,
    minTroGia,
    giaBanMoi,
    khachCanBu,
  };
}, [mode, selectedNewRow, selectedOldRow, loai, giaBanMoiInput]);

  function getQuoteTime() {
    return new Date().toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  useEffect(() => {
    // Chỉ tạo thời gian sau khi client hydrate xong để tránh lỗi Hydration Error trên Safari/iPhone.
    setQuoteTime(getQuoteTime());
  }, []);

  useEffect(() => {
    if (lookupLogTick <= 0) return;
    if (!loai || !spCu || priceInfo.giaXac <= 0) return;

    sendQuoteLog("TRA_GIA");
  }, [lookupLogTick]);

  useEffect(() => {
    if (!notifySettings.pushMessage) return;

    const version = notifySettings.pushVersion || notifySettings.pushMessage;
    const key = `vtdd_staff_push_seen_${version}`;

    try {
      if (window.localStorage.getItem(key) !== "1") {
        setShowSystemPush(true);
      }
    } catch {
      setShowSystemPush(true);
    }
  }, [notifySettings.pushMessage, notifySettings.pushVersion]);

  useEffect(() => {
    if (mode === "tradein" && staffTradeinLocked && !staffBuyonlyLocked) {
      setMode("buyonly");
      setHang("");
      setSpMoi("");
      setGiaBanMoiInput("");
      setSpCu("");
      setLoai("");
      setShowQuote(false);
      setShowCustomerView(false);
      setQuoteTime("");
    }

    if (mode === "buyonly" && staffBuyonlyLocked && !staffTradeinLocked) {
      setMode("tradein");
      setHang("");
      setSpMoi("");
      setGiaBanMoiInput("");
      setSpCu("");
      setLoai("");
      setShowQuote(false);
      setShowCustomerView(false);
      setQuoteTime("");
    }
  }, [mode, staffTradeinLocked, staffBuyonlyLocked]);

function resetForm() {
  setHang("");
  setSpMoi("");
  setGiaBanMoiInput("");
  setSpCu("");
  setLoai("");
  setShowQuote(false);
  setShowCustomerView(false);
  setQuoteTime("");
}

    function buildQuoteText() {
    return (
      "BÁO GIÁ THU CŨ ĐỔI MỚI\n" +
      "-------------------------\n" +
      `Máy mới: ${mode === "tradein" ? spMoi : "Thu cũ không đổi mới"}\n` +
      `Máy cũ: ${spCu}${memory ? " - " + memory : ""}\n` +
      `Loại máy: Loại ${loai}\n` +
      `Giá máy cũ: ${formatMoney(priceInfo.giaXac)}\n` +
      `Hỗ trợ lên đời: ${mode === "tradein" ? formatMoney(priceInfo.troGiaHang) : "0 đ"}\n` +
      `Ưu đãi MWG: ${formatMoney(priceInfo.troGiaMWG)}\n` +
      (mode === "tradein" && priceInfo.giaBanMoi > 0
        ? `Giá bán máy mới: ${formatMoney(priceInfo.giaBanMoi)}\n`
        : "") +
      "-------------------------\n" +
      `Tổng tiền khách nhận: ${formatMoney(priceInfo.tongTien)}\n` +
      (mode === "tradein" && priceInfo.giaBanMoi > 0
        ? `Khách cần bù: ${formatMoney(priceInfo.khachCanBu)}\n`
        : "") +
      `Cập nhật: ${quoteTime || getQuoteTime()}\n\n` +
      "Lưu ý: Giá tham khảo tại thời điểm tra cứu. Kết quả cuối cùng phụ thuộc tình trạng máy thực tế khi kiểm tra tại siêu thị."
    );
  }

      async function getClientIpHint() {
  try {
    const cached = window.sessionStorage.getItem("vtdd_client_ip_hint");

    if (cached) {
      return cached;
    }

    const sources = [
      "https://api64.ipify.org?format=json",
      "https://api.ipify.org?format=json",
    ];

    for (const url of sources) {
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 4500);

        const res = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
        });

        window.clearTimeout(timer);

        const data = await res.json();
        const ip = String(data?.ip || "").trim();

        if (ip) {
          window.sessionStorage.setItem("vtdd_client_ip_hint", ip);
          return ip;
        }
      } catch {
        // thử source tiếp theo
      }
    }

    return "";
  } catch {
    return "";
  }
}

    async function sendQuoteLog(action: "TRA_GIA" | "COPY" | "SHARE" | "CUSTOMER_VIEW") {
  try {
    const res = await fetch("/api/log/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      body: JSON.stringify({
        action,
        maNV,
        maST,
        staffName,
        mode,
        spMoi: mode === "tradein" ? spMoi : "Thu cũ không đổi mới",
        spCu,
        memory,
        loai,
        giaXac: priceInfo.giaXac,
        troGiaHang: mode === "tradein" ? priceInfo.troGiaHang : 0,
        troGiaMWG: priceInfo.troGiaMWG,
        tongTien: priceInfo.tongTien,
        giaBanMoi: priceInfo.giaBanMoi,
        khachCanBu: priceInfo.khachCanBu,
        clientIpHint: await getClientIpHint(),
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      console.error("SEND_LOG_FAILED:", data?.message || res.statusText);
    }
  } catch (err) {
    console.error("SEND_LOG_ERROR:", err);
  }
}

  function showSwal(
    icon: "success" | "error" | "warning" | "info",
    title: string,
    text = "",
    timer = 1800
  ) {
    return Swal.fire({
      icon,
      title,
      text,
      timer,
      showConfirmButton: timer <= 0,
      confirmButtonText: "ĐÃ HIỂU",
      buttonsStyling: false,
      customClass: {
        container: "vtdd-swal-container",
        popup: "vtdd-swal-popup",
        title: "vtdd-swal-title",
        htmlContainer: "vtdd-swal-text",
        confirmButton: "vtdd-swal-confirm",
        },
    });
  }

  function validateQuoteReady() {
    if (!spCu || !loai || priceInfo.giaXac <= 0) {
      showSwal(
        "warning",
        "Thiếu thông tin báo giá",
        "Vui lòng chọn đầy đủ máy cũ và loại máy trước khi thực hiện.",
        0
      );
      return false;
    }

    return true;
  }

  async function fallbackCopyText(text: string) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let ok = false;

    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }

    document.body.removeChild(textarea);

    if (!ok) {
      throw new Error("Không copy được nội dung.");
    }
  }

  async function copyTextToClipboard(text: string) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
      }

      await fallbackCopyText(text);
    } catch {
      await fallbackCopyText(text);
    }
  }

  async function copyQuote() {
    if (!validateQuoteReady()) return;

    const text = buildQuoteText();
    sendQuoteLog("COPY");

    try {
      await copyTextToClipboard(text);

      await showSwal(
        "success",
        "Đã copy báo giá",
        "Mở Zalo, Messenger hoặc ứng dụng chat rồi dán nội dung để gửi khách.",
        1700
      );
    } catch {
      await showSwal(
        "error",
        "Không copy được",
        "Trình duyệt không cho phép copy tự động. Vui lòng thử lại hoặc dùng nút Chia sẻ.",
        0
      );
    }
  }

  async function shareQuote() {
    if (!validateQuoteReady()) return;

    const text = buildQuoteText();
    sendQuoteLog("SHARE");

    const shareData = {
      title: "Báo giá thu cũ đổi mới",
      text,
    };

    try {
      const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data: ShareData) => boolean;
      };

      if (nav.share && (!nav.canShare || nav.canShare(shareData))) {
        await nav.share(shareData);
        return;
      }

      await copyTextToClipboard(text);

      await showSwal(
        "info",
        "Máy chưa hỗ trợ chia sẻ trực tiếp",
        "Nội dung báo giá đã được copy. Mở Zalo, Messenger hoặc ứng dụng chat rồi dán để gửi khách.",
        0
      );
    } catch (err: any) {
      if (err?.name === "AbortError") return;

      try {
        await copyTextToClipboard(text);

        await showSwal(
          "info",
          "Đã copy báo giá",
          "Không mở được bảng chia sẻ, hệ thống đã copy nội dung để m dán vào Zalo hoặc ứng dụng khác.",
          0
        );
      } catch {
        await showSwal(
          "error",
          "Không chia sẻ được",
          "Trình duyệt không cho phép chia sẻ hoặc copy nội dung.",
          0
        );
      }
    }
  }

  function openCustomerView() {
    if (!validateQuoteReady()) return;

    sendQuoteLog("CUSTOMER_VIEW");
    setQuoteTime(getQuoteTime());
    setShowCustomerView(true);
  }

  function closeCustomerView() {
  setShowCustomerView(false);
    }

function openProfilePanel() {
  setShowProfilePanel(true);
}

function closeProfilePanel() {
  if (mustSetup) return;
  setShowProfilePanel(false);
}

async function submitProfileUpdate() {
  const finalQuestion =
    profileQuestion === "custom" ? profileCustomQuestion : profileQuestion;

  if (!profileCurrentPassword) {
    showSwal("warning", "Thiếu thông tin", "Vui lòng nhập mật khẩu hiện tại để xác thực.", 0);
    return;
  }

  if (!finalQuestion || !profileGmail) {
    showSwal("warning", "Thiếu thông tin", "Vui lòng nhập đầy đủ Gmail và câu hỏi bảo mật.", 0);
    return;
  }

  if (mustSetup && !profileAnswer) {
    showSwal("warning", "Thiếu câu trả lời", "Vui lòng nhập câu trả lời bảo mật trong lần thiết lập đầu tiên.", 0);
    return;
  }

  if (profileChangePassword || mustSetup) {
    if (!profileNewPassword || !profileConfirmPassword) {
      showSwal("warning", "Thiếu mật khẩu mới", "Vui lòng nhập mật khẩu mới và xác nhận mật khẩu mới.", 0);
      return;
    }

    if (profileNewPassword !== profileConfirmPassword) {
      showSwal("warning", "Mật khẩu không khớp", "Mật khẩu mới và xác nhận mật khẩu mới chưa giống nhau.", 0);
      return;
    }
  }

  try {
    setProfileSaving(true);

    const res = await fetch("/api/staff/update-security", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: profileCurrentPassword,
        changePassword: profileChangePassword || mustSetup,
        newPassword: (profileChangePassword || mustSetup) ? profileNewPassword : "",
        confirmPassword: (profileChangePassword || mustSetup) ? profileConfirmPassword : "",
        question: finalQuestion,
        answer: profileAnswer,
        gmail: profileGmail,
        }),
    });

    const data = await res.json();

    if (!data.success) {
      showSwal("error", "Không cập nhật được", data.message || "Vui lòng thử lại.", 0);
      setProfileSaving(false);
      return;
    }

    setMustSetup(false);
    setShowProfilePanel(false);
    setProfileChangePassword(false);

    setProfileCurrentPassword("");
    setProfileChangePassword(false);
    setProfileNewPassword("");
    setProfileConfirmPassword("");
    setProfileAnswer("");

    setProfileSaving(false);

    showSwal("success", "Đã cập nhật", data.message || "Cập nhật thành công.", 1700);
  } catch {
    setProfileSaving(false);
    showSwal("error", "Lỗi kết nối", "Không gửi được yêu cầu cập nhật.", 0);
  }
}

function renderProfilePanel(modeView: "modal" | "setup") {
  const isSetup = modeView === "setup" || mustSetup;

  const finalQuestionPreview =
    profileQuestion === "custom"
      ? profileCustomQuestion || "Câu hỏi bảo mật riêng"
      : profileQuestion || "Chưa chọn câu hỏi";

  const passwordModeText = isSetup
    ? "Bắt buộc đổi mật khẩu lần đầu"
    : profileChangePassword
      ? "Đang bật đổi mật khẩu"
      : "Đang giữ mật khẩu cũ";

  return (
    <section
      className={isSetup ? "profile-v5-layer profile-v5-setup" : "profile-v5-layer"}
      role="dialog"
      aria-modal="true"
    >
      <div className="profile-v5-shell">
        <aside className="profile-v5-hero" aria-label="Tổng quan tài khoản">
          <div className="profile-v5-hero-top">
            <span>Bảo mật tài khoản</span>
            {!isSetup && (
              <button
                type="button"
                className="profile-v5-close"
                onClick={closeProfilePanel}
                aria-label="Đóng"
              >
                ×
              </button>
            )}
          </div>

          <div className="profile-v5-hero-title">
            <h2>{isSetup ? "Thiết lập lần đầu" : "Cập nhật thông tin"}</h2>
            <p>
              {isSetup
                ? "Đổi mật khẩu mặc định và thêm thông tin khôi phục trước khi sử dụng hệ thống."
                : "Xác thực mật khẩu hiện tại, sau đó cập nhật mật khẩu, Gmail hoặc câu hỏi bảo mật."}
            </p>
          </div>

          <div className="profile-v5-user-card">
            <div className="profile-v5-avatar">VT</div>
            <div>
              <b>{staffName || "Nhân viên"}</b>
              <span>NV {maNV} · ST {maST}</span>
            </div>
          </div>

          <div className="profile-v5-flow">
            <div className="done">
              <i>01</i>
              <div>
                <b>Xác thực</b>
                <span>Nhập mật khẩu hiện tại.</span>
              </div>
            </div>
            <div className={isSetup || profileChangePassword ? "done" : ""}>
              <i>02</i>
              <div>
                <b>Mật khẩu</b>
                <span>{passwordModeText}</span>
              </div>
            </div>
            <div className={profileGmail || finalQuestionPreview !== "Chưa chọn câu hỏi" ? "done" : ""}>
              <i>03</i>
              <div>
                <b>Khôi phục</b>
                <span>Gmail và câu hỏi bảo mật.</span>
              </div>
            </div>
          </div>

          <div className="profile-v5-brand-note">
            <small>Viễn Thông Di Động</small>
            <strong>{finalQuestionPreview}</strong>
          </div>
        </aside>

        <form
          className="profile-v5-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitProfileUpdate();
          }}
        >
          <div className="profile-v5-mobile-head">
            <div>
              <span>Bảo mật tài khoản</span>
              <h2>{isSetup ? "Thiết lập lần đầu" : "Cập nhật thông tin"}</h2>
            </div>
            {!isSetup && (
              <button type="button" onClick={closeProfilePanel} aria-label="Đóng">×</button>
            )}
          </div>

          <section className="profile-v5-block profile-v5-auth-block">
            <div className="profile-v5-block-head">
              <i>01</i>
              <div>
                <b>Xác thực tài khoản</b>
                <span>Bắt buộc nhập mật khẩu hiện tại để lưu thay đổi.</span>
              </div>
            </div>

            <div className="profile-v5-field profile-v5-field-wide">
              <label>Mật khẩu hiện tại</label>
              <ProfilePasswordInput
                value={profileCurrentPassword}
                onChange={setProfileCurrentPassword}
                autoComplete="current-password"
                placeholder={isSetup ? "Nhập mật khẩu mặc định 123123" : "Nhập mật khẩu hiện tại"}
              />
            </div>
          </section>

          <section className="profile-v5-block profile-v5-password-block">
            <label className="profile-v5-switch">
              <input
                type="checkbox"
                checked={isSetup || profileChangePassword}
                disabled={isSetup}
                onChange={(e) => setProfileChangePassword(e.target.checked)}
              />
              <span></span>
              <div>
                <b>Đổi mật khẩu đăng nhập</b>
                <em>
                  {isSetup
                    ? "Bắt buộc tạo mật khẩu mới cho tài khoản."
                    : "Bật nếu muốn thay đổi mật khẩu đăng nhập hiện tại."}
                </em>
              </div>
            </label>

            {(isSetup || profileChangePassword) && (
              <div className="profile-v5-two-cols profile-v5-password-grid">
                <div className="profile-v5-field">
                  <label>Mật khẩu mới</label>
                  <ProfilePasswordInput
                    value={profileNewPassword}
                    onChange={setProfileNewPassword}
                    autoComplete="new-password"
                    placeholder="Nhập mật khẩu mới"
                  />
                </div>

                <div className="profile-v5-field">
                  <label>Xác nhận mật khẩu mới</label>
                  <ProfilePasswordInput
                    value={profileConfirmPassword}
                    onChange={setProfileConfirmPassword}
                    autoComplete="new-password"
                    placeholder="Nhập lại mật khẩu mới"
                  />
                </div>
              </div>
            )}
          </section>

          <section className="profile-v5-block profile-v5-recovery-block">
            <div className="profile-v5-block-head">
              <i>02</i>
              <div>
                <b>Thông tin khôi phục</b>
                <span>Dùng cho OTP quên mật khẩu và xác minh tài khoản.</span>
              </div>
            </div>

            <div className="profile-v5-field profile-v5-field-wide">
              <label>Câu hỏi bảo mật</label>
              <select value={profileQuestion} onChange={(e) => setProfileQuestion(e.target.value)}>
                <option value="">Chọn câu hỏi bảo mật</option>
                {SECURITY_QUESTIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
                <option value="custom">Tự tạo câu hỏi riêng</option>
              </select>
            </div>

            {profileQuestion === "custom" && (
              <div className="profile-v5-field profile-v5-field-wide">
                <label>Câu hỏi tự tạo</label>
                <textarea
                  value={profileCustomQuestion}
                  onChange={(e) => setProfileCustomQuestion(e.target.value)}
                  placeholder="Nhập câu hỏi bảo mật riêng"
                  rows={2}
                />
              </div>
            )}

            <div className="profile-v5-two-cols profile-v5-recovery-grid">
              <div className="profile-v5-field">
                <label>Câu trả lời bảo mật</label>
                <textarea
                  value={profileAnswer}
                  onChange={(e) => setProfileAnswer(e.target.value)}
                  placeholder={isSetup ? "Bắt buộc nhập trong lần đầu" : "Để trống nếu không đổi"}
                  rows={2}
                />
              </div>

              <div className="profile-v5-field">
                <label>Gmail nhận OTP</label>
                <input
                  type="email"
                  value={profileGmail}
                  onChange={(e) => setProfileGmail(e.target.value)}
                  placeholder="ten@gmail.com"
                />
              </div>
            </div>
          </section>

          <div className="profile-v5-actions">
            {!isSetup && (
              <button type="button" className="profile-v5-btn ghost" onClick={closeProfilePanel}>
                Đóng
              </button>
            )}
            <button type="submit" className="profile-v5-btn primary" disabled={profileSaving}>
              {profileSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function closeSystemPush() {
  const version = notifySettings.pushVersion || notifySettings.pushMessage;

  if (version) {
    window.localStorage.setItem(`vtdd_staff_push_seen_${version}`, "1");
  }

  setShowSystemPush(false);
}

function renderSystemStyle() {
  return <style>{SYSTEM_UI_CSS}</style>;
}

function renderSystemNotices() {
  const effectiveRange = getEffectiveRange(notifySettings);
  const fixedBannerLines = formatSystemMessageLines(notifySettings.fixedBanner || "");

  return (
    <>
      {notifySettings.marquee ? (
        <div className="vtdd-system-marquee">
          <span>{notifySettings.marquee}</span>
        </div>
      ) : null}

      {fixedBannerLines.length > 0 ? (
        <section className="vtdd-system-banner vtdd-system-banner-featured system-notice-v2" aria-label="Thông báo hệ thống">
          <div className="system-notice-v2-head">
            <div>
              <span>Thông báo hệ thống</span>
              <strong>Quan trọng</strong>
            </div>
          </div>

          <div className="system-notice-v2-list">
            {fixedBannerLines.map((line, index) => (
              <p key={`system-banner-${index}`}>{line}</p>
            ))}
          </div>
        </section>
      ) : null}

      {effectiveRange ? (
        <div className="vtdd-system-effective">
          <span>Ngày áp dụng</span>
          <b>{effectiveRange}</b>
        </div>
      ) : null}
    </>
  );
}

function renderPushNotify() {
  if (!showSystemPush || !notifySettings.pushMessage) return null;

  return (
    <section className="vtdd-push-layer" role="dialog" aria-modal="true">
      <div className="vtdd-push-card">
        <span>Thông báo mới</span>
        <h2>Thông báo từ Admin</h2>
        <p>{notifySettings.pushMessage}</p>
        <button type="button" onClick={closeSystemPush}>ĐÃ HIỂU</button>
      </div>
    </section>
  );
}

function renderSystemLock() {
  const message = getSystemText(systemSettings, "SYSTEM_LOCK_MESSAGE") || "HỆ THỐNG ĐANG CẬP NHẬT KHẨN.";

  return (
    <main className="vtdd-lock-page">
      {renderSystemStyle()}
      <section className="vtdd-lock-card">
        <div className="vtdd-lock-icon">!</div>
        <span>Tạm khóa truy cập</span>
        <h1>Hệ thống đang cập nhật</h1>
        <p>{message}</p>
        <a href="/">Quay về trang chủ</a>
      </section>
    </main>
  );
}

  if (loading) {
    return (
      <main className="staff-os-page">
        <section className="staff-loader">
          <div className="loader-orb"></div>
          <div className="loader-title">Viễn Thông Di Động</div>
          <p>{loadMsg}</p>
        </section>
      </main>
    );
  }

  if (staffAccessLocked) {
    return renderSystemLock();
  }

  if (mustSetup) {
    return (
      <main className="staff-os-page staff-setup-only-bg">
        {renderSystemStyle()}
        {renderProfilePanel("setup")}
      </main>
    );
  }

  return (
    <main className="staff-os-page">
      {renderSystemStyle()}
      <section className="staff-os-shell">
        <header className="staff-command">
          <div>
            <div className="staff-kicker">STAFF PORTAL</div>
            <h1>Tra cứu thu cũ</h1>
            <p>
              {staffName ? `${staffName} • ` : ""}NV: {maNV} • ST: {maST}
            </p>
          </div>

          <button className="staff-logout" onClick={() => (window.location.href = "/api/auth/staff-logout")}>
             Đăng xuất
          </button>

          <div className="staff-hero-actions">
            <button
              type="button"
              className="staff-profile-trigger"
              onClick={openProfilePanel}
            >
              Cập nhật thông tin
            </button>
          </div>
        </header>

        {renderSystemNotices()}

        {currentStaffTabLocked && (
          <div className="vtdd-tab-locked-note">
            Tab hiện tại đang tạm khóa theo cài đặt Admin. Vui lòng chọn tab còn lại hoặc thử lại sau.
          </div>
        )}

        {showProfilePanel && renderProfilePanel("modal")}

        <section className="staff-workspace">
          <div className="staff-main-panel">
        <section className="mode-switch">
          <button
            className={mode === "tradein" ? "active" : ""}
            disabled={staffTradeinLocked}
            onClick={() => {
              if (staffTradeinLocked) return;
              setMode("tradein");
              resetForm();
            }}
          >
            Thu cũ đổi mới{staffTradeinLocked ? " • Khóa" : ""}
          </button>
          <button
            className={mode === "buyonly" ? "active" : ""}
            disabled={staffBuyonlyLocked}
            onClick={() => {
              if (staffBuyonlyLocked) return;
              setMode("buyonly");
              resetForm();
            }}
          >
            Thu cũ không đổi mới{staffBuyonlyLocked ? " • Khóa" : ""}
          </button>
        </section>

        <section className="tradein-card">
  {mode === "tradein" && (
    <>
      <div className="section-head">
        <div>
          <span>01</span>
          <h2>Thông tin máy mới</h2>
        </div>
        <button onClick={resetForm}>Reset</button>
      </div>
              <label>Hãng máy mới</label>
              <select value={hang} onChange={(e) => {
                setHang(e.target.value);
                setSpMoi("");
                setGiaBanMoiInput("");
                setSpCu("");
                setLoai("");
              }}>
                <option value="">Chọn hãng</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              <label>Tên sản phẩm mới</label>
              <ProductPicker
                label="Chọn sản phẩm mới"
                value={spMoi}
                options={newProducts}
                disabled={!canChooseNewProduct}
                placeholder={canChooseNewProduct ? "Gõ hoặc chọn máy mới" : "Chọn hãng trước"}
                onSelect={(product) => {
                  setSpMoi(product);
                  setGiaBanMoiInput("");
                  setSpCu("");
                  setLoai("");
                }}
              />

                <label>Giá bán máy mới</label>
                <input
                id="giaBanMoi"
                value={giaBanMoiInput}
                inputMode="numeric"
                disabled={mode !== "tradein" || !spMoi}
                onChange={(e) => setGiaBanMoiInput(formatNumberInput(e.target.value))}
                placeholder={spMoi ? "VD: 12.990.000" : "Chọn máy mới trước"}
                />

              {subsidyMeta.visible && (
                <div className="subsidy-meta-grid">
                  <div className="subsidy-meta-card">
                    <span>TỈ LỆ TRỢ GIÁ:</span>
                    <b>{(subsidyMeta.tiLe * 100).toFixed(0)}%</b>
                  </div>

                  <div className="subsidy-meta-card">
                    <span>MỨC MIN:</span>
                    <b>{formatMoney(subsidyMeta.minTroGia).replace(" đ", "")}</b>
                  </div>

                  <div className="subsidy-meta-card">
                    <span>MỨC MAX:</span>
                    <b>{formatMoney(subsidyMeta.maxTroGia).replace(" đ", "")}</b>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="section-head second">
            <div>
                <span>{mode === "buyonly" ? "01" : "02"}</span>
                <h2>Thông tin máy cũ</h2>
            </div>

            {mode === "buyonly" && <button onClick={resetForm}>Reset</button>}
            </div>

          <label>Tên sản phẩm cũ</label>
          <ProductPicker
            label="Chọn sản phẩm cũ"
            value={spCu}
            options={oldProducts}
            disabled={!canChooseOldProduct}
            placeholder={canChooseOldProduct ? "Gõ hoặc chọn máy cũ" : "Chọn máy mới trước"}
            onSelect={(product) => {
              setSpCu(product);
              setLoai("");
            }}
          />

          <label>Bộ nhớ</label>
          <input id="bonho" value={memory} readOnly placeholder="Tự động theo máy cũ" />

          <label>Loại máy</label>
            <select id="loai" value={loai} disabled={!canChooseType} onChange={(e) => {
            setLoai(e.target.value);
            setShowQuote(true);
            setQuoteTime(getQuoteTime());
            setLookupLogTick((v) => v + 1);
            }}>
            <option value="">Chọn loại máy</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                    </section>
          </div>

          <aside className="staff-side-panel">
                    {selectedOldRow && (
                    <section className="type-price-grid">
                        {TYPE_OPTIONS.map((t) => {
            const gx = parseMoney(selectedOldRow[t.index]);
            const oldBrand = String(selectedOldRow[0] || "").trim().toUpperCase();
            const apple = isAppleBrand(oldBrand);

            let mwg = 0;
            if (t.index === 3 || t.index === 4) {
                mwg = apple ? parseMoney(selectedOldRow[10]) : parseMoney(selectedOldRow[11]);
            }

            let tiLe = 0;
            let max = 0;
            let min = 0;
            let tgHang = 0;

            if (mode === "tradein" && selectedNewRow && gx > 0) {
                tiLe = apple ? parseRate(selectedNewRow[3]) : parseRate(selectedNewRow[2]);
                max = parseMoney(selectedNewRow[4]);
                min = apple ? parseMoney(selectedNewRow[7]) : parseMoney(selectedNewRow[6]);

                if (tiLe > 0) {
                tgHang = Math.round((gx * tiLe) / 5000) * 5000;
                if (max > 0 && tgHang > max) tgHang = max;
                if (min > 0 && tgHang < min && gx > 0) tgHang = min;
                }
            }

            const totalTroGia = (mode === "tradein" ? tgHang : 0) + mwg;
            const tong = gx + totalTroGia;

            return (
                <button
                key={t.value}
                className={loai === t.value ? "active" : ""}
                onClick={() => {
                setLoai(t.value);
                setShowQuote(true);
                setQuoteTime(getQuoteTime());
                setLookupLogTick((v) => v + 1);
                }}
                >
                <span>{t.label}</span>
                <b>{formatMoney(gx)}</b>
                <em>
                    TG: {formatMoney(totalTroGia)} · Tổng: {formatMoney(tong)}
                </em>
                </button>
            );
            })}
          </section>
        )}

            {!selectedOldRow && (
              <section className="type-empty-card">
                <div className="type-empty-icon">₫</div>
                <h3>Chọn máy cũ để xem bảng giá</h3>
                <p>Sau khi chọn model máy cũ, bảng giá theo từng loại máy sẽ hiển thị tại đây.</p>
              </section>
            )}

        <section className={showQuote && loai ? "result-sheet-v2 is-open" : "result-sheet-v2"}>
          <button className="result-close" onClick={() => setShowQuote(false)} aria-label="Đóng">
            ×
          </button>

          <div className="result-headline">TỔNG TIỀN KHÁCH NHẬN</div>

          <div className="result-note">
            #Lưu ý: Không áp dụng chung ưu đãi học sinh, sinh viên, mua kèm.
          </div>

          <div id="tongTienDisplay" className="result-total">
            {formatMoney(priceInfo.tongTien)}
          </div>

            <div className="quote-time-pill">
                Cập nhật: {quoteTime || "--/--/---- --:--"}
            </div>

          <div className="result-card">
            <div className="result-row">
            <span>MÁY MỚI:</span>
            <b>{mode === "tradein" ? spMoi || "CHƯA CHỌN" : "THU CŨ KHÔNG ĐỔI MỚI"}</b>
            </div>

            {mode === "tradein" && priceInfo.giaBanMoi > 0 && (
            <div className="result-row">
                <span>GIÁ BÁN MÁY MỚI:</span>
                <b>{formatMoney(priceInfo.giaBanMoi)}</b>
            </div>
            )}

            <div className="result-row">
              <span>MÁY CŨ:</span>
              <b>{spCu ? `${spCu}${memory ? " · " + memory : ""}` : "CHƯA CHỌN"}</b>
            </div>

            <div className="result-row">
              <span>LOẠI MÁY:</span>
              <b>{loai ? `LOẠI ${loai}` : "CHƯA CHỌN"}</b>
            </div>

            <div className="result-row">
              <span>NHÂN VIÊN:</span>
              <b>{maNV}</b>
            </div>
          </div>

          <div className="result-card result-money-card">
            <div className="result-row">
              <span>GIÁ MÁY CŨ:</span>
              <b>{formatMoney(priceInfo.giaXac)}</b>
            </div>

            <div className="result-row">
              <span>HỖ TRỢ LÊN ĐỜI:</span>
              <b>{mode === "tradein" ? formatMoney(priceInfo.troGiaHang) : "0 đ"}</b>
            </div>

            <div className="result-row">
            <span>ƯU ĐÃI MWG:</span>
            <b>{formatMoney(priceInfo.troGiaMWG)}</b>
            </div>

            {mode === "tradein" && priceInfo.giaBanMoi > 0 && (
            <div className="result-row result-need-pay-row">
                <span>KHÁCH CẦN BÙ:</span>
                <b>{formatMoney(priceInfo.khachCanBu)}</b>
            </div>
            )}
          </div>

          <div className="result-actions">
            <button className="result-btn result-btn-copy" onClick={copyQuote}>
              📋 COPY
            </button>

            <button className="quote-btn quote-btn-zalo" onClick={shareQuote}>
              🔗 CHIA SẺ
            </button>

            <button className="quote-btn quote-btn-customer" onClick={openCustomerView}>
             👁️ CHẾ ĐỘ CHO KHÁCH XEM
            </button>
          </div>
        </section>
          </aside>
        </section>
      </section>

      {showCustomerView && (
        <section className="customer-focus-layer" role="dialog" aria-modal="true">
          <div className="customer-focus-brand">Viễn Thông Di Động</div>

          <div className="customer-focus-card">
            <button className="customer-focus-close" onClick={closeCustomerView} aria-label="Đóng">
              ×
            </button>

            <div className="customer-focus-kicker">TỔNG TIỀN KHÁCH NHẬN</div>

            <div className="customer-focus-note">
              #Lưu ý: Không áp dụng chung ưu đãi học sinh, sinh viên, mua kèm.
            </div>

            <div className="customer-focus-total">
              {formatMoney(priceInfo.tongTien)}
            </div>

            <div className="customer-focus-time">
              Cập nhật: {quoteTime || "--/--/---- --:--"}
            </div>

            <div className="customer-focus-info">
              <div>
                <span>MÁY MỚI:</span>
                <b>{mode === "tradein" ? spMoi || "CHƯA CHỌN" : "THU CŨ KHÔNG ĐỔI MỚI"}</b>
              </div>

              {mode === "tradein" && priceInfo.giaBanMoi > 0 && (
                <div>
                  <span>GIÁ BÁN MÁY MỚI:</span>
                  <b>{formatMoney(priceInfo.giaBanMoi)}</b>
                </div>
              )}

              <div>
                <span>MÁY CŨ:</span>
                <b>{spCu ? `${spCu}${memory ? " · " + memory : ""}` : "CHƯA CHỌN"}</b>
              </div>

              <div>
                <span>LOẠI MÁY:</span>
                <b>{loai ? `LOẠI ${loai}` : "CHƯA CHỌN"}</b>
              </div>

              <div>
                <span>NHÂN VIÊN:</span>
                <b>{maNV}</b>
              </div>
            </div>

            <div className="customer-focus-info customer-focus-money">
              <div>
                <span>GIÁ MÁY CŨ:</span>
                <b>{formatMoney(priceInfo.giaXac)}</b>
              </div>

              <div>
                <span>HỖ TRỢ LÊN ĐỜI:</span>
                <b>{mode === "tradein" ? formatMoney(priceInfo.troGiaHang) : "0 đ"}</b>
              </div>

              <div>
                <span>ƯU ĐÃI MWG:</span>
                <b>{formatMoney(priceInfo.troGiaMWG)}</b>
              </div>

              {mode === "tradein" && priceInfo.giaBanMoi > 0 && (
                <div className="customer-focus-need-pay">
                  <span>KHÁCH CẦN BÙ:</span>
                  <b>{formatMoney(priceInfo.khachCanBu)}</b>
                </div>
              )}
            </div>

            <div className="customer-focus-actions">
              <button onClick={copyQuote}>📋 COPY</button>
              <button className="zalo" onClick={shareQuote}>🔗 CHIA SẺ</button>
              <button className="exit" onClick={closeCustomerView}>🔓 THOÁT</button>
            </div>
          </div>
        </section>
      )}

      {renderPushNotify()}
    </main>
  );
}

