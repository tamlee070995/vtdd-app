"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { sanitizeHtml } from "@/lib/html-sanitize";
import { getActiveSystemLock } from "@/lib/system-lock";

type SheetRow = any[];

type StaffTradeInAppProps = {
  maNV: string;
  maST: string;
  staffName: string;
  forceSetup?: boolean;
};

type QuoteHistoryItem = {
  time: string;
  action: string;
  maNV: string;
  maST: string;
  staffName: string;
  mode: string;
  spMoi: string;
  spCu: string;
  memory: string;
  loai: string;
  giaXac: number;
  troGiaHang: number;
  troGiaMWG: number;
  tongTien: number;
  khachCanBu: number;
  ip?: string;
  deviceLabel?: string;
  networkType?: string;
};


type SystemSettings = Record<string, string>;

type NotifySettings = {
  marquee: string;
  fixedBanner: string;
  pushMessage: string;
  pushVersion: string;
  staffPopupTradeinEnabled: string;
  staffPopupTradeinMessage: string;
  staffPopupTradeinSeconds: string;
  staffPopupTradeinVersion: string;
  staffPopupBuyonlyEnabled: string;
  staffPopupBuyonlyMessage: string;
  staffPopupBuyonlySeconds: string;
  staffPopupBuyonlyVersion: string;
  priceEffectiveFrom: string;
  priceEffectiveTo: string;
};

type StaffPriceCache = {
  dataVersion: string;
  savedAt: number;
  data: {
    moi: SheetRow[];
    cu: SheetRow[];
    tablet: SheetRow[];
    system: SystemSettings;
    notify: NotifySettings;
  };
};

const EMPTY_NOTIFY: NotifySettings = {
  marquee: "",
  fixedBanner: "",
  pushMessage: "",
  pushVersion: "",
  staffPopupTradeinEnabled: "0",
  staffPopupTradeinMessage: "",
  staffPopupTradeinSeconds: "10",
  staffPopupTradeinVersion: "",
  staffPopupBuyonlyEnabled: "0",
  staffPopupBuyonlyMessage: "",
  staffPopupBuyonlySeconds: "10",
  staffPopupBuyonlyVersion: "",
  priceEffectiveFrom: "",
  priceEffectiveTo: "",
};

const STAFF_PRICE_CACHE_KEY = "vtdd_staff_price_cache_v2";
const STAFF_PRICE_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

const SYSTEM_UI_CSS = `
.vtdd-system-marquee {
  position: relative;
  overflow: hidden;
  min-height: 42px;
  border-radius: 18px;
  border: 1px solid rgba(239, 68, 68, .42);
  background: linear-gradient(135deg, #fff5f5, #ffffff);
  color: #dc2626;
  box-shadow: 0 12px 24px rgba(239, 68, 68, .10);
}

.vtdd-system-marquee span {
  position: absolute;
  top: 50%;
  left: 100%;
  white-space: nowrap;
  transform: translateY(-50%);
  font-size: 12px;
  line-height: 1;
  font-weight: 950;
  letter-spacing: .02em;
  color: #dc2626;
  text-shadow: 0 1px 0 rgba(255,255,255,.75);
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
  top: 0;
  left: 0;
  right: 0;
  z-index: 999999;
  padding: max(12px, env(safe-area-inset-top)) 12px 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.vtdd-push-card {
  width: min(calc(100% - 16px), 520px);
  padding: 14px;
  border-radius: 0 0 24px 24px;
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 212, 0, .28), transparent 38%),
    linear-gradient(135deg, #0f172a, #020617);
  border: 1px solid rgba(255, 212, 0, .32);
  box-shadow: 0 22px 62px rgba(15, 23, 42, .26);
  pointer-events: auto;
  animation: vtddPushSlideDown .34s ease-out both, vtddPushSlideUp .34s ease-in 29.6s forwards;
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
  margin-top: 10px;
  color: #ffffff;
  font-size: 20px;
  line-height: 1.05;
  font-weight: 900;
  letter-spacing: -.045em;
}

.vtdd-push-card p {
  margin-top: 8px;
  color: rgba(255,255,255,.82);
  font-size: 13px;
  line-height: 1.5;
  font-weight: 800;
}

.vtdd-push-card button {
  width: 100%;
  min-height: 42px;
  margin-top: 12px;
  border: 0;
  border-radius: 18px;
  background: #ffd400;
  color: #111827;
  font-size: 11.5px;
  font-weight: 900;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.vtdd-staff-notify-popup {
  border-radius: 28px !important;
  border: 1px solid rgba(226, 232, 240, .95) !important;
  box-shadow: 0 28px 88px rgba(15, 23, 42, .20) !important;
}

.vtdd-staff-notify-confirm {
  color: #111827 !important;
  font-weight: 1000 !important;
  border-radius: 14px !important;
  box-shadow: none !important;
}

@keyframes vtddPushSlideDown {
  from { opacity: 0; transform: translateY(-120%); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes vtddPushSlideUp {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-120%); }
}
/* STAFF ONLY - nổi bật thông báo hệ thống và tự xuống hàng */
.vtdd-system-banner-featured {
  padding: 14px !important;
  border-radius: 20px !important;
  border: 1px solid rgba(239, 68, 68, .46) !important;
  background:
    radial-gradient(circle at 100% 0%, rgba(239, 68, 68, .13), transparent 38%),
    linear-gradient(135deg, #fff5f5, #ffffff) !important;
  box-shadow: 0 14px 34px rgba(239, 68, 68, .10) !important;
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
  color: #dc2626 !important;
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
  background: #ef4444;
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


/* HERO EFFECTIVE DATE - moved from bottom to banner bottom-right */
.staff-command,
.customer-personal-hero {
  position: relative;
}

.vtdd-hero-effective-pill {
  position: absolute;
  right: clamp(18px, 2.4vw, 32px);
  bottom: clamp(14px, 1.8vw, 22px);
  z-index: 3;
  max-width: min(420px, calc(100% - 36px));
  min-height: 48px;
  padding: 0 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: rgba(255, 255, 255, .12);
  border: 1px solid rgba(255, 255, 255, .22);
  color: #ffffff;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 950;
  letter-spacing: .015em;
  box-shadow: 0 16px 36px rgba(2, 6, 23, .18), inset 0 1px 0 rgba(255, 255, 255, .12);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.vtdd-hero-effective-pill::before {
  content: "";
  width: 8px;
  height: 8px;
  margin-right: 9px;
  border-radius: 999px;
  flex: 0 0 auto;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, .16);
}

@media (max-width: 560px) {
  .vtdd-hero-effective-pill {
    left: 16px;
    right: 16px;
    bottom: 14px;
    max-width: none;
    min-height: 44px;
    padding: 0 13px;
    font-size: 11.2px;
  }
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

/* =========================================================
   IMPORTANT NOTICE V4 - nhỏ gọn, không bullet, tự xuống dòng theo Admin
========================================================= */
.vtdd-system-banner-featured.system-notice-v3 {
  padding: 12px 13px !important;
  border-radius: 22px !important;
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
  border: 1.5px solid rgba(239, 68, 68, .58) !important;
  background:
    radial-gradient(circle at 100% 0%, rgba(239, 68, 68, .12), transparent 34%),
    linear-gradient(135deg, #fff7f7, #ffffff 72%) !important;
  box-shadow: 0 12px 28px rgba(239, 68, 68, .10) !important;
}

.system-notice-v3-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.system-notice-v3-head > div {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.system-notice-v3-head span {
  margin: 0 !important;
  width: fit-content;
  padding: 6px 9px;
  border-radius: 999px;
  display: inline-flex !important;
  background: #0f172a;
  color: #ffd400 !important;
  font-size: 8.8px !important;
  line-height: 1 !important;
  font-weight: 950 !important;
  letter-spacing: .09em !important;
  text-transform: uppercase;
}

.system-notice-v3-head strong {
  padding: 6px 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: rgba(239, 68, 68, .08);
  border: 1px solid rgba(239, 68, 68, .24);
  color: #dc2626;
  font-size: 8.8px;
  line-height: 1;
  font-weight: 950;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.system-notice-v3-list {
  display: grid;
  gap: 4px;
  max-height: none;
  overflow: visible;
  padding-right: 0;
}

.system-notice-v3-list p {
  margin: 0 !important;
  padding: 5px 0 !important;
  border-radius: 0;
  position: relative;
  background: transparent;
  border: 0;
  color: #111827;
  font-size: 12.2px;
  line-height: 1.42;
  font-weight: 900;
  white-space: pre-line;
  overflow-wrap: anywhere;
  word-break: break-word;
  box-shadow: none;
}

.system-notice-v3-list p + p {
  border-top: 1px dashed rgba(239, 68, 68, .24);
}

.system-notice-v3-list p::before {
  display: none !important;
  content: none !important;
}

@media (max-width: 560px) {
  .vtdd-system-banner-featured.system-notice-v3 {
    padding: 11px 12px !important;
    border-radius: 20px !important;
  }

  .system-notice-v3-head {
    margin-bottom: 7px;
  }

  .system-notice-v3-list {
    max-height: none;
  }

  .system-notice-v3-list p {
    padding: 4px 0 !important;
    font-size: 11.8px;
    line-height: 1.38;
  }
}



/* =========================================================
   HERO EFFECTIVE DATE V5 - căn giữa, tự giãn theo browser/mobile/tablet
========================================================= */
.staff-command .vtdd-hero-effective-pill,
.customer-personal-hero .vtdd-hero-effective-pill {
  left: 50% !important;
  right: auto !important;
  bottom: clamp(12px, 1.8vw, 22px) !important;
  transform: translateX(-50%) !important;
  inline-size: fit-content;
  width: fit-content;
  min-width: min(300px, calc(100% - 28px));
  max-width: min(680px, calc(100% - clamp(28px, 6vw, 74px))) !important;
  min-height: auto;
  padding: clamp(10px, 1.25vw, 13px) clamp(13px, 2vw, 22px);
  justify-content: center;
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.28;
  border-radius: 999px;
  font-size: clamp(10.8px, 1.2vw, 12.4px);
}

.staff-command .vtdd-hero-effective-pill::before,
.customer-personal-hero .vtdd-hero-effective-pill::before {
  margin-right: clamp(7px, 1vw, 10px);
}

@media (max-width: 560px) {
  .staff-command .vtdd-hero-effective-pill,
  .customer-personal-hero .vtdd-hero-effective-pill {
    left: 50% !important;
    right: auto !important;
    bottom: 12px !important;
    transform: translateX(-50%) !important;
    width: auto;
    min-width: 0;
    max-width: calc(100% - 24px) !important;
    padding: 10px 12px;
    font-size: 10.8px;
    line-height: 1.25;
  }
}

@media (min-width: 561px) and (max-width: 1024px) {
  .staff-command .vtdd-hero-effective-pill,
  .customer-personal-hero .vtdd-hero-effective-pill {
    max-width: calc(100% - 56px) !important;
    font-size: 11.6px;
  }
}


/* =========================================================
   VTDD FINAL FIX - Mobile staff hero buttons + ngày áp dụng đúng định dạng
   - Mobile: Cập nhật thông tin nằm kế bên Đăng xuất
   - Date pill luôn 1 dòng và tự co theo màn hình
========================================================= */
.staff-command .vtdd-hero-effective-pill {
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: clip !important;
  width: max-content !important;
  min-width: 0 !important;
  max-width: calc(100% - clamp(24px, 5vw, 72px)) !important;
  padding: clamp(8px, 1.05vw, 12px) clamp(10px, 1.6vw, 18px) !important;
  font-size: clamp(9px, 1.05vw, 12px) !important;
  line-height: 1 !important;
  letter-spacing: -.02em !important;
}

@media (max-width: 640px) {
  .staff-command {
    min-height: 226px !important;
    padding: 16px 16px 60px !important;
    border-radius: 30px !important;
    display: block !important;
    position: relative !important;
    overflow: hidden !important;
  }

  .staff-command > div:first-child {
    position: relative !important;
    z-index: 4 !important;
    max-width: 100% !important;
    padding-right: 0 !important;
  }

  .staff-command .staff-kicker {
    margin: 0 !important;
    width: fit-content !important;
    max-width: calc(100% - 232px) !important;
    min-height: 32px !important;
    padding: 0 11px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 9.2px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .staff-command .staff-logout {
    position: absolute !important;
    top: 16px !important;
    right: 16px !important;
    z-index: 8 !important;
    min-height: 40px !important;
    min-width: 82px !important;
    padding: 0 14px !important;
    border-radius: 999px !important;
    font-size: 9.4px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
  }

  .staff-command .staff-hero-actions {
    position: absolute !important;
    top: 16px !important;
    right: 108px !important;
    z-index: 8 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 8px !important;
    margin: 0 !important;
  }

  .staff-command .staff-profile-trigger {
    min-height: 40px !important;
    max-width: 128px !important;
    padding: 0 11px !important;
    border-radius: 999px !important;
    font-size: 8.5px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .staff-command h1 {
    margin-top: 38px !important;
    max-width: 100% !important;
    color: #ffffff !important;
    font-size: clamp(34px, 10.5vw, 44px) !important;
    line-height: .88 !important;
    letter-spacing: -.078em !important;
    white-space: normal !important;
    text-wrap: balance !important;
  }

  .staff-command p {
    margin-top: 8px !important;
    max-width: calc(100% - 10px) !important;
    color: rgba(255, 255, 255, .78) !important;
    font-size: 11px !important;
    line-height: 1.35 !important;
    font-weight: 900 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .staff-command .vtdd-hero-effective-pill {
    left: 50% !important;
    right: auto !important;
    bottom: 12px !important;
    transform: translateX(-50%) !important;
    width: max-content !important;
    max-width: calc(100% - 18px) !important;
    min-height: 34px !important;
    padding: 0 8px !important;
    border-radius: 999px !important;
    font-size: clamp(7.35px, 1.95vw, 9.2px) !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: clip !important;
    letter-spacing: -.045em !important;
  }

  .staff-command .vtdd-hero-effective-pill::before {
    width: 7px !important;
    height: 7px !important;
    margin-right: 6px !important;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, .16) !important;
  }
}

@media (max-width: 380px) {
  .staff-command {
    min-height: 232px !important;
    padding-left: 13px !important;
    padding-right: 13px !important;
  }

  .staff-command .staff-kicker {
    max-width: calc(100% - 218px) !important;
    font-size: 8.5px !important;
  }

  .staff-command .staff-logout {
    right: 13px !important;
    min-width: 76px !important;
    padding: 0 12px !important;
    font-size: 8.6px !important;
  }

  .staff-command .staff-hero-actions {
    right: 96px !important;
  }

  .staff-command .staff-profile-trigger {
    max-width: 112px !important;
    padding: 0 9px !important;
    font-size: 7.75px !important;
  }

  .staff-command h1 {
    margin-top: 40px !important;
    font-size: clamp(31px, 9.7vw, 39px) !important;
  }

  .staff-command .vtdd-hero-effective-pill {
    max-width: calc(100% - 14px) !important;
    font-size: clamp(6.75px, 1.83vw, 8px) !important;
    padding: 0 6px !important;
  }
}


/* =========================================================
   VTDD DATE EXACT ADMIN SETUP - luôn hiển thị đúng giá trị Admin setup
   - Text có / hoặc - giữ nguyên
   - Google Sheets serial tự đổi về ngày thật
   - Pill luôn 1 dòng, tự co theo mobile/tablet/desktop
========================================================= */
.staff-command .vtdd-hero-effective-pill,
.customer-personal-hero .vtdd-hero-effective-pill {
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: clip !important;
  width: max-content !important;
  min-width: 0 !important;
  max-width: calc(100% - clamp(18px, 5vw, 72px)) !important;
  padding-left: clamp(8px, 1.4vw, 16px) !important;
  padding-right: clamp(8px, 1.4vw, 16px) !important;
  font-size: clamp(7.2px, 1.55vw, 12px) !important;
  line-height: 1 !important;
}

@media (max-width: 420px) {
  .staff-command .vtdd-hero-effective-pill,
  .customer-personal-hero .vtdd-hero-effective-pill {
    max-width: calc(100% - 12px) !important;
    padding-left: 6px !important;
    padding-right: 6px !important;
    font-size: clamp(6.6px, 1.82vw, 8.1px) !important;
    letter-spacing: -.055em !important;
  }

  .staff-command .vtdd-hero-effective-pill::before,
  .customer-personal-hero .vtdd-hero-effective-pill::before {
    width: 6px !important;
    height: 6px !important;
    margin-right: 5px !important;
  }
}



/* =========================================================
   VTDD FIX - Effective date displays raw Admin text, bigger, no-wrap responsive
========================================================= */
.staff-command .vtdd-hero-effective-pill,
.customer-personal-hero .vtdd-hero-effective-pill,
.vtdd-hero-effective-pill {
  width: auto !important;
  inline-size: auto !important;
  min-width: 0 !important;
  max-width: calc(100% - 28px) !important;
  padding: clamp(9px, 1.3vw, 13px) clamp(14px, 2vw, 24px) !important;
  font-size: clamp(12px, 1.28vw, 15px) !important;
  line-height: 1 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

.staff-command .vtdd-hero-effective-pill::before,
.customer-personal-hero .vtdd-hero-effective-pill::before,
.vtdd-hero-effective-pill::before {
  flex: 0 0 auto !important;
}

@media (max-width: 430px) {
  .staff-command .vtdd-hero-effective-pill,
  .customer-personal-hero .vtdd-hero-effective-pill,
  .vtdd-hero-effective-pill {
    max-width: calc(100% - 34px) !important;
    padding: 9px 12px !important;
    font-size: clamp(10.4px, 2.75vw, 12px) !important;
  }
}


/* =========================================================
   VTDD FIX - Important notice rich HTML from TinyMCE
========================================================= */
.system-notice-v3-rich {
  max-height: none;
  overflow: visible;
  padding-right: 0;
}

.system-notice-v3-rich :where(p, div, span, strong, b, em, i, u, li, a) {
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.system-notice-v3-rich span {
  display: inline !important;
  margin: 0 !important;
  font-size: inherit !important;
  line-height: inherit !important;
  font-weight: inherit;
  letter-spacing: 0 !important;
  text-transform: none !important;
}

.system-notice-v3-rich span:not([style]) {
  color: inherit !important;
}

.system-notice-v3-rich :where(strong, b) {
  display: inline !important;
  color: inherit;
  font-size: inherit;
  line-height: inherit;
}

.system-notice-v3-rich p {
  margin: 0 0 7px !important;
  padding: 0 !important;
  border: 0 !important;
  color: inherit;
  font-size: 12.4px;
  line-height: 1.45;
  font-weight: inherit;
  white-space: normal;
}

.system-notice-v3-rich :where(strong, b) {
  font-weight: 1000;
}

.system-notice-v3-rich :where(div, span) {
  line-height: 1.45;
}

.system-notice-v3-rich p:last-child {
  margin-bottom: 0 !important;
}

.system-notice-v3-rich ul,
.system-notice-v3-rich ol {
  margin: 6px 0 8px 18px;
  padding: 0;
}

.system-notice-v3-rich li {
  margin: 4px 0;
  font-size: 12.4px;
  line-height: 1.45;
}

.system-notice-v3-rich img,
.system-notice-v3-rich table,
.system-notice-v3-rich iframe {
  max-width: 100% !important;
}

/* =========================================================
   VTDD STAFF HERO MWG LOGO + EFFECTIVE TEXT FIX
========================================================= */
.staff-command .staff-logo-mwg {
  width: fit-content;
  min-height: 40px;
  padding: 0 14px 0 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  background: rgba(255, 255, 255, .10);
  border: 1px solid rgba(255, 255, 255, .20);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.13), 0 12px 28px rgba(0,0,0,.18);
  color: #ffffff;
  font-size: 12px;
  line-height: 1;
  font-weight: 950;
  letter-spacing: .02em;
  text-transform: uppercase;
  white-space: nowrap;
}

.staff-command .staff-logo-mwg-icon {
  width: 28px;
  height: 28px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: #ffd400;
  color: #0f172a;
  font-size: 9px;
  font-weight: 950;
  letter-spacing: -.08em;
  background-image: url("/mwg-logo.svg");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 78% 78%;
  box-shadow: 0 0 0 4px rgba(255, 212, 0, .13);
}

.staff-command .vtdd-hero-effective-pill,
.customer-personal-hero .vtdd-hero-effective-pill {
  font-size: clamp(11.2px, 1.2vw, 13.6px) !important;
  min-height: 40px !important;
  padding: 0 clamp(13px, 1.7vw, 20px) !important;
  line-height: 1 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  letter-spacing: -.018em !important;
}

@media (max-width: 640px) {
  .staff-command .staff-logo-mwg {
    position: relative !important;
    z-index: 9 !important;
    min-height: 36px !important;
    padding: 0 10px 0 7px !important;
    gap: 7px !important;
    font-size: 10px !important;
  }

  .staff-command .staff-logo-mwg-icon {
    width: 25px !important;
    height: 25px !important;
    border-radius: 10px !important;
    font-size: 8px !important;
  }

  .staff-command .vtdd-hero-effective-pill,
  .customer-personal-hero .vtdd-hero-effective-pill {
    max-width: calc(100% - 22px) !important;
    min-height: 36px !important;
    padding: 0 10px !important;
    font-size: clamp(9.8px, 2.45vw, 11.2px) !important;
    letter-spacing: -.035em !important;
  }

  .staff-command .vtdd-hero-effective-pill::before,
  .customer-personal-hero .vtdd-hero-effective-pill::before {
    width: 8px !important;
    height: 8px !important;
    margin-right: 7px !important;
  }
}

@media (max-width: 380px) {
  .staff-command .staff-logo-mwg {
    font-size: 9px !important;
    padding-right: 8px !important;
  }

  .staff-command .vtdd-hero-effective-pill,
  .customer-personal-hero .vtdd-hero-effective-pill {
    font-size: clamp(8.9px, 2.35vw, 10px) !important;
    max-width: calc(100% - 14px) !important;
    padding: 0 8px !important;
  }
}

@media (max-width: 640px) {
  .staff-command .vtdd-hero-effective-pill {
    width: 100% !important;
    max-width: 100% !important;
    justify-content: center !important;
    white-space: normal !important;
    overflow: visible !important;
    text-overflow: clip !important;
    line-height: 1.22 !important;
    text-align: center !important;
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

function cleanEffectiveText(value: any) {
  return String(value ?? "")
    .replace(/^'/, "")
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getEffectiveRange(notify: NotifySettings) {
  const from = cleanEffectiveText(notify.priceEffectiveFrom);
  const to = cleanEffectiveText(notify.priceEffectiveTo);

  if (from && to) return `Thời gian áp dụng: ${from} - ${to}`;
  if (from) return `Thời gian áp dụng: ${from}`;
  if (to) return `Thời gian áp dụng: ${to}`;
  return "";
}

function formatSystemMessageLines(message: string) {
  const raw = String(message || "")
    .replace(/\r/g, "")
    // Giữ đúng nội dung Admin nhập. Nếu Admin xuống dòng thì web xuống dòng theo.
    // Nếu Admin nhập liền dòng, hệ thống tự tách trước A/, B/, 1/, 2/ để dễ đọc.
    .replace(/\s+(?=[A-Za-zÀ-ỹ]\s*\/\s*)/g, "\n")
    .replace(/\s+(?=\d+\s*\/\s*)/g, "\n")
    .trim();

  if (!raw) return [];

  return raw
    .split(/\n+/)
    .map((line) =>
      line
        .trim()
        // Bỏ các dấu bullet/chấm đầu dòng do Admin hoặc text copy từ nguồn khác.
        .replace(/^[•▪▫●◆◇*·]\s*/g, "")
        .replace(/^-\s+/g, "")
        .trim()
    )
    .filter(Boolean);
}



function escapeSystemNoticeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getImportantNoticeHtml(message: string) {
  const raw = String(message || "").trim();
  if (!raw) return "";

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
  if (looksLikeHtml) return sanitizeHtml(raw);

  const lines = formatSystemMessageLines(raw);
  if (lines.length === 0) return "";

  return sanitizeHtml(lines.map((line) => `<p>${escapeSystemNoticeHtml(line)}</p>`).join(""));
}

const QUOTE_TOOLS_CSS = `
.vtdd-data-reload-layer {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(15, 23, 42, .42);
  backdrop-filter: blur(10px);
}
.vtdd-data-reload-card {
  width: min(100%, 430px);
  padding: 18px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 24px 70px rgba(15, 23, 42, .22);
  display: grid;
  gap: 10px;
}
.vtdd-data-reload-card span {
  color: #2563eb;
  font-size: 11px;
  font-weight: 1000;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.vtdd-data-reload-card h2 {
  margin: 0;
  color: #0f172a;
  font-size: 22px;
  line-height: 1.1;
  font-weight: 1000;
}
.vtdd-data-reload-card p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 750;
}
.vtdd-data-reload-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 6px;
}
.vtdd-data-reload-actions button {
  min-height: 42px;
  border: 0;
  border-radius: 12px;
  background: #0f172a;
  color: #fff;
  font-size: 12px;
  font-weight: 1000;
  cursor: pointer;
}
.vtdd-data-reload-actions button:first-child {
  background: #ffd400;
  color: #111827;
}
.vtdd-data-reload-countdown {
  margin-top: 2px;
  padding: 9px 10px;
  border-radius: 12px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 900;
  text-align: center;
}
.quote-history-card {
  margin-top: 12px;
  padding: 14px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 14px 30px rgba(15, 23, 42, .06);
}
.quote-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.quote-history-head b {
  color: #0f172a;
  font-size: 13px;
  font-weight: 1000;
}
.quote-history-head button,
.quote-history-item button {
  min-height: 32px;
  border: 0;
  border-radius: 10px;
  padding: 0 10px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 11px;
  font-weight: 950;
  cursor: pointer;
}
.quote-history-list {
  display: grid;
  gap: 8px;
  max-height: 360px;
  overflow: auto;
  padding-right: 2px;
}
.quote-history-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.quote-history-item b {
  display: block;
  color: #0f172a;
  font-size: 12px;
  line-height: 1.25;
  font-weight: 1000;
}
.quote-history-item span {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 10.5px;
  line-height: 1.35;
  font-weight: 800;
}
.quote-history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 7px;
}
.quote-history-meta em {
  width: fit-content;
  padding: 4px 7px;
  border-radius: 999px;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  color: #334155;
  font-size: 9.5px;
  line-height: 1;
  font-style: normal;
  font-weight: 900;
}
.quote-history-empty {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
  font-weight: 800;
}
.result-btn-image,
.result-btn-pdf {
  background: #0f172a;
  color: #fff;
}
.result-explain-card {
  display: grid;
  gap: 8px;
  background: #fffaf0 !important;
  border: 1px solid rgba(255, 212, 0, .48) !important;
  box-shadow: 0 12px 26px rgba(255, 212, 0, .10) !important;
}
.result-explain-title {
  margin-bottom: 2px;
  color: #07111f !important;
  font-size: 12px;
  font-weight: 1000;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.result-explain-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  padding: 9px 0;
  border-top: 1px solid rgba(15, 23, 42, .10);
}
.result-explain-row span {
  display: block;
  color: #07111f !important;
  font-size: 12px;
  font-weight: 1000;
}
.result-explain-row small {
  display: block;
  margin-top: 3px;
  color: #334155 !important;
  font-size: 11px;
  line-height: 1.35;
  font-weight: 800;
}
.result-explain-row b {
  color: #07111f !important;
  font-size: 12px;
  font-weight: 1000;
  white-space: nowrap;
}
@media (max-width: 760px) {
  .vtdd-data-reload-actions,
  .quote-history-item {
    grid-template-columns: 1fr;
  }
  .result-explain-row {
    grid-template-columns: 1fr;
  }
}
`;

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

function makeNotifySettings(data: any): NotifySettings {
  return {
    marquee: data?.marquee || "",
    fixedBanner: data?.fixedBanner || "",
    pushMessage: data?.pushMessage || "",
    pushVersion: data?.pushVersion || "",
    staffPopupTradeinEnabled: data?.staffPopupTradeinEnabled || "0",
    staffPopupTradeinMessage: data?.staffPopupTradeinMessage || "",
    staffPopupTradeinSeconds: data?.staffPopupTradeinSeconds || "10",
    staffPopupTradeinVersion: data?.staffPopupTradeinVersion || "",
    staffPopupBuyonlyEnabled: data?.staffPopupBuyonlyEnabled || "0",
    staffPopupBuyonlyMessage: data?.staffPopupBuyonlyMessage || "",
    staffPopupBuyonlySeconds: data?.staffPopupBuyonlySeconds || "10",
    staffPopupBuyonlyVersion: data?.staffPopupBuyonlyVersion || "",
    priceEffectiveFrom: data?.priceEffectiveFrom || "",
    priceEffectiveTo: data?.priceEffectiveTo || "",
  };
}

function isEnabledFlag(value: any) {
  const v = String(value || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function popupAutoCloseMs(value: any) {
  const n = Number(String(value || "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 10000;
  return n > 600 ? n : n * 1000;
}

function readStaffPriceCache(): StaffPriceCache | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STAFF_PRICE_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StaffPriceCache;
    if (!parsed?.dataVersion || !parsed?.data) return null;
    if (!Array.isArray(parsed.data.moi) || !Array.isArray(parsed.data.cu) || !Array.isArray(parsed.data.tablet)) return null;
    if (Date.now() - Number(parsed.savedAt || 0) > STAFF_PRICE_CACHE_MAX_AGE_MS) return null;

    return parsed;
  } catch {
    return null;
  }
}

function saveStaffPriceCache(cache: StaffPriceCache) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STAFF_PRICE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Cache chi de tang toc lan tai sau, loi dung luong localStorage khong anh huong luong chinh.
  }
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
  const shownStaffPopupKeysRef = useRef<Set<string>>(new Set());

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
  const [quoteHistory, setQuoteHistory] = useState<QuoteHistoryItem[]>([]);
  const [quoteHistoryLoading, setQuoteHistoryLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState("");
  const [newDataVersion, setNewDataVersion] = useState("");
  const [showDataReload, setShowDataReload] = useState(false);
  const [reloadCountdown, setReloadCountdown] = useState(5);
  const [lockClockTick, setLockClockTick] = useState(() => Date.now());

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
    const cached = readStaffPriceCache();
    let hadUsableCache = false;

    if (cached) {
      hadUsableCache = true;
      setDataMoi(cached.data.moi || []);
      setDataCu(cached.data.cu || []);
      setDataTablet(cached.data.tablet || []);
      setDataVersion(String(cached.dataVersion || cached.data.system?.DATA_VERSION || "1"));
      setSystemSettings(cached.data.system || {});
      setNotifySettings(makeNotifySettings(cached.data.notify));
      setLoading(false);
    }

    async function load() {
      try {
        const res = await fetch("/api/data/super-fast", { cache: "no-store" });
        const json = await res.json();

        if (!json.success) {
          if (!hadUsableCache) {
            setLoadMsg(json.message || "Không tải được dữ liệu.");
          }
          setLoading(false);
          return;
        }

        const nextNotify = makeNotifySettings(json.data.notify);
        const nextVersion = String(json.dataVersion || json.data?.system?.DATA_VERSION || "1");

        setDataMoi(json.data.moi || []);
        setDataCu(json.data.cu || []);
        setDataTablet(json.data.tablet || []);
        setDataVersion(nextVersion);
        setSystemSettings(json.data.system || {});
        setNotifySettings(nextNotify);
        saveStaffPriceCache({
          dataVersion: nextVersion,
          savedAt: Date.now(),
          data: {
            moi: json.data.moi || [],
            cu: json.data.cu || [],
            tablet: json.data.tablet || [],
            system: json.data.system || {},
            notify: nextNotify,
          },
        });
        setLoading(false);
      } catch {
        if (!hadUsableCache) {
          setLoadMsg("Lỗi kết nối dữ liệu.");
        }
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    loadQuoteHistory({ silent: true });
  }, []);

  useEffect(() => {
    if (!dataVersion) return;

    let stopped = false;

    async function checkDataVersion() {
      try {
        const res = await fetch("/api/data/version", {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });
        const json = await res.json().catch(() => null);
        const nextVersion = String(json?.dataVersion || "");

        if (!stopped && json?.system) {
          setSystemSettings(json.system || {});
        }

        if (!stopped && json?.notify) {
          setNotifySettings(makeNotifySettings(json.notify));
        }

        if (!stopped && nextVersion && nextVersion !== dataVersion) {
          setNewDataVersion(nextVersion);
          setShowDataReload(true);
        }
      } catch {
        // Không làm phiền nhân viên nếu kiểm tra version lỗi tạm thời.
      }
    }

    checkDataVersion();

    const timer = window.setInterval(checkDataVersion, 5000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [dataVersion]);

  useEffect(() => {
    if (!showDataReload) return;

    setReloadCountdown(5);

    const timer = window.setInterval(() => {
      setReloadCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          window.location.reload();
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [showDataReload, newDataVersion]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLockClockTick(Date.now());
    }, 15000);

    return () => window.clearInterval(timer);
  }, []);

  async function loadQuoteHistory(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) setQuoteHistoryLoading(true);

      const res = await fetch("/api/staff/quote-history?limit=20", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        setQuoteHistory(data.history || []);
      }

      setQuoteHistoryLoading(false);
    } catch {
      setQuoteHistoryLoading(false);
    }
  }

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

    const activeSystemLock = getActiveSystemLock(systemSettings, new Date(lockClockTick));
    const systemLocked = activeSystemLock.active;
    const staffPageLocked = settingEnabled(systemSettings, "STAFF_PAGE_LOCKED");
    const staffTradeinLocked = settingEnabled(systemSettings, "STAFF_TRADEIN_LOCKED");
    const staffBuyonlyLocked = settingEnabled(systemSettings, "STAFF_BUYONLY_LOCKED");
    const currentStaffTabLocked = mode === "tradein" ? staffTradeinLocked : staffBuyonlyLocked;
    const staffAccessLocked = systemLocked || staffPageLocked;

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
    if (!showSystemPush || !notifySettings.pushMessage) return;

    const timer = window.setTimeout(() => {
      const version = notifySettings.pushVersion || notifySettings.pushMessage;

      if (version) {
        window.localStorage.setItem(`vtdd_staff_push_seen_${version}`, "1");
      }

      setShowSystemPush(false);
    }, 30000);

    return () => window.clearTimeout(timer);
  }, [showSystemPush, notifySettings.pushMessage, notifySettings.pushVersion]);

  useEffect(() => {
    if (staffAccessLocked || currentStaffTabLocked) return;

    const isTradein = mode === "tradein";
    const enabled = isTradein
      ? notifySettings.staffPopupTradeinEnabled
      : notifySettings.staffPopupBuyonlyEnabled;
    const message = String(
      isTradein ? notifySettings.staffPopupTradeinMessage : notifySettings.staffPopupBuyonlyMessage
    ).trim();

    if (!isEnabledFlag(enabled) || !message) return;

    const seconds = isTradein
      ? notifySettings.staffPopupTradeinSeconds
      : notifySettings.staffPopupBuyonlySeconds;
    const version =
      (isTradein ? notifySettings.staffPopupTradeinVersion : notifySettings.staffPopupBuyonlyVersion) ||
      `${mode}:${message}:${seconds}`;
    const popupKey = `${mode}:${version}`;

    if (shownStaffPopupKeysRef.current.has(popupKey)) return;
    shownStaffPopupKeysRef.current.add(popupKey);

    void Swal.fire({
      title: isTradein ? "Thông báo Thu Cũ Đổi Mới" : "Thông báo Thu Cũ Không Đổi Mới",
      text: message,
      icon: "info",
      confirmButtonText: "Đồng ý",
      confirmButtonColor: "#ffd400",
      color: "#0f172a",
      timer: popupAutoCloseMs(seconds),
      timerProgressBar: true,
      allowOutsideClick: true,
      customClass: {
        popup: "vtdd-staff-notify-popup",
        confirmButton: "vtdd-staff-notify-confirm",
      },
    });
  }, [
    mode,
    staffAccessLocked,
    currentStaffTabLocked,
    notifySettings.staffPopupTradeinEnabled,
    notifySettings.staffPopupTradeinMessage,
    notifySettings.staffPopupTradeinSeconds,
    notifySettings.staffPopupTradeinVersion,
    notifySettings.staffPopupBuyonlyEnabled,
    notifySettings.staffPopupBuyonlyMessage,
    notifySettings.staffPopupBuyonlySeconds,
    notifySettings.staffPopupBuyonlyVersion,
  ]);

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

  function getPriceExplanationRows() {
    const type = TYPE_OPTIONS.find((item) => item.value === loai);
    const rate = priceInfo.tiLe > 0 ? `${Math.round(priceInfo.tiLe * 100)}%` : "0%";

    return [
      {
        label: "Giá xác máy cũ",
        value: formatMoney(priceInfo.giaXac),
        note: type ? `Lấy theo ${type.label} trong bảng máy cũ.` : "Chưa chọn loại máy.",
      },
      {
        label: "Hỗ trợ lên đời",
        value: mode === "tradein" ? formatMoney(priceInfo.troGiaHang) : "0 đ",
        note:
          mode === "tradein"
            ? `Tính theo tỷ lệ ${rate}, có áp dụng mức min/max của máy mới.`
            : "Luồng thu cũ không đổi mới không có hỗ trợ lên đời.",
      },
      {
        label: "Ưu đãi MWG",
        value: formatMoney(priceInfo.troGiaMWG),
        note: priceInfo.troGiaMWG > 0 ? "Chỉ áp dụng theo dòng dữ liệu Loại 1/Loại 2." : "Không có ưu đãi MWG phù hợp.",
      },
      {
        label: "Tổng khách nhận",
        value: formatMoney(priceInfo.tongTien),
        note: "Giá xác + hỗ trợ lên đời + ưu đãi MWG.",
      },
      ...(mode === "tradein" && priceInfo.giaBanMoi > 0
        ? [
            {
              label: "Khách cần bù",
              value: formatMoney(priceInfo.khachCanBu),
              note: "Giá máy mới trừ tổng tiền khách nhận, không âm.",
            },
          ]
        : []),
    ];
  }

  function escapeHtml(value: string) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getQuoteSnapshot() {
    return {
      title: mode === "tradein" ? "BÁO GIÁ THU CŨ ĐỔI MỚI" : "BÁO GIÁ THU CŨ",
      spMoi: mode === "tradein" ? spMoi || "Chưa chọn" : "Thu cũ không đổi mới",
      spCu: spCu ? `${spCu}${memory ? " - " + memory : ""}` : "Chưa chọn",
      loai: loai ? `Loại ${loai}` : "Chưa chọn",
      staff: `${staffName || "Nhân viên"} - NV ${maNV} - ST ${maST}`,
      time: quoteTime || getQuoteTime(),
      rows: [
        ["Giá máy cũ", formatMoney(priceInfo.giaXac)],
        ["Hỗ trợ lên đời", mode === "tradein" ? formatMoney(priceInfo.troGiaHang) : "0 đ"],
        ["Ưu đãi MWG", formatMoney(priceInfo.troGiaMWG)],
        ...(mode === "tradein" && priceInfo.giaBanMoi > 0
          ? [["Giá bán máy mới", formatMoney(priceInfo.giaBanMoi)]]
          : []),
        ["Tổng tiền khách nhận", formatMoney(priceInfo.tongTien)],
        ...(mode === "tradein" && priceInfo.giaBanMoi > 0
          ? [["Khách cần bù", formatMoney(priceInfo.khachCanBu)]]
          : []),
      ],
    };
  }

  function drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) {
    const words = String(text || "").split(/\s+/);
    let line = "";
    let currentY = y;

    words.forEach((word) => {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, currentY);
        line = word;
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    });

    if (line) ctx.fillText(line, x, currentY);
    return currentY + lineHeight;
  }

  function drawRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    const r = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function renderQuoteCanvas() {
    const snapshot = getQuoteSnapshot();
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1500;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Trình duyệt không hỗ trợ xuất ảnh.");
    }

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffd400";
    ctx.fillRect(0, 0, canvas.width, 18);

    ctx.fillStyle = "#0f172a";
    ctx.font = "900 46px Roboto";
    ctx.fillText("Viễn Thông Di Động", 70, 95);
    ctx.font = "800 24px Roboto";
    ctx.fillStyle = "#64748b";
    ctx.fillText(snapshot.title, 70, 132);

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    drawRoundRect(ctx, 60, 180, 1080, 1110, 34);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#111827";
    ctx.font = "900 34px Roboto";
    ctx.fillText("TỔNG TIỀN KHÁCH NHẬN", 100, 250);
    ctx.fillStyle = "#dc2626";
    ctx.font = "900 78px Roboto";
    ctx.fillText(formatMoney(priceInfo.tongTien), 100, 345);

    ctx.fillStyle = "#64748b";
    ctx.font = "700 22px Roboto";
    ctx.fillText(`Cập nhật: ${snapshot.time}`, 100, 395);

    let y = 470;
    const metaRows = [
      ["Máy mới", snapshot.spMoi],
      ["Máy cũ", snapshot.spCu],
      ["Loại máy", snapshot.loai],
      ["Nhân viên", snapshot.staff],
    ];

    metaRows.forEach(([label, value]) => {
      ctx.fillStyle = "#64748b";
      ctx.font = "800 21px Roboto";
      ctx.fillText(label.toUpperCase(), 100, y);
      ctx.fillStyle = "#0f172a";
      ctx.font = "900 27px Roboto";
      y = drawWrappedText(ctx, value, 100, y + 38, 980, 34) + 18;
    });

    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(100, y + 10);
    ctx.lineTo(1100, y + 10);
    ctx.stroke();
    y += 70;

    snapshot.rows.forEach(([label, value], index) => {
      const isTotal = index >= snapshot.rows.length - (priceInfo.khachCanBu > 0 ? 2 : 1);
      ctx.fillStyle = isTotal ? "#0f172a" : "#334155";
      ctx.font = isTotal ? "900 30px Roboto" : "800 25px Roboto";
      ctx.fillText(label, 100, y);
      ctx.textAlign = "right";
      ctx.fillStyle = isTotal ? "#dc2626" : "#0f172a";
      ctx.font = isTotal ? "900 34px Roboto" : "900 27px Roboto";
      ctx.fillText(value, 1100, y);
      ctx.textAlign = "left";
      y += 62;
    });

    ctx.fillStyle = "#64748b";
    ctx.font = "700 20px Roboto";
    drawWrappedText(
      ctx,
      "Lưu ý: Giá tham khảo tại thời điểm tra cứu. Kết quả cuối cùng phụ thuộc tình trạng máy thực tế khi kiểm tra tại siêu thị.",
      100,
      1210,
      980,
      28
    );

    return canvas;
  }

  async function downloadQuoteImage() {
    if (!validateQuoteReady()) return;

    try {
      const canvas = renderQuoteCanvas();
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((item) => {
          if (item) resolve(item);
          else reject(new Error("Không tạo được ảnh báo giá."));
        }, "image/png", 0.96);
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bao-gia-${maNV}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      await showSwal("success", "Đã tải ảnh báo giá", "Có thể gửi ảnh này qua Zalo hoặc ứng dụng chat.", 1600);
    } catch (err: any) {
      await showSwal("error", "Không xuất được ảnh", err?.message || "Vui lòng thử lại.", 0);
    }
  }

  function printQuotePdf() {
    if (!validateQuoteReady()) return;

    const snapshot = getQuoteSnapshot();
    const rows = snapshot.rows
      .map(
        ([label, value]) =>
          `<div class="row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(snapshot.title)}</title><style>
      body{margin:0;background:#f8fafc;font-family:Roboto,Arial,sans-serif;color:#0f172a}
      main{width:760px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:32px}
      h1{margin:0;color:#0f172a;font-size:30px} .brand{color:#64748b;font-weight:900;margin-bottom:18px}
      .total{margin:18px 0 8px;color:#dc2626;font-size:48px;font-weight:1000}.time{color:#64748b;font-weight:800}
      .meta{margin:24px 0;padding:18px;border-radius:16px;background:#f8fafc;display:grid;gap:12px}
      .meta div,.row{display:flex;justify-content:space-between;gap:18px;border-bottom:1px solid #e2e8f0;padding-bottom:10px}
      .row{font-size:18px}.row b{color:#0f172a}.note{margin-top:20px;color:#64748b;line-height:1.5;font-weight:700}
      @media print{body{background:#fff}main{width:auto;margin:0;border:0;border-radius:0}}
    </style></head><body><main>
      <div class="brand">Viễn Thông Di Động</div>
      <h1>${escapeHtml(snapshot.title)}</h1>
      <div class="total">${escapeHtml(formatMoney(priceInfo.tongTien))}</div>
      <div class="time">Cập nhật: ${escapeHtml(snapshot.time)}</div>
      <section class="meta">
        <div><span>Máy mới</span><b>${escapeHtml(snapshot.spMoi)}</b></div>
        <div><span>Máy cũ</span><b>${escapeHtml(snapshot.spCu)}</b></div>
        <div><span>Loại máy</span><b>${escapeHtml(snapshot.loai)}</b></div>
        <div><span>Nhân viên</span><b>${escapeHtml(snapshot.staff)}</b></div>
      </section>
      <section>${rows}</section>
      <p class="note">Lưu ý: Giá tham khảo tại thời điểm tra cứu. Kết quả cuối cùng phụ thuộc tình trạng máy thực tế khi kiểm tra tại siêu thị.</p>
    </main><script>window.onload=function(){window.print();}</script></body></html>`;

    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) {
      showSwal("warning", "Trình duyệt đang chặn popup", "Vui lòng cho phép popup để mở bản in PDF.", 0);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  function applyHistoryItem(item: QuoteHistoryItem) {
    const isBuyOnly = String(item.mode || "").toLowerCase().includes("không");
    const nextMode = isBuyOnly ? "buyonly" : "tradein";
    const newRow = dataMoi.find((row) => String(row[1] || "").trim() === item.spMoi);

    setMode(nextMode);
    setHang(nextMode === "tradein" ? String(newRow?.[0] || "") : "");
    setSpMoi(nextMode === "tradein" ? item.spMoi || "" : "");
    setGiaBanMoiInput("");
    setSpCu(item.spCu || "");
    setLoai(item.loai || "");
    setQuoteTime(item.time || getQuoteTime());
    setShowQuote(true);
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

function getClientDeviceMeta() {
  const nav = navigator as Navigator & {
    connection?: { type?: string; effectiveType?: string };
    mozConnection?: { type?: string; effectiveType?: string };
    webkitConnection?: { type?: string; effectiveType?: string };
  };
  const ua = nav.userAgent || "";
  const uaLower = ua.toLowerCase();
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  const type = String(connection?.type || "").toLowerCase();
  const effectiveType = String(connection?.effectiveType || "").toLowerCase();

  let clientDevice = "Không rõ";
  if (uaLower.includes("iphone")) clientDevice = "iPhone";
  else if (uaLower.includes("ipad")) clientDevice = "iPad";
  else if (uaLower.includes("android")) clientDevice = "Android";
  else if (uaLower.includes("windows") || uaLower.includes("macintosh") || uaLower.includes("linux")) clientDevice = "Máy tính";

  let networkType = "Không rõ";
  if (type.includes("wifi") || type.includes("ethernet")) networkType = "WiFi";
  else if (type.includes("cell")) networkType = effectiveType ? effectiveType.toUpperCase() : "4G/5G";
  else if (effectiveType.includes("5g")) networkType = "5G";
  else if (effectiveType.includes("4g")) networkType = "4G";
  else if (effectiveType.includes("3g")) networkType = "3G";
  else if (effectiveType.includes("2g")) networkType = "2G";

  return { clientDevice, networkType };
}

    async function sendQuoteLog(action: "TRA_GIA" | "COPY" | "SHARE" | "CUSTOMER_VIEW") {
  try {
    const clientMeta = getClientDeviceMeta();
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
        clientDevice: clientMeta.clientDevice,
        networkType: clientMeta.networkType,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      console.error("SEND_LOG_FAILED:", data?.message || res.statusText);
    } else {
      loadQuoteHistory({ silent: true });
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

  if (profileChangePassword) {
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
        changePassword: profileChangePassword,
        newPassword: profileChangePassword ? profileNewPassword : "",
        confirmPassword: profileChangePassword ? profileConfirmPassword : "",
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

  const passwordModeText = profileChangePassword
    ? "Đang bật đổi mật khẩu"
    : "Đang giữ mật khẩu hiện tại";

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
                ? "Xác thực mật khẩu hiện tại và thêm thông tin khôi phục trước khi sử dụng hệ thống."
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
            <div className={profileChangePassword ? "done" : ""}>
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
                placeholder={isSetup ? "Nhập mật khẩu của bạn" : "Nhập mật khẩu hiện tại"}
              />
            </div>
          </section>

          <section className="profile-v5-block profile-v5-password-block">
            <label className="profile-v5-switch">
              <input
                type="checkbox"
                checked={profileChangePassword}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setProfileChangePassword(checked);
                  if (!checked) {
                    setProfileNewPassword("");
                    setProfileConfirmPassword("");
                  }
                }}
              />
              <span></span>
              <div>
                <b>Đổi mật khẩu đăng nhập</b>
                <em>
                  {isSetup
                    ? "Mặc định bật trong lần thiết lập đầu tiên."
                    : "Bật nếu muốn thay đổi mật khẩu đăng nhập hiện tại."}
                </em>
              </div>
            </label>

            {profileChangePassword && (
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
  return (
    <>
      <style>{SYSTEM_UI_CSS}</style>
      <style>{QUOTE_TOOLS_CSS}</style>
    </>
  );
}

function renderSystemNotices() {
  const importantNoticeHtml = getImportantNoticeHtml(notifySettings.fixedBanner || "");

  return (
    <>
      {notifySettings.marquee ? (
        <div className="vtdd-system-marquee">
          <span>{notifySettings.marquee}</span>
        </div>
      ) : null}

      {importantNoticeHtml ? (
        <section className="vtdd-system-banner vtdd-system-banner-featured system-notice-v3" aria-label="Thông báo hệ thống">
          <div className="system-notice-v3-head">
            <div>
              <span>Thông báo hệ thống</span>
              <strong>Quan trọng</strong>
            </div>
          </div>

          <div
            className="system-notice-v3-list system-notice-v3-rich"
            dangerouslySetInnerHTML={{ __html: importantNoticeHtml }}
          />
        </section>
      ) : null}

    </>
  );
}

function renderHeroEffectivePill() {
  const effectiveRange = getEffectiveRange(notifySettings);

  if (!effectiveRange) return null;

  return <div className="vtdd-hero-effective-pill">{effectiveRange}</div>;
}

function renderPushNotify() {
  if (!showSystemPush || !notifySettings.pushMessage) return null;

  return (
    <section className="vtdd-push-layer" role="status" aria-live="polite">
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
  const message = activeSystemLock.active
    ? activeSystemLock.message
    : getSystemText(systemSettings, "SYSTEM_LOCK_MESSAGE") || "HỆ THỐNG ĐANG CẬP NHẬT KHẨN.";

  return (
    <main className="vtdd-lock-page">
      {renderSystemStyle()}
      <section className="vtdd-lock-card">
        <div className="vtdd-lock-icon">!</div>
        <span>Tạm khóa truy cập</span>
        <h1>{activeSystemLock.scheduled ? "Hệ thống đang bảo trì" : "Hệ thống đang cập nhật"}</h1>
        <p>{message}</p>
        {activeSystemLock.detail ? <p>{activeSystemLock.detail}</p> : null}
        <Link href="/">Quay về trang chủ</Link>
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
            <div className="staff-logo-mwg" aria-label="MWG">
              <span className="staff-logo-mwg-icon" aria-hidden="true" />
              <span>MWG</span>
            </div>
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

          {renderHeroEffectivePill()}
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

          <div className="result-card result-explain-card">
            <div className="result-explain-title">Giải thích giá</div>
            {getPriceExplanationRows().map((item) => (
              <div className="result-explain-row" key={item.label}>
                <div>
                  <span>{item.label}</span>
                  <small>{item.note}</small>
                </div>
                <b>{item.value}</b>
              </div>
            ))}
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

            <button className="result-btn result-btn-image" onClick={downloadQuoteImage}>
              TẢI ẢNH
            </button>

            <button className="result-btn result-btn-pdf" onClick={printQuotePdf}>
              IN PDF
            </button>
          </div>
        </section>

        <section className="quote-history-card">
          <div className="quote-history-head">
            <b>Lịch sử báo giá gần nhất</b>
            <button type="button" onClick={() => loadQuoteHistory()} disabled={quoteHistoryLoading}>
              {quoteHistoryLoading ? "Đang tải..." : "Tải lại"}
            </button>
          </div>

          <div className="quote-history-list">
            {quoteHistory.length === 0 ? (
              <p className="quote-history-empty">Chưa có lịch sử báo giá cho tài khoản này.</p>
            ) : (
              quoteHistory.map((item, index) => (
                <div className="quote-history-item" key={`${item.time}-${item.spCu}-${index}`}>
                  <div>
                    <b>{item.spCu || "Không rõ máy cũ"}{item.memory ? ` · ${item.memory}` : ""}</b>
                    <span>
                      {item.time} · {item.action} · {formatMoney(item.tongTien)}
                    </span>
                    <small className="quote-history-meta">
                      <em>{item.deviceLabel || "Không rõ"}</em>
                      <em>{item.ip || "Không rõ IP"}</em>
                      <em>{item.networkType || "Không rõ mạng"}</em>
                    </small>
                  </div>
                  <button type="button" onClick={() => applyHistoryItem(item)}>
                    Dùng lại
                  </button>
                </div>
              ))
            )}
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

      {showDataReload && (
        <section className="vtdd-data-reload-layer" role="dialog" aria-modal="true">
          <div className="vtdd-data-reload-card">
            <span>Hệ thống mới</span>
            <h2>Dữ liệu vừa được cập nhật</h2>
            <p>
              Phiên bản hiện tại: {dataVersion || "1"} · Phiên bản mới: {newDataVersion || "mới"}.
              Nhân viên bắt buộc reload để dùng cấu hình mới nhất.
            </p>
            <div className="vtdd-data-reload-countdown">
              Tự reload sau {reloadCountdown}s nếu chưa thao tác.
            </div>
            <div className="vtdd-data-reload-actions">
              <button type="button" onClick={() => window.location.reload()}>
                Reload ngay
              </button>
            </div>
          </div>
        </section>
      )}

      {renderPushNotify()}
    </main>
  );
}

