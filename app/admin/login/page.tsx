"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

function cleanError(value: string) {
  try {
    return decodeURIComponent(value || "").trim();
  } catch {
    return value || "";
  }
}

export default function AdminLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setError(cleanError(params.get("error") || ""));
  }, []);

  const canSubmit = useMemo(() => password.trim().length > 0 && !submitting, [password, submitting]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!password.trim()) {
      event.preventDefault();
      setError("Vui lòng nhập PIN admin.");
      return;
    }

    setSubmitting(true);
  }

  return (
    <main className="adm-login-v2-page">
      <style>{`
        .adm-login-v2-page,
        .adm-login-v2-page * {
          box-sizing: border-box;
        }

        .adm-login-v2-page {
          min-height: 100svh;
          width: 100%;
          overflow-x: hidden;
          padding: 28px;
          font-family: Roboto, Inter, Arial, sans-serif;
          color: #0f172a;
          background:
            radial-gradient(circle at 12% 8%, rgba(255, 212, 0, .22), transparent 28%),
            radial-gradient(circle at 92% 16%, rgba(15, 23, 42, .18), transparent 30%),
            linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%);
          display: grid;
          place-items: center;
        }

        .adm-login-v2-shell {
          width: min(1120px, 100%);
          min-height: min(720px, calc(100svh - 56px));
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(390px, .95fr);
          border-radius: 34px;
          overflow: hidden;
          background: rgba(255, 255, 255, .82);
          border: 1px solid rgba(148, 163, 184, .24);
          box-shadow: 0 30px 90px rgba(15, 23, 42, .14);
          backdrop-filter: blur(18px);
        }

        .adm-login-v2-hero {
          position: relative;
          min-height: 100%;
          padding: 44px;
          color: #fff;
          background:
            linear-gradient(90deg, rgba(15, 23, 42, .96), rgba(15, 23, 42, .82)),
            radial-gradient(circle at 86% 16%, rgba(255, 212, 0, .36), transparent 32%),
            #0f172a;
          overflow: hidden;
        }

        .adm-login-v2-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          opacity: .18;
          background-image:
            linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px);
          background-size: 22px 22px;
        }

        .adm-login-v2-hero::after {
          content: "";
          position: absolute;
          width: 360px;
          height: 360px;
          right: -110px;
          top: -90px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(255, 212, 0, .74), transparent 68%);
          filter: blur(18px);
          opacity: .72;
        }

        .adm-login-v2-hero-inner {
          position: relative;
          z-index: 1;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 34px;
        }

        .adm-login-v2-topline {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          gap: 8px;
          padding: 9px 13px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, .18);
          background: rgba(255, 255, 255, .08);
          color: rgba(255,255,255,.88);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .11em;
          text-transform: uppercase;
        }

        .adm-login-v2-brand-block h1 {
          margin: 26px 0 16px;
          max-width: 620px;
          font-size: clamp(56px, 7vw, 96px);
          line-height: .86;
          font-weight: 1000;
          letter-spacing: -.07em;
          text-transform: uppercase;
        }

        .adm-login-v2-brand-block h1 span {
          display: block;
          color: #ffd400;
        }

        .adm-login-v2-brand-block p {
          margin: 0;
          max-width: 520px;
          color: rgba(255,255,255,.76);
          font-size: 15px;
          line-height: 1.65;
          font-weight: 800;
        }

        .adm-login-v2-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .adm-login-v2-badge {
          padding: 10px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.16);
          background: rgba(255,255,255,.08);
          color: rgba(255,255,255,.9);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .05em;
          text-transform: uppercase;
        }

        .adm-login-v2-panel {
          padding: 44px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 24px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.94), rgba(248,250,252,.96));
        }

        .adm-login-v2-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px;
          border-radius: 24px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 12px 34px rgba(15, 23, 42, .06);
        }

        .adm-login-v2-mark {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: #ffd400;
          color: #07111f;
          font-size: 18px;
          font-weight: 1000;
          letter-spacing: -.04em;
        }

        .adm-login-v2-title {
          color: #0f172a;
          font-size: 18px;
          line-height: 1.05;
          font-weight: 1000;
          letter-spacing: -.03em;
        }

        .adm-login-v2-subtitle {
          margin-top: 5px;
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .adm-login-v2-card {
          padding: 24px;
          border-radius: 28px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 18px 50px rgba(15, 23, 42, .08);
        }

        .adm-login-v2-card-head {
          margin-bottom: 18px;
        }

        .adm-login-v2-card-head small {
          display: inline-flex;
          padding: 7px 10px;
          border-radius: 999px;
          background: #0f172a;
          color: #ffd400;
          font-size: 10px;
          line-height: 1;
          font-weight: 1000;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .adm-login-v2-card-head h2 {
          margin: 14px 0 6px;
          color: #0f172a;
          font-size: 30px;
          line-height: 1;
          font-weight: 1000;
          letter-spacing: -.05em;
        }

        .adm-login-v2-card-head p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.55;
          font-weight: 750;
        }

        .adm-login-v2-label {
          display: block;
          margin: 0 0 8px;
          color: #64748b;
          font-size: 11px;
          font-weight: 1000;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .adm-login-v2-password-wrap {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 58px;
          border-radius: 18px;
          border: 1px solid #dbe3ee;
          background: #f8fafc;
          overflow: hidden;
          transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
        }

        .adm-login-v2-password-wrap:focus-within {
          border-color: #ffd400;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(255, 212, 0, .22);
        }

        .adm-login-v2-password-wrap input {
          width: 100%;
          min-width: 0;
          min-height: 58px;
          padding: 0 92px 0 16px;
          border: 0 !important;
          outline: 0 !important;
          background: transparent !important;
          color: #0f172a;
          font-size: 18px;
          font-weight: 900;
          letter-spacing: .02em;
          box-shadow: none !important;
          appearance: none;
          -webkit-appearance: none;
        }

        .adm-login-v2-password-wrap input::-ms-reveal,
        .adm-login-v2-password-wrap input::-ms-clear {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }

        .adm-login-v2-password-wrap input::-webkit-credentials-auto-fill-button,
        .adm-login-v2-password-wrap input::-webkit-contacts-auto-fill-button {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          position: absolute !important;
          right: 0 !important;
        }

        .adm-login-v2-password-wrap input::placeholder {
          color: #94a3b8;
          font-size: 15px;
          font-weight: 850;
          letter-spacing: 0;
        }

        .adm-login-v2-eye {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: 74px;
          height: 42px;
          border: 0;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          color: #ffd400;
          font-size: 11px;
          font-weight: 1000;
          letter-spacing: .04em;
          cursor: pointer;
        }

        .adm-login-v2-error {
          margin-top: 14px;
          padding: 13px 14px;
          border-radius: 16px;
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 850;
        }

        .adm-login-v2-submit {
          width: 100%;
          min-height: 58px;
          margin-top: 16px;
          border: 0;
          border-radius: 18px;
          background: #ffd400;
          color: #07111f;
          font-size: 12.5px;
          font-weight: 1000;
          letter-spacing: .08em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 16px 30px rgba(255, 212, 0, .28);
          transition: transform .18s ease, opacity .18s ease;
        }

        .adm-login-v2-submit:hover {
          transform: translateY(-1px);
        }

        .adm-login-v2-submit:disabled {
          opacity: .65;
          cursor: wait;
          transform: none;
        }

        .adm-login-v2-back {
          min-height: 50px;
          margin-top: 10px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          text-decoration: none;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #0f172a;
          font-size: 12px;
          font-weight: 1000;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .adm-login-v2-note {
          padding: 15px 16px;
          border-radius: 22px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
          font-size: 12.5px;
          line-height: 1.55;
          font-weight: 800;
        }

        @media (max-width: 860px) {
          .adm-login-v2-page {
            padding: 14px;
            place-items: stretch;
            background: #eef2f7;
          }

          .adm-login-v2-shell {
            min-height: calc(100svh - 28px);
            grid-template-columns: 1fr;
            border-radius: 28px;
          }

          .adm-login-v2-hero {
            min-height: 260px;
            padding: 26px;
            border-radius: 0;
          }

          .adm-login-v2-brand-block h1 {
            margin: 22px 0 12px;
            font-size: 48px;
            line-height: .88;
          }

          .adm-login-v2-brand-block p {
            font-size: 13px;
          }

          .adm-login-v2-badges {
            display: none;
          }

          .adm-login-v2-panel {
            padding: 18px;
            gap: 16px;
          }

          .adm-login-v2-brand {
            border-radius: 22px;
          }

          .adm-login-v2-card {
            padding: 18px;
            border-radius: 24px;
          }

          .adm-login-v2-card-head h2 {
            font-size: 26px;
          }
        }

        @media (max-width: 430px) {
          .adm-login-v2-page {
            padding: 0;
          }

          .adm-login-v2-shell {
            min-height: 100svh;
            border-radius: 0;
            border: 0;
          }

          .adm-login-v2-hero {
            min-height: 245px;
            padding: 22px;
          }

          .adm-login-v2-brand-block h1 {
            font-size: 44px;
          }

          .adm-login-v2-panel {
            padding: 14px;
          }

          .adm-login-v2-password-wrap input {
            padding-right: 84px;
          }

          .adm-login-v2-eye {
            width: 66px;
          }
        }
      `}</style>

      <section className="adm-login-v2-shell">
        <section className="adm-login-v2-hero">
          <div className="adm-login-v2-hero-inner">
            <div>
              <div className="adm-login-v2-topline">Enterprise Admin Access</div>
              <div className="adm-login-v2-brand-block">
                <h1>
                  ADMIN
                  <span>CONSOLE</span>
                </h1>
                <p>
                  Trung tâm điều phối tài khoản nhân viên, thông báo hệ thống, khóa truy cập khẩn cấp và dashboard tra giá.
                </p>
              </div>
            </div>

            <div className="adm-login-v2-badges">
              <span className="adm-login-v2-badge">Private route</span>
              <span className="adm-login-v2-badge">PIN protected</span>
              <span className="adm-login-v2-badge">Viễn Thông Di Động</span>
            </div>
          </div>
        </section>

        <section className="adm-login-v2-panel">
          <div className="adm-login-v2-brand">
            <div className="adm-login-v2-mark">VT</div>
            <div>
              <div className="adm-login-v2-title">Viễn Thông Di Động</div>
              <div className="adm-login-v2-subtitle">Admin Secure Console</div>
            </div>
          </div>

          <form
            className="adm-login-v2-card"
            action="/api/auth/admin-login"
            method="POST"
            noValidate
            onSubmit={handleSubmit}
          >
            <div className="adm-login-v2-card-head">
              <small>Bảo mật hệ thống</small>
              <h2>Đăng nhập Admin</h2>
              <p>Nhập PIN quản trị để vào khu vực điều hành hệ thống.</p>
            </div>

            <label className="adm-login-v2-label" htmlFor="admin-password">
              PIN Admin
            </label>

            <div className="adm-login-v2-password-wrap">
              <input
                id="admin-password"
                name="password"
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nhập PIN admin"
                autoComplete="current-password"
                spellCheck={false}
                style={{ WebkitTextSecurity: showPassword ? "none" : "disc" } as any}
              />

              <button
                className="adm-login-v2-eye"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? "ẨN" : "HIỆN"}
              </button>
            </div>

            {error ? (
              <div className="adm-login-v2-error" role="alert">
                ⚠️ {error}
              </div>
            ) : null}

            <button className="adm-login-v2-submit" type="submit" disabled={!canSubmit}>
              {submitting ? "Đang xác thực..." : "Đăng nhập Admin"}
            </button>

            <a className="adm-login-v2-back" href="/">
              Quay về trang chủ
            </a>
          </form>

          <div className="adm-login-v2-note">
            Khu vực quản trị chỉ dành cho người được phân quyền. Mọi thao tác cấu hình hệ thống cần kiểm tra kỹ trước khi lưu.
          </div>
        </section>
      </section>
    </main>
  );
}
