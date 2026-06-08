"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PasswordInput from "@/components/PasswordInput";

export default function ForgotPasswordPage() {
  const [maNV, setMaNV] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"request" | "reset">("request");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "">("");
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
  if (resendCountdown <= 0) return;

  const timer = window.setInterval(() => {
    setResendCountdown((v) => Math.max(0, v - 1));
  }, 1000);

  return () => window.clearInterval(timer);
}, [resendCountdown]);

  function showMsg(type: "error" | "success", text: string) {
    setMessageType(type);
    setMessage(text);
  }

  async function requestOtp() {
    const nv = maNV.trim();

    if (!nv) {
      showMsg("error", "Vui lòng nhập mã nhân viên.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        cache: "no-store",
        body: JSON.stringify({ maNV: nv }),
      });

      const data = await res.json();

      if (!data.success) {
        if (data.retryAfterSec) {
            setResendCountdown(Number(data.retryAfterSec || 0));
        }

        showMsg("error", data.message || "Không gửi được mã xác thực.");
        setLoading(false);
        return;
        }

      showMsg("success", data.message || "Đã gửi mã xác thực.");
        setStep("reset");
        setResendCountdown(Number(data.retryAfterSec || 600));
        setLoading(false);
    } catch {
      showMsg("error", "Lỗi kết nối. Vui lòng thử lại.");
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (!maNV.trim() || !otp.trim() || !newPassword || !confirmPassword) {
      showMsg("error", "Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        cache: "no-store",
        body: JSON.stringify({
          maNV: maNV.trim(),
          otp: otp.trim(),
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        showMsg("error", data.message || "Không đặt lại được mật khẩu.");
        setLoading(false);
        return;
      }

      showMsg("success", data.message || "Đã đặt lại mật khẩu.");
      setLoading(false);

      setTimeout(() => {
        window.location.href = "/login";
      }, 1400);
    } catch {
      showMsg("error", "Lỗi kết nối. Vui lòng thử lại.");
      setLoading(false);
    }
  }

  return (
    <main className="login-page-v2 forgot-page-v2">
      <section className="login-card-v2">
        <div className="login-brand-v2">
          <div className="brand-mark">
            <img src="/mwg-logo.svg" alt="MWG" />
          </div>
          <div>
            <div className="brand-title">Viễn Thông Di Động</div>
            <div className="brand-subtitle">Password Recovery</div>
          </div>
        </div>

        <section className="forgot-hero-v2">
          <div className="hero-kicker">SECURE RECOVERY</div>
          <h1>
            QUÊN
            <span>MẬT KHẨU</span>
          </h1>
          <p>Nhận mã xác thực qua Gmail đã đăng ký để đặt lại mật khẩu nhân viên.</p>
        </section>

        <section className="forgot-card-v2">
          <div className="forgot-step-pill">
            {step === "request" ? "BƯỚC 1 / GỬI MÃ OTP" : "BƯỚC 2 / ĐẶT LẠI MẬT KHẨU"}
          </div>

          <label>Mã nhân viên</label>
          <input
            inputMode="numeric"
            value={maNV}
            onChange={(e) => setMaNV(e.target.value)}
            placeholder="VD: NV001"
            disabled={step === "reset"}
          />

          {step === "reset" && (
            <>
              <label>Mã OTP</label>
              <input
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Nhập 6 số trong Gmail"
              />

              <label>Mật khẩu mới</label>
                <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                autoComplete="new-password"
                />

              <label>Xác nhận mật khẩu mới</label>
                <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                autoComplete="new-password"
                />
            </>
          )}

          {message ? (
            <div className={messageType === "success" ? "staff-success-banner" : "staff-error-banner"}>
              {messageType === "success" ? "✅ " : "⚠️ "}
              {message}
            </div>
          ) : null}

          {step === "request" ? (
            <button className="forgot-main-btn" type="button" onClick={requestOtp} disabled={loading}>
              {loading ? "ĐANG GỬI MÃ..." : "GỬI MÃ XÁC THỰC"}
            </button>
          ) : (
            <>
              <button className="forgot-main-btn" type="button" onClick={resetPassword} disabled={loading}>
                {loading ? "ĐANG ĐẶT LẠI..." : "ĐẶT LẠI MẬT KHẨU"}
              </button>

              <button
                className="forgot-secondary-btn"
                type="button"
                onClick={requestOtp}
                disabled={loading || resendCountdown > 0}
                >
                {resendCountdown > 0
                    ? `GỬI LẠI SAU ${Math.floor(resendCountdown / 60)}:${String(resendCountdown % 60).padStart(2, "0")}`
                    : "GỬI LẠI MÃ OTP"}
                </button>
            </>
          )}

          <Link className="forgot-back-btn" href="/login">
            QUAY LẠI ĐĂNG NHẬP
          </Link>
        </section>
      </section>
    </main>
  );
}