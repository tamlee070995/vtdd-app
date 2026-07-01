"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import PasswordInput from "@/components/PasswordInput";

type StaffLoginFormProps = {
  initialError?: string;
  next?: string;
};

export default function StaffLoginForm({ initialError = "", next = "" }: StaffLoginFormProps) {
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (loading) {
      e.preventDefault();
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);
    const maNV = String(formData.get("maNV") || "").trim();
    const password = String(formData.get("password") || "").trim();

    if (!maNV || !password) {
      e.preventDefault();
      setError("Vui lòng nhập mã nhân viên và mật khẩu.");
      return;
    }

    setError("");
    setLoading(true);
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
        readOnly={loading}
        aria-disabled={loading}
      />

      <label htmlFor="password">Mật khẩu</label>
      <PasswordInput
        id="password"
        name="password"
        placeholder="Nhập mật khẩu"
        autoComplete="current-password"
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
