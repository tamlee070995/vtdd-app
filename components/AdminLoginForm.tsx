"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

type AdminLoginFormProps = {
  initialError?: string;
};

export default function AdminLoginForm({ initialError = "" }: AdminLoginFormProps) {
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const [maNV, setMaNV] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [successLoading, setSuccessLoading] = useState(false);

  useEffect(() => {
    router.prefetch("/admin");
  }, [router]);

  function handleMaNVKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      passwordRef.current?.focus();
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanMaNV = maNV.trim();
    const cleanPassword = password.trim();

    if (!cleanMaNV || !cleanPassword) {
      setError("Vui lòng nhập mã nhân viên và mật khẩu.");
      return;
    }

    try {
      setError("");
      setLoading(true);

      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify({ maNV: cleanMaNV, password: cleanPassword }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setError(data?.message || "Không đăng nhập được Admin.");
        setLoading(false);
        return;
      }

      setSuccessLoading(true);

      // Client navigation giữ nguyên màn hình đăng nhập + overlay cho tới khi trang Admin sẵn sàng,
      // tránh nháy trắng/chớp màn hình do form POST redirect full-page.
      router.replace(data.redirectTo || "/admin");
      router.refresh();
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
      setLoading(false);
      setSuccessLoading(false);
    }
  }

  return (
    <main className="admin-login-premium-page admin-login-no-flash-page">
      <section className="admin-login-premium-shell">
        <aside className="admin-login-premium-hero">
          <div className="admin-login-logo-mark">VT</div>

          <div className="admin-login-hero-content">
            <span>ENTERPRISE ACCESS</span>
            <h1>
              Đăng nhập
              <b>quản trị</b>
            </h1>
            <p>Quyền quản trị trang Ngành hàng Viễn Thông Di Động.</p>
          </div>
        </aside>

        <section className="admin-login-premium-panel">
          <div className="admin-login-panel-head">
            <div>
              <h2>Viễn Thông Di Động</h2>
              <p>ADMIN CMS CONSOLE</p>
            </div>
          </div>

          <form className="admin-login-premium-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="admin-maNV">Mã nhân viên</label>
            <input
              id="admin-maNV"
              name="maNV"
              type="text"
              inputMode="numeric"
              placeholder="Ví dụ: 123123"
              autoComplete="username"
              value={maNV}
              onChange={(e) => setMaNV(e.target.value)}
              onKeyDown={handleMaNVKeyDown}
              disabled={loading || successLoading}
            />

            <label htmlFor="admin-password">Mật khẩu</label>
            <input
              ref={passwordRef}
              id="admin-password"
              name="password"
              type="password"
              placeholder="Nhập mật khẩu tài khoản"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || successLoading}
            />

            {error ? (
              <div className="admin-error-banner" role="alert">
                ⚠️ {error}
              </div>
            ) : null}

            <button type="submit" disabled={loading || successLoading}>
              {successLoading ? "ĐANG MỞ ADMIN..." : loading ? "ĐANG XÁC THỰC..." : "ĐĂNG NHẬP ADMIN"}
            </button>

            <div className="admin-login-actions-v2">
              <Link href="/admin/forgot-password" aria-disabled={loading || successLoading}>
                Quên mật khẩu Admin?
              </Link>
              <Link href="/" aria-disabled={loading || successLoading}>
                Quay về trang chủ
              </Link>
            </div>
          </form>
        </section>
      </section>

      {successLoading ? (
        <div className="admin-login-handoff-layer" aria-live="polite" aria-busy="true">
          <div className="admin-login-handoff-card">
            <i />
            <b>Đăng nhập thành công</b>
            <p>Đang mở trung tâm quản trị, vui lòng chờ...</p>
          </div>
        </div>
      ) : null}

      <style>{`
        .admin-login-no-flash-page {
          isolation: isolate;
        }

        .admin-login-premium-form button:disabled,
        .admin-login-premium-form input:disabled {
          opacity: .72;
          cursor: wait;
        }

        .admin-login-handoff-layer {
          position: fixed;
          inset: 0;
          z-index: 999999;
          padding: 16px;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at 50% 18%, rgba(255, 212, 0, .26), transparent 34%),
            rgba(2, 6, 23, .76);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .admin-login-handoff-card {
          width: min(100%, 360px);
          padding: 24px 20px;
          border-radius: 28px;
          text-align: center;
          background: #ffffff;
          border: 1px solid rgba(226, 232, 240, .95);
          box-shadow: 0 32px 90px rgba(0, 0, 0, .30);
        }

        .admin-login-handoff-card i {
          width: 54px;
          height: 54px;
          margin: 0 auto 15px;
          display: block;
          border-radius: 999px;
          border: 5px solid #e2e8f0;
          border-top-color: #ffd400;
          animation: adminLoginSpin .75s linear infinite;
        }

        .admin-login-handoff-card b {
          display: block;
          color: #0f172a;
          font-size: 18px;
          line-height: 1.1;
          font-weight: 950;
          letter-spacing: -.035em;
        }

        .admin-login-handoff-card p {
          margin-top: 8px;
          color: #64748b;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 800;
        }

        @keyframes adminLoginSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
