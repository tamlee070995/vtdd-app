"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import PasswordInput from "@/components/PasswordInput";

type StaffLoginFormProps = {
  initialError?: string;
  next?: string;
};

export default function StaffLoginForm({ initialError = "", next = "" }: StaffLoginFormProps) {
  const [maNV, setMaNV] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) {
      return;
    }

    const cleanMaNV = maNV.trim();
    const cleanPassword = password.trim();

    if (!cleanMaNV || !cleanPassword) {
      setError("Vui lòng nhập mã nhân viên và mật khẩu.");
      return;
    }

    try {
      setError("");
      setLoading(true);

      const res = await fetch("/api/auth/staff-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Cache-Control": "no-store",
        },
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify({ maNV: cleanMaNV, password: cleanPassword, next }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setError(data?.message || "Không đăng nhập được. Vui lòng thử lại.");
        setLoading(false);
        return;
      }

      window.location.assign(data.redirectTo || next || "/staff");
    } catch {
      setError("Không đăng nhập được. Vui lòng kiểm tra kết nối và thử lại.");
      setLoading(false);
    }
  }

  return (
    <form className="staff-auth-form" action="/api/auth/staff-login" method="POST" noValidate onSubmit={handleSubmit}>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="staff-auth-form-head">
        <span>01</span>
        <div>
          <h2>Đăng nhập nhân viên</h2>
          <p>Dành cho tài khoản đã được duyệt sử dụng.</p>
        </div>
      </div>

      <label htmlFor="maNV">Mã nhân viên</label>
      <input
        id="maNV"
        name="maNV"
        type="text"
        inputMode="text"
        placeholder="NV12345"
        autoComplete="username"
        value={maNV}
        onChange={(e) => setMaNV(e.target.value)}
        readOnly={loading}
        aria-disabled={loading}
      />

      <label htmlFor="password">Mật khẩu</label>
      <PasswordInput
        id="password"
        name="password"
        placeholder="Nhập mật khẩu"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        readOnly={loading}
        aria-disabled={loading}
      />

      {error ? (
        <div className="staff-auth-error" role="alert">
          <b>Không đăng nhập được</b>
          <span>{error}</span>
        </div>
      ) : null}

      <button type="submit" disabled={loading} aria-busy={loading}>
        {loading ? "Đang xác thực..." : "Đăng nhập hệ thống"}
      </button>

      <div className="staff-auth-actions">
        <Link href="/register" aria-disabled={loading}>
          Tạo tài khoản
        </Link>
        <Link href="/forgot-password" aria-disabled={loading}>
          Quên mật khẩu
        </Link>
      </div>
    </form>
  );
}
