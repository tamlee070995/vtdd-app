"use client";

import Link from "next/link";
import { useState } from "react";
import type { ToolAvailability } from "@/lib/tool-settings";

const ROUTES = [
  {
    href: "/cong-cu-ho-tro/chien-gia",
    no: "01",
    title: "Tổng giá TCDM thấp hơn đối thủ",
    desc: "Gửi hồ sơ xác thực giá đối thủ, thông tin máy và ghi chú thẩm định.",
    tone: "gold",
  },
  {
    href: "/cong-cu-ho-tro/may-ngoai-danh-sach",
    no: "02",
    title: "Máy ngoài danh sách",
    desc: "Gửi yêu cầu hỗ trợ sản phẩm không có trong danh sách thu.",
    tone: "green",
  },
];

type SupportToolsPortalProps = {
  pmhAvailability: ToolAvailability;
};

export default function SupportToolsPortal({ pmhAvailability }: SupportToolsPortalProps) {
  const [open, setOpen] = useState(false);
  const enabled = pmhAvailability.enabled;

  return (
    <main className="support-page">
      <style>{STYLE}</style>

      <header className="support-topbar">
        <Link className="support-brand" href="/" aria-label="Về trang chủ">
          <span className="support-logo-shell">
            <img src="/mwg-logo.svg" alt="MWG" />
          </span>
          <span>
            <strong>ICT</strong>
            <small>Viễn Thông Di Động</small>
          </span>
        </Link>

        <div className="support-actions">
          <Link href="/" className="support-nav-button home" aria-label="Trang Chủ">
            Trang Chủ
          </Link>
        </div>
      </header>

      <section className={`support-module ${open ? "open" : "collapsed"} ${enabled ? "" : "tool-off"}`}>
        <div className="support-module-head">
          <div className="support-title-block">
            <h1>Event Thu Cũ Đổi Mới</h1>
          </div>

          {enabled ? (
            <button type="button" className="support-collapse-button" onClick={() => setOpen((current) => !current)}>
              {open ? "Thu gọn" : "Mở rộng"}
            </button>
          ) : (
            <div className="support-closed-chip">
              <i />
              Công cụ đang tạm đóng
            </div>
          )}
        </div>

        {!enabled ? <div className="support-lock-reason">{pmhAvailability.reason}</div> : null}

        {enabled && open ? (
          <div className="support-tools-grid" aria-label="Công cụ PMH">
            {ROUTES.map((item) => {
              const content = (
                <>
                  <div className="support-tool-no">{item.no}</div>
                  <span>
                    <b>{item.title}</b>
                    <small>{item.desc}</small>
                    {!enabled ? <em>{pmhAvailability.reason || "Công cụ đang tạm đóng."}</em> : null}
                  </span>
                  <i>{enabled ? "›" : "×"}</i>
                </>
              );

              return enabled ? (
                <Link href={item.href} className={`support-tool-card ${item.tone}`} key={item.href}>
                  {content}
                </Link>
              ) : (
                <button type="button" className={`support-tool-card disabled ${item.tone}`} key={item.href}>
                  {content}
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <footer className="support-footer">
        <span />
        <b>Copyright © - Vien Thong Di Dong</b>
        <span />
      </footer>
    </main>
  );
}

const STYLE = `
.support-page {
  min-height: 100dvh;
  padding: 22px;
  background:
    radial-gradient(circle at 10% 0%, rgba(255, 212, 0, .22), transparent 30%),
    radial-gradient(circle at 95% 12%, rgba(59, 130, 246, .13), transparent 30%),
    #eef3f8;
  color: #07111f;
  font-family: Roboto, Arial, sans-serif;
}
.support-topbar {
  width: min(100%, 1480px);
  height: 76px;
  margin: 0 auto;
  padding: 0 24px;
  border-radius: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #07111f;
  border: 1px solid rgba(255,255,255,.12);
  box-shadow: 0 24px 76px rgba(15,23,42,.16);
}
.support-brand {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 13px;
  color: #fff;
  text-decoration: none;
}
.support-logo-shell {
  width: 54px;
  height: 54px;
  border-radius: 17px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: #ffd400;
}
.support-logo-shell img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.support-brand strong {
  display: block;
  color: #fff;
  font-size: 28px;
  line-height: 1;
  font-weight: 1000;
}
.support-brand small {
  display: block;
  margin-top: 4px;
  color: rgba(255,255,255,.72);
  font-size: 11px;
  font-weight: 900;
}
.support-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.support-nav-button {
  min-height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.16);
  color: #fff;
  text-decoration: none;
  font-size: 12px;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.support-nav-button.home {
  background: #ffd400;
  border-color: #ffd400;
  color: #07111f;
}
.support-module {
  width: min(100%, 1480px);
  margin: 18px auto 0;
  padding: 24px;
  border-radius: 30px;
  background: radial-gradient(circle at 100% 0%, rgba(244, 114, 182, .14), transparent 40%), rgba(255,255,255,.9);
  border: 1px solid rgba(203,213,225,.95);
  box-shadow: 0 22px 70px rgba(15,23,42,.08);
}
.support-module.tool-off {
  background: radial-gradient(circle at 100% 0%, rgba(148, 163, 184, .18), transparent 40%), rgba(255,255,255,.84);
}
.support-module.collapsed {
  padding-bottom: 24px;
}
.support-module-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
}
.support-module-no {
  width: 52px;
  height: 52px;
  border-radius: 17px;
  display: grid;
  place-items: center;
  background: #07111f;
  color: #ffd400;
  font-size: 14px;
  font-weight: 1000;
}
.support-title-block {
  min-width: 0;
}
.support-title-block > span {
  width: fit-content;
  padding: 8px 12px;
  border-radius: 999px;
  display: inline-flex;
  background: #07111f;
  color: #ffd400;
  font-size: 11px;
  font-weight: 1000;
  letter-spacing: .12em;
}
.support-title-block h1 {
  margin: 12px 0 0;
  color: #020617;
  font-size: 40px;
  line-height: 1;
  font-weight: 1000;
}
.support-title-block p {
  max-width: 720px;
  margin: 10px 0 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.45;
  font-weight: 850;
}
.support-collapse-button {
  min-height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  background: #07111f;
  color: #ffd400;
  font-size: 12px;
  font-weight: 1000;
  cursor: pointer;
}
.support-closed-chip {
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 12px;
  font-weight: 1000;
}
.support-closed-chip i {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0 7px rgba(234,88,12,.12);
}
.support-status {
  width: fit-content;
  margin-top: 18px;
  padding: 10px 13px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 12px;
  font-weight: 1000;
}
.support-status.ready {
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  color: #047857;
}
.support-status.locked {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
}
.support-status i {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0 7px rgba(16,185,129,.12);
}
.support-lock-reason {
  max-width: 760px;
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 900;
}
.support-tools-grid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.support-tool-card {
  min-height: 132px;
  padding: 16px;
  border-radius: 22px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  border: 1px solid rgba(203,213,225,.95);
  text-decoration: none;
  color: #020617;
  box-shadow: 0 16px 46px rgba(15,23,42,.055);
  text-align: left;
}
.support-tool-card.gold {
  background: linear-gradient(135deg, rgba(255,255,255,.98), rgba(255,247,204,.85));
}
.support-tool-card.green {
  background: linear-gradient(135deg, rgba(255,255,255,.98), rgba(220,252,231,.72));
}
.support-tool-card.disabled {
  cursor: not-allowed;
  opacity: .62;
  filter: grayscale(.25);
}
.support-tool-no,
.support-tool-card > i {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: #07111f;
  color: #ffd400;
  font-size: 13px;
  font-style: normal;
  font-weight: 1000;
}
.support-tool-card > i {
  border-radius: 999px;
  font-size: 28px;
  font-weight: 900;
}
.support-tool-card.disabled .support-tool-no,
.support-tool-card.disabled > i {
  background: #64748b;
  color: #fff;
}
.support-tool-card span {
  min-width: 0;
  display: grid;
  gap: 7px;
}
.support-tool-card b {
  color: #020617;
  font-size: 22px;
  line-height: 1.05;
  font-weight: 1000;
}
.support-tool-card small,
.support-tool-card em {
  color: #64748b;
  font-size: 13px;
  line-height: 1.4;
  font-style: normal;
  font-weight: 850;
}
.support-tool-card em {
  color: #9a3412;
}
.support-footer {
  width: min(100%, 1480px);
  margin: 22px auto 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 14px;
  align-items: center;
  color: #64748b;
  font-size: 12px;
  font-weight: 1000;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.support-footer span {
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(100,116,139,.35));
}
.support-footer span:last-child {
  background: linear-gradient(to left, transparent, rgba(100,116,139,.35));
}
.support-footer b {
  padding: 9px 14px;
  border-radius: 999px;
  background: rgba(255,255,255,.76);
  border: 1px solid rgba(203,213,225,.95);
}
@media (max-width: 920px) {
  .support-page {
    padding: 14px;
  }
  .support-module-head,
  .support-tools-grid {
    grid-template-columns: 1fr;
  }
  .support-module-no {
    width: 48px;
    height: 48px;
  }
  .support-collapse-button {
    width: fit-content;
  }
}
@media (max-width: 560px) {
  .support-page {
    padding: 10px;
  }
  .support-topbar {
    height: auto;
    min-height: 62px;
    padding: 10px;
    border-radius: 22px;
  }
  .support-logo-shell {
    width: 42px;
    height: 42px;
    border-radius: 14px;
  }
  .support-brand strong {
    font-size: 22px;
  }
  .support-brand small {
    display: none;
  }
  .support-nav-button {
    min-height: 38px;
    padding: 0 15px;
    font-size: 11px;
  }
  .support-module {
    margin-top: 14px;
    padding: 16px;
    border-radius: 28px;
  }
  .support-title-block h1 {
    font-size: 34px;
  }
  .support-tool-card {
    min-height: 118px;
    grid-template-columns: auto 1fr;
  }
  .support-tool-card > i {
    display: none;
  }
  .support-tool-card b {
    font-size: 19px;
  }
  .support-footer {
    grid-template-columns: 1fr;
    text-align: center;
  }
  .support-footer span {
    display: none;
  }
}
`;
