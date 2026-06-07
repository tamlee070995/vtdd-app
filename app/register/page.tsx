"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PasswordInput from "@/components/PasswordInput";

const SECURITY_QUESTIONS = [
  "Tên thú cưng đầu tiên của bạn là gì?",
  "Tên giáo viên chủ nhiệm đầu tiên của bạn là gì?",
  "Món ăn yêu thích của bạn là gì?",
  "Tên người bạn thân nhất thời đi học là gì?",
];

function checkPasswordRule(password: string) {
  if (password.length < 6) {
    return "Mật khẩu phải có ít nhất 6 ký tự.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Mật khẩu phải có ít nhất 1 ký tự viết HOA.";
  }

  if (!/[a-z]/.test(password)) {
    return "Mật khẩu phải có ít nhất 1 ký tự viết thường.";
  }

  if (!/[0-9]/.test(password)) {
    return "Mật khẩu phải có ít nhất 1 số.";
  }

  if (!/[!@#]/.test(password)) {
    return "Mật khẩu phải có ít nhất 1 ký tự đặc biệt: !, @ hoặc #.";
  }

  return "";
}

function checkGmailRule(gmail: string) {
  const value = String(gmail || "").trim().toLowerCase();

  if (!value) {
    return "";
  }

  if (value.includes(" ")) {
    return "Gmail không được có khoảng trắng.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Gmail chưa đúng định dạng.";
  }

  if (!value.endsWith("@gmail.com")) {
    return "Gmail xác thực phải là địa chỉ @gmail.com.";
  }

  return "";
}

export default function RegisterPage() {
  const [questionType, setQuestionType] = useState("");
  const [captchaQuestion, setCaptchaQuestion] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [gmail, setGmail] = useState("");
  const [gmailTouched, setGmailTouched] = useState(false);

  const isSuccess = !!success;

  const passwordError = password ? checkPasswordRule(password) : "";

  const confirmError =
    confirmPassword && password !== confirmPassword
      ? "Mật khẩu xác nhận chưa khớp."
      : "";

  const gmailError = checkGmailRule(gmail);
  const showGmailError = gmailTouched && !!gmailError;

  async function loadCaptcha() {
    try {
      setCaptchaLoading(true);

      const res = await fetch("/api/auth/register-captcha", {
        cache: "no-store",
      });

      const data = await res.json();

      if (data.success) {
        setCaptchaQuestion(data.question || "");
        setCaptchaToken(data.token || "");
      }

      setCaptchaLoading(false);
    } catch {
      setCaptchaLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    setError("");
    setGmailTouched(true);

    const passwordRuleError = checkPasswordRule(password);
    const gmailRuleError = checkGmailRule(gmail);

    if (passwordRuleError) {
      e.preventDefault();
      setError(passwordRuleError);
      return;
    }

    if (password !== confirmPassword) {
      e.preventDefault();
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    if (gmailRuleError) {
      e.preventDefault();
      setError(gmailRuleError);
      return;
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorMessage = params.get("error") || "";
    const successMessage = params.get("success") || "";

    setError(errorMessage);
    setSuccess(successMessage);

    if (!successMessage) {
      loadCaptcha();
    }
  }, []);

  return (
    <main
      className={
        isSuccess
          ? "login-page-v2 register-page-compact register-success-active"
          : "login-page-v2 register-page-compact"
      }
    >
      <section className="login-card-v2 register-page-content">
        <div className="login-brand-v2">
          <div className="brand-mark">VT</div>
          <div>
            <div className="brand-title">VTDD.ONLINE</div>
            <div className="brand-subtitle">Create Staff Account</div>
          </div>
        </div>

        <section className="register-hero-compact">
          <div className="hero-kicker">NEW ACCOUNT</div>
          <h1>
            TẠO MỚI
            <span>TÀI KHOẢN</span>
          </h1>
          <p>
            Tài khoản sẽ ở trạng thái chờ duyệt. Admin duyệt xong mới đăng nhập được.
          </p>
        </section>

        <form
          className="register-form-compact"
          action="/api/auth/staff-register"
          method="POST"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="register-grid-2">
            <div className="register-field">
              <label htmlFor="maNV">Mã nhân viên</label>
              <input
                id="maNV"
                name="maNV"
                inputMode="numeric"
                placeholder="VD: 36964"
                disabled={isSuccess}
              />
            </div>

            <div className="register-field">
              <label htmlFor="staffName">Tên nhân viên</label>
              <input
                id="staffName"
                name="staffName"
                placeholder="VD: Lê Minh Tâm"
                disabled={isSuccess}
              />
            </div>
          </div>

          <div className="register-field">
            <label htmlFor="password">Mật khẩu</label>
            <PasswordInput
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              autoComplete="new-password"
              disabled={isSuccess}
            />

            <div className={passwordError ? "register-password-rule error" : "register-password-rule"}>
              Tối thiểu 6 ký tự, có chữ HOA, chữ thường, số và ký tự ! @ #
            </div>
          </div>

          <div className="register-field">
            <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
              disabled={isSuccess}
            />

            {confirmError ? (
              <div className="register-password-rule error">{confirmError}</div>
            ) : null}
          </div>

          <div className="register-field">
            <label htmlFor="questionType">Câu hỏi bảo mật</label>
            <select
              id="questionType"
              name="questionType"
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              disabled={isSuccess}
            >
              <option value="">Chọn câu hỏi bảo mật</option>
              {SECURITY_QUESTIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
              <option value="custom">Tự tạo câu hỏi riêng</option>
            </select>
          </div>

          {questionType === "custom" && (
            <div className="register-custom-box">
              <div className="register-field">
                <label htmlFor="customQuestion">Câu hỏi tự tạo</label>
                <input
                  id="customQuestion"
                  name="customQuestion"
                  placeholder="VD: Biệt danh hồi nhỏ của bạn là gì?"
                  disabled={isSuccess}
                />
              </div>
            </div>
          )}

          <div className="register-field">
            <label htmlFor="answer">Câu trả lời bảo mật</label>
            <input
              id="answer"
              name="answer"
              placeholder="Nhập câu trả lời bảo mật"
              autoComplete="off"
              disabled={isSuccess}
            />
          </div>

          <div className="register-field">
            <label htmlFor="gmail">Gmail xác thực</label>
            <input
              id="gmail"
              name="gmail"
              type="email"
              value={gmail}
              onChange={(e) => {
                setGmail(e.target.value.trim().toLowerCase());
                setGmailTouched(true);
              }}
              onBlur={() => setGmailTouched(true)}
              placeholder="VD: ten@gmail.com"
              disabled={isSuccess}
            />

            {showGmailError && (
            <div className="register-password-rule error">{gmailError}</div>
            )}
          </div>

          <div className="register-captcha-box">
            <div>
              <span>CAPTCHA</span>
              <b>{captchaLoading ? "Đang tạo..." : captchaQuestion || "Bấm đổi mã"}</b>
            </div>

            <button type="button" onClick={loadCaptcha} disabled={isSuccess}>
              Đổi mã
            </button>
          </div>

          <input type="hidden" name="captchaToken" value={captchaToken} />

          <div className="register-field">
            <label htmlFor="captchaAnswer">Nhập kết quả captcha</label>
            <input
              id="captchaAnswer"
              name="captchaAnswer"
              inputMode="numeric"
              placeholder="VD: 12"
              autoComplete="off"
              disabled={isSuccess}
            />
          </div>

          {error ? <div className="staff-error-banner">⚠️ {error}</div> : null}

          {!isSuccess && (
            <button className="register-submit-btn compact" type="submit">
              TẠO TÀI KHOẢN CHỜ DUYỆT
            </button>
          )}

          <Link className="register-back-btn compact" href="/login">
            QUAY LẠI ĐĂNG NHẬP
          </Link>
        </form>
      </section>

      {isSuccess && (
        <section className="register-success-layer" role="dialog" aria-modal="true">
          <div className="register-success-popup">
            <div className="register-success-icon">✓</div>

            <div className="register-success-kicker">TẠO TÀI KHOẢN THÀNH CÔNG</div>

            <h2>Đang chờ Admin duyệt</h2>

            <p>
              Tài khoản đã được ghi nhận trên hệ thống. Vui lòng chờ Admin kích hoạt,
              sau đó đăng nhập lại để tiếp tục sử dụng.
            </p>

            <div className="register-success-message">
              {success || "Đã tạo tài khoản chờ duyệt. Vui lòng liên hệ Admin để được kích hoạt."}
            </div>

            <Link className="register-success-login-btn" href="/login">
              QUAY LẠI ĐĂNG NHẬP
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}