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
      router.replace(data.redirectTo || "/admin");
      router.refresh();
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
      setLoading(false);
      setSuccessLoading(false);
    }
  }

  return (
    <main className="admin-auth-page">
      <section className="admin-auth-shell">
        <aside className="admin-auth-hero" aria-label="Trung tâm quản trị">
          <div className="admin-auth-brand">
            <span className="admin-auth-logo">
              <img src="/mwg-logo.svg" alt="MWG" />
            </span>
            <span>
              <b>Viễn Thông Di Động</b>
              <small>Admin Command Center</small>
            </span>
          </div>

          <div className="admin-auth-copy">
            <span>MODULE CONTROL</span>
            <h1>
              Quản trị vận hành
              <b>TCDM</b>
            </h1>
            <p>
              Dành riêng cho Admin và Mod được phân quyền. Mọi thao tác đều được
              ghi nhận để bảo vệ dữ liệu nhân viên.
            </p>
          </div>

          <div className="admin-auth-metrics" aria-hidden="true">
            <div>
              <b>RBAC</b>
              <span>Phân quyền module</span>
            </div>
            <div>
              <b>LOG</b>
              <span>Theo dõi thao tác</span>
            </div>
            <div>
              <b>OTP</b>
              <span>Bảo mật tài khoản</span>
            </div>
          </div>
        </aside>

        <section className="admin-auth-panel">
          <div className="admin-auth-panel-head">
            <span>ADMIN</span>
            <div>
              <h2>Đăng nhập quản trị</h2>
              <p>Kiểm tra quyền truy cập trước khi mở dashboard.</p>
            </div>
          </div>

          <form className="admin-auth-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="admin-maNV">Mã nhân viên quản trị</label>
            <input
              id="admin-maNV"
              name="maNV"
              type="text"
              inputMode="numeric"
              placeholder="VD: 36964"
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
              <div className="admin-auth-error" role="alert">
                <b>Không thể xác thực</b>
                <span>{error}</span>
              </div>
            ) : null}

            <button type="submit" disabled={loading || successLoading}>
              {successLoading
                ? "Đang mở admin..."
                : loading
                  ? "Đang xác thực..."
                  : "Đăng nhập Admin"}
            </button>

            <div className="admin-auth-actions">
              <Link href="/admin/forgot-password" aria-disabled={loading || successLoading}>
                Quên mật khẩu Admin
              </Link>
              <Link href="/" aria-disabled={loading || successLoading}>
                Trang chủ
              </Link>
            </div>
          </form>
        </section>
      </section>

      {successLoading ? (
        <div className="admin-auth-handoff-layer" aria-live="polite" aria-busy="true">
          <div className="admin-auth-handoff-card">
            <i />
            <b>Đăng nhập thành công</b>
            <p>Đang mở trung tâm quản trị, vui lòng chờ...</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
