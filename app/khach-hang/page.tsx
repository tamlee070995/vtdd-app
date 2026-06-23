"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getActiveSystemLock } from "@/lib/system-lock";

type SheetRow = any[];


type SystemSettings = Record<string, string>;

type NotifySettings = {
  marquee: string;
  fixedBanner: string;
  priceEffectiveFrom: string;
  priceEffectiveTo: string;
};

const EMPTY_NOTIFY: NotifySettings = {
  marquee: "",
  fixedBanner: "",
  priceEffectiveFrom: "",
  priceEffectiveTo: "",
};

function makeNotifySettings(data: any): NotifySettings {
  return {
    marquee: data?.marquee || "",
    fixedBanner: data?.fixedBanner || "",
    priceEffectiveFrom: data?.priceEffectiveFrom || "",
    priceEffectiveTo: data?.priceEffectiveTo || "",
  };
}

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

.customer-service-assurance {
  margin: 12px 0 10px;
  display: grid;
  gap: 10px;
}

.customer-service-time {
  padding: 13px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 11px;
  background: linear-gradient(135deg, #ecfdf5, #ffffff);
  border: 1px solid rgba(16, 185, 129, .24);
  box-shadow: 0 14px 34px rgba(15, 23, 42, .06);
}

.customer-service-time i {
  width: 40px;
  height: 40px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  background: #07111f;
  color: #ffd400;
  font-style: normal;
  font-size: 18px;
  font-weight: 1000;
}

.customer-service-time span,
.customer-risk-panel span {
  display: block;
  color: #64748b;
  font-size: 10px;
  line-height: 1.2;
  font-weight: 1000;
  text-transform: uppercase;
  letter-spacing: .08em;
}

.customer-service-time b {
  display: block;
  margin-top: 3px;
  color: #07111f;
  font-size: 14px;
  line-height: 1.25;
  font-weight: 1000;
}

.customer-risk-panel {
  padding: 13px;
  border-radius: 22px;
  background: #fffaf0;
  border: 1px solid rgba(251, 146, 60, .26);
}

.customer-risk-panel b {
  display: block;
  margin-top: 4px;
  color: #7c2d12;
  font-size: 13px;
  line-height: 1.35;
  font-weight: 1000;
}

.customer-risk-badges {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.customer-risk-badges em {
  padding: 8px 9px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid rgba(251, 146, 60, .24);
  color: #9a3412;
  font-style: normal;
  font-size: 10.5px;
  line-height: 1;
  font-weight: 950;
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
.vtdd-data-reload-actions {
  display: grid;
  gap: 10px;
  margin-top: 6px;
}
.vtdd-data-reload-actions button {
  min-height: 42px;
  border: 0;
  border-radius: 12px;
  background: #ffd400;
  color: #111827;
  font-size: 12px;
  font-weight: 1000;
  cursor: pointer;
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
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 8px;
}

.vtdd-product-option {
  flex: 0 0 auto;
  width: 100%;
  min-height: 54px;
  margin-bottom: 0;
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
   CUSTOMER HERO V4 - thiết kế banner khách hàng mới
========================================================= */
.customer-personal-hero {
  min-height: clamp(320px, 33vw, 390px) !important;
  padding: clamp(22px, 3vw, 34px) clamp(18px, 3vw, 36px) 82px !important;
  border-radius: 34px !important;
  position: relative !important;
  overflow: hidden !important;
  isolation: isolate;
  display: grid !important;
  align-content: center !important;
  justify-items: center !important;
  text-align: center !important;
  background:
    radial-gradient(circle at 50% -16%, rgba(255, 212, 0, .58), transparent 34%),
    radial-gradient(circle at 0% 100%, rgba(34, 211, 238, .13), transparent 34%),
    radial-gradient(circle at 100% 100%, rgba(255, 212, 0, .16), transparent 36%),
    linear-gradient(135deg, #07111f 0%, #0f172a 48%, #020617 100%) !important;
  box-shadow: 0 26px 76px rgba(15, 23, 42, .22) !important;
}

.customer-personal-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -2;
  opacity: .28;
  background:
    linear-gradient(to right, rgba(255,255,255,.13) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,.08) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: linear-gradient(180deg, #000 0%, rgba(0,0,0,.7) 54%, transparent 100%);
}

.customer-personal-hero::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -120px;
  z-index: -1;
  width: min(760px, 108vw);
  height: 230px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: radial-gradient(circle, rgba(255, 212, 0, .20), transparent 66%);
  filter: blur(4px);
}

.customer-personal-brand {
  position: relative;
  z-index: 2;
  justify-self: center !important;
  width: fit-content;
  max-width: 100%;
  padding: 8px 13px 8px 8px;
  border-radius: 999px;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 10px !important;
  background: rgba(255,255,255,.10) !important;
  border: 1px solid rgba(255,255,255,.16) !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.10);
}

.customer-personal-brand span {
  color: #ffffff !important;
  font-size: 13px !important;
  line-height: 1 !important;
  font-weight: 950 !important;
  letter-spacing: -.01em;
}

.customer-personal-kicker {
  position: relative;
  z-index: 2;
  justify-self: center !important;
  width: fit-content;
  margin: 18px auto 0 !important;
  padding: 8px 12px !important;
  border-radius: 999px !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,.12) !important;
  border: 1px solid rgba(255,255,255,.18) !important;
  color: rgba(255,255,255,.82) !important;
  font-size: 10px !important;
  line-height: 1 !important;
  font-weight: 950 !important;
  letter-spacing: .10em !important;
  text-transform: uppercase;
}

.customer-personal-hero h1 {
  position: relative;
  z-index: 2;
  max-width: 680px;
  margin: 14px auto 0 !important;
  color: #ffffff !important;
  font-size: clamp(52px, 9vw, 92px) !important;
  line-height: .82 !important;
  font-weight: 950 !important;
  letter-spacing: -.08em !important;
  text-align: center !important;
  text-transform: uppercase;
  text-shadow: 0 18px 48px rgba(0,0,0,.24);
}

.customer-personal-hero h1 span {
  display: block !important;
  color: #ffd400 !important;
}

.customer-personal-hero p {
  position: relative;
  z-index: 2;
  max-width: 560px !important;
  margin: 16px auto 0 !important;
  color: rgba(255,255,255,.74) !important;
  font-size: 14px !important;
  line-height: 1.48 !important;
  font-weight: 850 !important;
  text-align: center !important;
}

.customer-personal-hero .vtdd-hero-effective-pill {
  bottom: 22px !important;
  background: rgba(255,255,255,.14) !important;
  border-color: rgba(255,255,255,.22) !important;
  box-shadow: 0 18px 42px rgba(2,6,23,.24), inset 0 1px 0 rgba(255,255,255,.12) !important;
}

@media (max-width: 560px) {
  .customer-personal-hero {
    min-height: 330px !important;
    padding: 20px 16px 74px !important;
    border-radius: 30px !important;
  }

  .customer-personal-brand {
    padding: 7px 11px 7px 7px;
  }

  .customer-personal-brand span {
    font-size: 12px !important;
  }

  .customer-personal-kicker {
    margin-top: 16px !important;
    font-size: 9px !important;
  }

  .customer-personal-hero h1 {
    font-size: clamp(48px, 17vw, 68px) !important;
    line-height: .84 !important;
  }

  .customer-personal-hero p {
    font-size: 12.8px !important;
    line-height: 1.45 !important;
  }

  .customer-personal-hero .vtdd-hero-effective-pill {
    bottom: 14px !important;
  }
}


/* =========================================================
   FINAL CUSTOMER DESKTOP CSS FIX - cân layout desktop
   Fix lỗi desktop: form lệch trái, result card bị tách xa, khoảng trắng lớn
========================================================= */
@media (min-width: 1024px) {
  .customer-personal-page {
    padding: clamp(22px, 2.2vw, 34px) !important;
    display: block !important;
    overflow-x: hidden !important;
  }

  .customer-personal-shell {
    width: min(1180px, calc(100vw - clamp(44px, 6vw, 90px))) !important;
    max-width: 1180px !important;
    margin: 0 auto !important;
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) minmax(330px, 390px) !important;
    gap: 16px 18px !important;
    align-items: start !important;
  }

  .customer-personal-hero {
    grid-column: 1 / -1 !important;
    width: 100% !important;
    min-height: clamp(250px, 25vw, 330px) !important;
    margin: 0 !important;
  }

  .customer-personal-shell > .vtdd-system-marquee,
  .customer-personal-shell > .vtdd-system-banner,
  .customer-personal-shell > .vtdd-system-effective,
  .customer-personal-shell > .vtdd-tab-locked-note {
    grid-column: 1 / -1 !important;
    width: 100% !important;
  }

  .customer-mode-card {
    grid-column: 1 !important;
    grid-row: auto !important;
    width: 100% !important;
    margin: 0 !important;
  }

  .customer-form-card {
    grid-column: 1 !important;
    grid-row: auto !important;
    width: 100% !important;
    margin: 0 !important;
    padding: clamp(18px, 2vw, 24px) !important;
    border-radius: 30px !important;
  }

  .customer-result-card {
    grid-column: 2 !important;
    grid-row: 3 / span 2 !important;
    position: sticky !important;
    top: clamp(14px, 2vw, 24px) !important;
    width: 100% !important;
    max-width: 390px !important;
    margin: 0 !important;
    padding: 20px !important;
    border-radius: 30px !important;
    align-self: start !important;
  }

  .customer-result-card:not(.show) {
    display: none !important;
  }

  .customer-result-card.show {
    display: block !important;
  }

  .customer-type-pill-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  }
}

@media (min-width: 1024px) and (max-width: 1180px) {
  .customer-personal-shell {
    width: min(100%, calc(100vw - 32px)) !important;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 350px) !important;
    gap: 14px !important;
  }

  .customer-result-card {
    max-width: 350px !important;
  }
}

@media (min-width: 721px) and (max-width: 1023px) {
  .customer-personal-page {
    padding: 18px !important;
  }

  .customer-personal-shell {
    width: min(720px, 100%) !important;
    max-width: 720px !important;
    margin: 0 auto !important;
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 14px !important;
  }

  .customer-result-card {
    position: static !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
  }
}


/* =========================================================
   VTDD FIX - Customer hero date 1 dòng, tự co trên mobile/tablet
========================================================= */
.customer-personal-hero .vtdd-hero-effective-pill {
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  width: max-content !important;
  min-width: 0 !important;
  max-width: calc(100% - clamp(28px, 6vw, 80px)) !important;
  padding: clamp(9px, 1.15vw, 12px) clamp(12px, 1.9vw, 20px) !important;
  font-size: clamp(10px, 1.06vw, 12px) !important;
  line-height: 1 !important;
}

@media (max-width: 640px) {
  .customer-personal-hero {
    min-height: 236px !important;
    padding-bottom: 66px !important;
  }

  .customer-personal-hero .vtdd-hero-effective-pill {
    left: 50% !important;
    right: auto !important;
    bottom: 13px !important;
    transform: translateX(-50%) !important;
    width: max-content !important;
    max-width: calc(100% - 24px) !important;
    min-height: 38px !important;
    padding: 0 12px !important;
    border-radius: 999px !important;
    font-size: clamp(8.6px, 2.35vw, 10.2px) !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .customer-personal-hero .vtdd-hero-effective-pill::before {
    width: 7px !important;
    height: 7px !important;
    margin-right: 7px !important;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, .16) !important;
  }
}

@media (max-width: 380px) {
  .customer-personal-hero .vtdd-hero-effective-pill {
    max-width: calc(100% - 20px) !important;
    font-size: 8.15px !important;
    padding: 0 9px !important;
  }
}


/* =========================================================
   VTDD FINAL FIX - Customer date pill đúng định dạng + luôn 1 dòng
========================================================= */
.customer-personal-hero .vtdd-hero-effective-pill {
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
  .customer-personal-hero .vtdd-hero-effective-pill {
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

  .customer-personal-hero .vtdd-hero-effective-pill::before {
    width: 7px !important;
    height: 7px !important;
    margin-right: 6px !important;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, .16) !important;
  }
}

@media (max-width: 380px) {
  .customer-personal-hero .vtdd-hero-effective-pill {
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
   VTDD CUSTOMER EFFECTIVE TEXT FIX
========================================================= */
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
  .customer-personal-hero .vtdd-hero-effective-pill {
    max-width: calc(100% - 22px) !important;
    min-height: 36px !important;
    padding: 0 10px !important;
    font-size: clamp(9.8px, 2.45vw, 11.2px) !important;
    letter-spacing: -.035em !important;
  }

  .customer-personal-hero .vtdd-hero-effective-pill::before {
    width: 8px !important;
    height: 8px !important;
    margin-right: 7px !important;
  }
}

@media (max-width: 380px) {
  .customer-personal-hero .vtdd-hero-effective-pill {
    font-size: clamp(8.9px, 2.35vw, 10px) !important;
    max-width: calc(100% - 14px) !important;
    padding: 0 8px !important;
  }
}


/* =========================================================
   VTDD CUSTOMER DESKTOP HERO - REDESIGN CODE ONLY
   Áp dụng desktop, mobile/tablet giữ nguyên layout hiện tại
========================================================= */
@media (min-width: 1024px) {
  .customer-personal-hero {
    min-height: clamp(340px, 30vw, 420px) !important;
    padding: clamp(32px, 3vw, 46px) clamp(38px, 4vw, 64px) 86px !important;
    border-radius: 38px !important;
    display: grid !important;
    grid-template-columns: minmax(0, 1.02fr) minmax(330px, .72fr) !important;
    grid-template-rows: auto auto 1fr !important;
    align-items: center !important;
    align-content: center !important;
    justify-items: start !important;
    column-gap: clamp(36px, 5vw, 86px) !important;
    row-gap: 14px !important;
    text-align: left !important;
    background:
      radial-gradient(circle at 16% 18%, rgba(255, 212, 0, .24), transparent 28%),
      radial-gradient(circle at 58% -12%, rgba(255, 212, 0, .44), transparent 32%),
      radial-gradient(circle at 100% 100%, rgba(34, 211, 238, .16), transparent 30%),
      linear-gradient(135deg, #020617 0%, #0f172a 44%, #111827 72%, #292400 100%) !important;
    box-shadow: 0 28px 84px rgba(15, 23, 42, .24) !important;
  }

  .customer-personal-hero::before {
    opacity: .32 !important;
    background:
      linear-gradient(to right, rgba(255,255,255,.12) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,.07) 1px, transparent 1px) !important;
    background-size: 30px 30px !important;
    mask-image: linear-gradient(90deg, #000 0%, rgba(0,0,0,.92) 56%, transparent 100%) !important;
  }

  .customer-personal-hero::after {
    left: auto !important;
    right: clamp(-160px, -10vw, -90px) !important;
    bottom: clamp(-140px, -8vw, -90px) !important;
    width: clamp(430px, 42vw, 680px) !important;
    height: clamp(430px, 42vw, 680px) !important;
    transform: none !important;
    border-radius: 999px !important;
    background:
      radial-gradient(circle, rgba(255, 212, 0, .30), rgba(255, 212, 0, .10) 38%, transparent 70%) !important;
    filter: blur(2px) !important;
  }

  .customer-personal-brand {
    grid-column: 1 !important;
    grid-row: 1 !important;
    justify-self: start !important;
    margin: 0 !important;
    padding: 9px 15px 9px 9px !important;
    gap: 11px !important;
    background: rgba(255, 255, 255, .11) !important;
    border: 1px solid rgba(255, 255, 255, .20) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 16px 36px rgba(0,0,0,.18) !important;
  }

  .customer-personal-brand span {
    font-size: 14px !important;
    font-weight: 950 !important;
  }

  .customer-personal-kicker {
    grid-column: 1 !important;
    grid-row: 2 !important;
    justify-self: start !important;
    margin: 12px 0 0 !important;
    padding: 9px 13px !important;
    background: rgba(255, 212, 0, .13) !important;
    border-color: rgba(255, 212, 0, .28) !important;
    color: #ffd400 !important;
    font-size: 10.5px !important;
  }

  .customer-personal-hero h1 {
    grid-column: 1 !important;
    grid-row: 3 !important;
    justify-self: start !important;
    max-width: 760px !important;
    margin: 6px 0 0 !important;
    text-align: left !important;
    font-size: clamp(72px, 7.8vw, 118px) !important;
    line-height: .78 !important;
    letter-spacing: -.095em !important;
    text-shadow: 0 18px 52px rgba(0,0,0,.32) !important;
  }

  .customer-personal-hero h1 span {
    color: #ffd400 !important;
  }

  .customer-personal-hero p {
    grid-column: 2 !important;
    grid-row: 1 / 4 !important;
    justify-self: stretch !important;
    align-self: center !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 24px 24px 24px 26px !important;
    border-radius: 28px !important;
    text-align: left !important;
    color: rgba(255,255,255,.88) !important;
    font-size: clamp(15px, 1.12vw, 17px) !important;
    line-height: 1.55 !important;
    font-weight: 900 !important;
    background:
      linear-gradient(135deg, rgba(255,255,255,.13), rgba(255,255,255,.055)) !important;
    border: 1px solid rgba(255,255,255,.16) !important;
    box-shadow: 0 22px 56px rgba(2,6,23,.28), inset 0 1px 0 rgba(255,255,255,.11) !important;
    backdrop-filter: blur(14px) !important;
    -webkit-backdrop-filter: blur(14px) !important;
  }

  .customer-personal-hero p::before {
    content: "GIÁ THAM KHẢO NHANH";
    display: block;
    width: fit-content;
    margin-bottom: 13px;
    padding: 8px 11px;
    border-radius: 999px;
    background: #ffd400;
    color: #0f172a;
    font-size: 10px;
    line-height: 1;
    font-weight: 950;
    letter-spacing: .08em;
  }

  .customer-personal-hero .vtdd-hero-effective-pill {
    left: 50% !important;
    right: auto !important;
    bottom: 22px !important;
    transform: translateX(-50%) !important;
    max-width: calc(100% - 72px) !important;
    min-height: 44px !important;
    padding: 0 clamp(18px, 2vw, 26px) !important;
    font-size: clamp(13px, 1vw, 15px) !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    background: rgba(255,255,255,.15) !important;
    border-color: rgba(255,255,255,.24) !important;
  }
}

/* =========================================================
   VTDD EFFECTIVE DATE TEXT ONLY - không parse ngày, không convert serial
========================================================= */
.staff-command .vtdd-hero-effective-pill,
.customer-personal-hero .vtdd-hero-effective-pill,
.vtdd-hero-effective-pill {
  font-size: clamp(12.8px, 1.25vw, 15.5px) !important;
  min-height: 40px !important;
  padding: 0 clamp(14px, 1.8vw, 24px) !important;
  line-height: 1 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

@media (max-width: 640px) {
  .staff-command .vtdd-hero-effective-pill,
  .customer-personal-hero .vtdd-hero-effective-pill,
  .vtdd-hero-effective-pill {
    max-width: calc(100% - 22px) !important;
    min-height: 36px !important;
    padding: 0 10px !important;
    font-size: clamp(10.6px, 2.7vw, 12px) !important;
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


const TYPE_OPTIONS = [
  {
    label: "Loại 1",
    value: "1",
    index: 3,
    desc: "Hoạt động tốt, hoàn toàn không trầy xước. Pin iPhone từ 90% trở lên. iPhone 14 Series trở lên phải là mã VN/A.",
  },
  {
    label: "Loại 2",
    value: "2",
    index: 4,
    desc: "Hoạt động tốt, máy có trầy xước nhẹ hoặc lông mèo.",
  },
  {
    label: "Loại 3",
    value: "3",
    index: 5,
    desc: "Hoạt động tốt, máy trầy xước nặng hoặc cấn móp.",
  },
  {
    label: "Loại 4",
    value: "4",
    index: 6,
    desc: "Máy bể vỡ, cấn móp nặng hoặc có lỗi chức năng.",
  },
  {
    label: "Loại 5",
    value: "5",
    index: 7,
    desc: "Máy đã thay màn lô hoặc có lỗi hiển thị màn hình như sọc, đốm, chảy mực, âm ảnh.",
  },
  {
    label: "Loại 5+",
    value: "5+",
    index: 8,
    desc: "Máy đầy đủ chức năng nhưng có lỗi màn hình. Trường hợp này cần có đối tác hỗ trợ.",
  },
];

function parseMoney(value: any) {
  if (typeof value === "number") return value;

  const s = String(value || "").trim();
  if (!s) return 0;

  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);

  const raw = s.replace(/[^\d]/g, "");
  return raw ? Number(raw) : 0;
}

function parseRate(value: any) {
  if (typeof value === "number") return value > 1 ? value / 100 : value;

  const s = String(value || "").trim();
  if (!s) return 0;

  if (s.includes("%")) {
    const n = Number(s.replace("%", "").replace(",", ".").trim());
    return isNaN(n) ? 0 : n / 100;
  }

  const n = Number(s.replace(",", "."));
  if (isNaN(n)) return 0;

  return n > 1 ? n / 100 : n;
}

function formatMoney(value: number) {
  if (!value || value <= 0) return "0 đ";
  return value.toLocaleString("vi-VN") + " đ";
}

function unique(list: string[]) {
  return Array.from(new Set(list.filter(Boolean)));
}

function isAppleBrand(value: any) {
  const s = String(value || "").toUpperCase();
  return s.includes("APPLE") || s.includes("IPHONE") || s.includes("IPAD");
}

function getCustomerClientMeta() {
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
  const isDesktop = uaLower.includes("windows") || uaLower.includes("macintosh") || uaLower.includes("linux");
  if (isDesktop) {
    if (type.includes("ethernet")) networkType = "LAN";
    else if (type.includes("wifi")) networkType = "WiFi";
    else networkType = "WiFi/LAN";
  } else if (type.includes("wifi") || type.includes("ethernet")) {
    networkType = "WiFi";
  } else if (type.includes("cell")) {
    networkType = effectiveType ? effectiveType.toUpperCase() : "4G/5G";
  } else if (effectiveType.includes("5g")) networkType = "5G";
  else if (effectiveType.includes("4g")) networkType = "4G";
  else if (effectiveType.includes("3g")) networkType = "3G";
  else if (effectiveType.includes("2g")) networkType = "2G";

  return { clientDevice, networkType };
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


export default function CustomerPage() {
  const [loading, setLoading] = useState(true);
  const [loadMsg, setLoadMsg] = useState("Đang tải bảng giá mới nhất.");
  const [dataMoi, setDataMoi] = useState<SheetRow[]>([]);
  const [dataCu, setDataCu] = useState<SheetRow[]>([]);
  const [dataTablet, setDataTablet] = useState<SheetRow[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({});
  const [notifySettings, setNotifySettings] = useState<NotifySettings>(EMPTY_NOTIFY);
  const [lockClockTick, setLockClockTick] = useState(() => Date.now());

  const [mode, setMode] = useState<"tradein" | "buyonly">("tradein");
  const [hang, setHang] = useState("");
  const [spMoi, setSpMoi] = useState("");
  const [spCu, setSpCu] = useState("");
  const [loai, setLoai] = useState("");
  const lastCustomerQuoteLogKey = useRef("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/data/super-fast", { cache: "no-store" });
        const json = await res.json();

        if (!json.success) {
          setLoadMsg(json.message || "Không tải được bảng giá.");
          setLoading(false);
          return;
        }

        setDataMoi(json.data.moi || []);
        setDataCu(json.data.cu || []);
        setDataTablet(json.data.tablet || []);
        setSystemSettings(json.data.system || {});
        setNotifySettings(makeNotifySettings(json.data.notify));
        setLoading(false);
      } catch {
        setLoadMsg("Lỗi kết nối dữ liệu.");
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLockClockTick(Date.now());
    }, 15000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let stopped = false;

    async function checkCustomerSystemState() {
      try {
        const res = await fetch("/api/data/version", {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });
        const json = await res.json().catch(() => null);

        if (!stopped && json?.system) {
          setSystemSettings(json.system || {});
        }
      } catch {
        // Không làm phiền khách nếu kiểm tra trạng thái hệ thống lỗi tạm thời.
      }
    }

    checkCustomerSystemState();

    const timer = window.setInterval(checkCustomerSystemState, 5000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

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
  const selectedTypeInfo = TYPE_OPTIONS.find((item) => item.value === loai) || null;

  const activeSystemLock = getActiveSystemLock(systemSettings, new Date(lockClockTick));
  const systemLocked = activeSystemLock.active;
  const customerPageLocked = settingEnabled(systemSettings, "CUSTOMER_PAGE_LOCKED");
  const customerTradeinLocked = settingEnabled(systemSettings, "CUSTOMER_TRADEIN_LOCKED");
  const customerBuyonlyLocked = settingEnabled(systemSettings, "CUSTOMER_BUYONLY_LOCKED");
  const currentCustomerTabLocked = mode === "tradein" ? customerTradeinLocked : customerBuyonlyLocked;
  const customerAccessLocked = systemLocked || customerPageLocked;

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
      };
    }

    const oldBrand = String(selectedOldRow[0] || "").trim().toUpperCase();
    const apple = isAppleBrand(oldBrand);

    const giaXac = parseMoney(selectedOldRow[type.index]);

    let troGiaMWG = 0;
    if (type.index === 3 || type.index === 4) {
      troGiaMWG = apple ? parseMoney(selectedOldRow[10]) : parseMoney(selectedOldRow[11]);
    }

    let tiLe = 0;
    let maxTroGia = 0;
    let minTroGia = 0;
    let troGiaHang = 0;

    if (mode === "tradein" && selectedNewRow) {
      tiLe = apple ? parseRate(selectedNewRow[3]) : parseRate(selectedNewRow[2]);
      maxTroGia = parseMoney(selectedNewRow[4]);
      minTroGia = apple ? parseMoney(selectedNewRow[7]) : parseMoney(selectedNewRow[6]);

      if (giaXac > 0 && tiLe > 0) {
        troGiaHang = Math.round((giaXac * tiLe) / 5000) * 5000;

        if (maxTroGia > 0 && troGiaHang > maxTroGia) {
          troGiaHang = maxTroGia;
        }

        if (minTroGia > 0 && troGiaHang < minTroGia && giaXac > 0) {
          troGiaHang = minTroGia;
        }
      }
    }

    return {
      giaXac,
      troGiaHang,
      troGiaMWG,
      tongTien: giaXac + troGiaHang + troGiaMWG,
      tiLe,
      maxTroGia,
      minTroGia,
    };
  }, [mode, selectedNewRow, selectedOldRow, loai]);

  async function sendCustomerQuoteLog() {
    try {
      const clientMeta = getCustomerClientMeta();

      await fetch("/api/log/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        cache: "no-store",
        body: JSON.stringify({
          source: "customer",
          action: "CUSTOMER_QUOTE",
          mode,
          spMoi: mode === "tradein" ? spMoi : "Chỉ thu cũ",
          spCu,
          memory,
          loai,
          giaXac: priceInfo.giaXac,
          troGiaHang: mode === "tradein" ? priceInfo.troGiaHang : 0,
          troGiaMWG: priceInfo.troGiaMWG,
          tongTien: priceInfo.tongTien,
          khachCanBu: 0,
          clientDevice: clientMeta.clientDevice,
          networkType: clientMeta.networkType,
        }),
      });
    } catch (err) {
      console.error("CUSTOMER_QUOTE_LOG_ERROR:", err);
    }
  }

  useEffect(() => {
    if (loading || customerAccessLocked || currentCustomerTabLocked) return;
    if (!spCu || !loai || priceInfo.giaXac <= 0) return;
    if (mode === "tradein" && !spMoi) return;

    const key = [
      mode,
      spMoi,
      spCu,
      memory,
      loai,
      priceInfo.giaXac,
      priceInfo.troGiaHang,
      priceInfo.troGiaMWG,
      priceInfo.tongTien,
    ].join("|");

    if (lastCustomerQuoteLogKey.current === key) return;
    lastCustomerQuoteLogKey.current = key;

    void sendCustomerQuoteLog();
  }, [
    loading,
    customerAccessLocked,
    currentCustomerTabLocked,
    mode,
    spMoi,
    spCu,
    memory,
    loai,
    priceInfo.giaXac,
    priceInfo.troGiaHang,
    priceInfo.troGiaMWG,
    priceInfo.tongTien,
  ]);

  useEffect(() => {
    if (mode === "tradein" && customerTradeinLocked && !customerBuyonlyLocked) {
      setMode("buyonly");
      setHang("");
      setSpMoi("");
      setSpCu("");
      setLoai("");
    }

    if (mode === "buyonly" && customerBuyonlyLocked && !customerTradeinLocked) {
      setMode("tradein");
      setHang("");
      setSpMoi("");
      setSpCu("");
      setLoai("");
    }
  }, [mode, customerTradeinLocked, customerBuyonlyLocked]);

  function renderSystemStyle() {
    return <style>{SYSTEM_UI_CSS}</style>;
  }

  function renderSystemNotices() {
    return null;
  }

  function renderHeroEffectivePill() {
    const effectiveRange = getEffectiveRange(notifySettings);

    if (!effectiveRange) return null;

    return <div className="vtdd-hero-effective-pill">{effectiveRange}</div>;
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

  function resetForm() {
    setHang("");
    setSpMoi("");
    setSpCu("");
    setLoai("");
  }

  if (loading) {
    return (
      <main className="customer-personal-page">
        <section className="customer-personal-loader">
          <div className="customer-loader-orb"></div>
          <h1>Viễn Thông Di Động</h1>
          <p>{loadMsg}</p>
        </section>
      </main>
    );
  }

  if (customerAccessLocked) {
    return renderSystemLock();
  }

  return (
    <main className="customer-personal-page">
      {renderSystemStyle()}
      <section className="customer-personal-shell">
        <header className="customer-personal-hero">
          <div className="customer-personal-brand">
            <div
              aria-label="Viễn Thông Di Động"
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                background: "#ffd400",
                overflow: "hidden",
                display: "grid",
                placeItems: "center",
                flex: "0 0 auto",
              }}
            >
              <img
                src="/mwg-logo.svg"
                alt="Viễn Thông Di Động"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
            <span>Viễn Thông Di Động</span>
          </div>

          <div className="customer-personal-kicker">TRA CỨU DÀNH CHO KHÁCH HÀNG</div>

          <h1>
            THU CŨ
            <span>ĐỔI MỚI</span>
          </h1>

          <p>
            Tra cứu nhanh giá tham khảo khi thu cũ đổi mới. Giá cuối cùng sẽ được xác nhận sau khi kiểm tra máy thực tế tại siêu thị.
          </p>

          {renderHeroEffectivePill()}
        </header>

        {renderSystemNotices()}

        {currentCustomerTabLocked && (
          <div className="vtdd-tab-locked-note">
            Chương trình này đang tạm dừng. Bạn vui lòng chọn chương trình còn lại hoặc thử lại sau.
          </div>
        )}

        <section className="customer-mode-card">
          <button
            className={mode === "tradein" ? "active" : ""}
            disabled={customerTradeinLocked}
            onClick={() => {
              if (customerTradeinLocked) return;
              setMode("tradein");
              resetForm();
            }}
          >
            Thu cũ đổi mới{customerTradeinLocked ? " • Khóa" : ""}
          </button>

          <button
            className={mode === "buyonly" ? "active" : ""}
            disabled={customerBuyonlyLocked}
            onClick={() => {
              if (customerBuyonlyLocked) return;
              setMode("buyonly");
              resetForm();
            }}
          >
            Chỉ thu cũ{customerBuyonlyLocked ? " • Khóa" : ""}
          </button>
        </section>

        <section className="customer-form-card">
          {mode === "tradein" && (
            <>
              <div className="customer-section-title">
                <span>01</span>
                <div>
                  <b>Máy muốn mua mới</b>
                  <p>Chọn sản phẩm bạn muốn lên đời.</p>
                </div>
              </div>

              <label>Hãng máy mới</label>
              <select
                value={hang}
                onChange={(e) => {
                  setHang(e.target.value);
                  setSpMoi("");
                  setSpCu("");
                  setLoai("");
                }}
              >
                <option value="">Chọn hãng</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
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
                  setSpCu("");
                  setLoai("");
                }}
              />
            </>
          )}

          <div className="customer-section-title second">
            <span>{mode === "buyonly" ? "01" : "02"}</span>
            <div>
              <b>Máy hiện tại của bạn</b>
              <p>Chọn đúng model và tình trạng máy.</p>
            </div>
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
          <input value={memory} readOnly placeholder="Tự động theo máy cũ" />

          <div className="customer-type-title">Chọn tình trạng máy</div>

          <div className="customer-type-pill-grid">
            {TYPE_OPTIONS.map((item) => {
              return (
                <button
                  key={item.value}
                  type="button"
                  className={loai === item.value ? "active" : ""}
                  onClick={() => setLoai(item.value)}
                  disabled={!canChooseType}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {selectedTypeInfo && (
            <div className="customer-type-detail-card">
              <div>
                <span>Chi tiết loại đã chọn</span>
                <b>{selectedTypeInfo.label}</b>
              </div>

              <p>{selectedTypeInfo.desc}</p>
            </div>
          )}
        </section>

        <section className={loai ? "customer-result-card show" : "customer-result-card"}>
          <div className="customer-result-kicker">TỔNG TIỀN DỰ KIẾN</div>

          <div className="customer-result-total">{formatMoney(priceInfo.tongTien)}</div>

          <div className="customer-result-note">
            Giá chỉ mang tính tham khảo. Kết quả cuối cùng phụ thuộc tình trạng thực tế, tài khoản, IMEI/Serial và chính sách tại thời điểm giao dịch.
          </div>

          <div className="customer-service-assurance" aria-label="Thông tin kiểm tra tại siêu thị">
            <div className="customer-service-time">
              <i>10</i>
              <div>
                <span>Thời gian xử lý dự kiến</span>
                <b>Kiểm tra máy khoảng 10 phút tại siêu thị.</b>
              </div>
            </div>

          </div>

          <div className="customer-result-rows">
            <div>
              <span>Máy mới</span>
              <b>{mode === "tradein" ? spMoi || "Chưa chọn" : "Chỉ thu cũ"}</b>
            </div>

            <div>
              <span>Máy cũ</span>
              <b>{spCu ? `${spCu}${memory ? " · " + memory : ""}` : "Chưa chọn"}</b>
            </div>

            <div>
              <span>Tình trạng</span>
              <b>{loai ? `Loại ${loai}` : "Chưa chọn"}</b>
            </div>

            <div className="customer-total-row-only">
              <span>Tổng tiền dự kiến</span>
              <b>{formatMoney(priceInfo.tongTien)}</b>
            </div>
          </div>

          <a className="customer-store-btn customer-hotline-btn" href="tel:1900232460">
            <span>Tổng đài hỗ trợ</span>
            <b>Gọi mua: 1900 232 460 (8:00 - 21:30)</b>
          </a>
        </section>
      </section>

    </main>
  );
}
