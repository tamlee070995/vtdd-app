"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

type CaptchaPayload = {
  question?: string;
  token?: string;
};

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme: "light" | "dark" | "auto";
    }
  ) => string;
  remove: (widgetId: string) => void;
};

type TurnstileWindow = Window & {
  turnstile?: TurnstileApi;
};

const SECURITY_QUESTIONS = [
  "Tên thú cưng đầu tiên của bạn là gì?",
  "Bạn sinh ra ở tỉnh/thành nào?",
  "Tên trường tiểu học của bạn là gì?",
  "Tên người bạn thân thời nhỏ của bạn là gì?",
  "Biển số xe đầu tiên của bạn là gì?",
];

const WAIT_MESSAGE = "Chờ thông tin hướng dẫn sử dụng từ admin.";

function normalizeUserInput(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function getErrorMessage(err: any) {
  return err?.message || "Không xử lý được yêu cầu. Vui lòng thử lại.";
}

function PasswordEyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.3 3.7 3.7 2.3l18 18-1.4 1.4-3.1-3.1A11.5 11.5 0 0 1 12 20C6.5 20 2.2 16.4 1 12c.5-1.9 1.7-3.7 3.4-5.1L2.3 3.7Zm5.2 5.2A5 5 0 0 0 12 17a5 5 0 0 0 2.6-.7l-2-2A2.7 2.7 0 0 1 9.7 11.4l-2.2-2.5ZM12 4c5.5 0 9.8 3.6 11 8a10.9 10.9 0 0 1-3 4.7l-2.8-2.8A5 5 0 0 0 10.1 6.8L7.9 4.6A11.8 11.8 0 0 1 12 4Zm0 3a5 5 0 0 1 5 5c0 .5-.1 1-.2 1.5L14.9 11.6A3 3 0 0 0 12.4 9.1l-1.9-1.9c.5-.1 1-.2 1.5-.2Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4c5.5 0 9.8 3.6 11 8-.2.9-.7 1.9-1.3 2.8A11.6 11.6 0 0 1 12 20C6.5 20 2.2 16.4 1 12c1.2-4.4 5.5-8 11-8Zm0 2C7.7 6 4.3 8.6 3.1 12c1.2 3.4 4.6 6 8.9 6s7.7-2.6 8.9-6C19.7 8.6 16.3 6 12 6Zm0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
    </svg>
  );
}

export default function AccountCheckPage() {
  const [mode, setMode] = useState<"check" | "exists" | "not-found" | "register" | "done">("check");
  const [userInput, setUserInput] = useState("");
  const [checkedUser, setCheckedUser] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaPayload>({});
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);
  const [formStartedAt, setFormStartedAt] = useState(() => String(Date.now()));
  const [questionType, setQuestionType] = useState(SECURITY_QUESTIONS[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    maST: "",
    staffName: "",
    password: "",
    confirmPassword: "",
    customQuestion: "",
    answer: "",
    gmail: "",
    captchaAnswer: "",
    emailOtp: "",
  });
  const [emailOtpMessage, setEmailOtpMessage] = useState("");
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileScriptReady, setTurnstileScriptReady] = useState(false);
  const [turnstileError, setTurnstileError] = useState("");
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileSiteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "").trim();

  const passwordHint = useMemo(() => {
    const password = form.password;
    const confirmPassword = form.confirmPassword;

    if (!password) return "Tối thiểu 6 ký tự, có chữ HOA, chữ thường, số và ký tự ! @ #.";
    if (password.length < 6) return "Mật khẩu phải có ít nhất 6 ký tự.";
    if (!/[A-Z]/.test(password)) return "Cần ít nhất 1 chữ HOA.";
    if (!/[a-z]/.test(password)) return "Cần ít nhất 1 chữ thường.";
    if (!/[0-9]/.test(password)) return "Cần ít nhất 1 số.";
    if (!/[!@#]/.test(password)) return "Cần ít nhất 1 ký tự đặc biệt: ! @ #.";
    if (confirmPassword && password !== confirmPassword) return "Mật khẩu xác nhận chưa khớp.";
    return "Mật khẩu hợp lệ.";
  }, [form.password, form.confirmPassword]);

  const gmailError = useMemo(() => {
    const value = form.gmail.trim().toLowerCase();
    if (!value) return "";
    if (value.includes(" ")) return "Gmail không được có khoảng trắng.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Gmail chưa đúng định dạng.";
    if (!value.endsWith("@gmail.com")) return "Chỉ dùng Gmail cá nhân @gmail.com.";
    return "";
  }, [form.gmail]);

  async function loadCaptcha() {
    try {
      setLoadingCaptcha(true);
      const res = await fetch("/api/auth/register-captcha", { cache: "no-store" });
      const data = await res.json();

      setCaptcha({
        question: data.question || data.captchaQuestion || "",
        token: data.token || data.captchaToken || "",
      });
      setForm((prev) => ({ ...prev, captchaAnswer: "" }));
    } catch {
      setCaptcha({ question: "Không tải được captcha", token: "" });
    } finally {
      setLoadingCaptcha(false);
    }
  }

  useEffect(() => {
    if (!turnstileSiteKey) return;

    let stopped = false;
    let tries = 0;

    const probeTurnstile = () => {
      if (stopped) return;

      const targetWindow = window as TurnstileWindow;

      if (targetWindow.turnstile?.render) {
        setTurnstileScriptReady(true);
        setTurnstileError("");
        return;
      }

      tries += 1;
      if (tries >= 40) {
        setTurnstileError("Không tải được xác thực chống spam. Vui lòng tải lại trang.");
        return;
      }

      window.setTimeout(probeTurnstile, 250);
    };

    probeTurnstile();

    return () => {
      stopped = true;
    };
  }, [turnstileSiteKey]);

  useEffect(() => {
    if (mode !== "register") return;
    if (!turnstileSiteKey || !turnstileScriptReady || !turnstileContainerRef.current) return;

    const targetWindow = window as TurnstileWindow;
    const turnstile = targetWindow.turnstile;
    const container = turnstileContainerRef.current;
    if (!turnstile) return;

    if (turnstileWidgetIdRef.current) {
      try {
        turnstile.remove(turnstileWidgetIdRef.current);
      } catch {
        // Widget can already be gone after fast navigation.
      }
      turnstileWidgetIdRef.current = null;
    }

    container.innerHTML = "";
    setTurnstileToken("");

    try {
      const widgetId = turnstile.render(container, {
        sitekey: turnstileSiteKey,
        callback: (token: string) => {
          setTurnstileToken(token || "");
          setTurnstileError("");
        },
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => {
          setTurnstileToken("");
          setTurnstileError("Turnstile chưa xác thực được. Vui lòng tải lại trang.");
        },
        theme: "light",
      });

      turnstileWidgetIdRef.current = widgetId;
      setTurnstileError("");
    } catch {
      setTurnstileToken("");
      setTurnstileError("Không khởi tạo được Turnstile. Vui lòng tải lại trang.");
    }

    return () => {
      if (!turnstileWidgetIdRef.current) return;

      try {
        turnstile.remove(turnstileWidgetIdRef.current);
      } catch {
        // Widget can already be gone after fast navigation.
      }
      turnstileWidgetIdRef.current = null;
    };
  }, [mode, turnstileScriptReady, turnstileSiteKey]);

  function updateForm(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function checkAccount(event?: FormEvent) {
    event?.preventDefault();
    const user = normalizeUserInput(userInput);

    if (!user) {
      setError("Vui lòng nhập mã user cần kiểm tra.");
      return;
    }

    try {
      setChecking(true);
      setError("");

      const res = await fetch("/api/auth/staff-account-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ user }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Không kiểm tra được tài khoản.");
      }

      setCheckedUser(data.maNV || user);
      setMode(data.exists ? "exists" : "not-found");
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setChecking(false);
    }
  }

  function openRegisterForm() {
    setError("");
    setMode("register");
    setFormStartedAt(String(Date.now()));
    setTurnstileToken("");
    setEmailOtpMessage("");
    loadCaptcha();
  }

  function resetAll() {
    setMode("check");
    setUserInput("");
    setCheckedUser("");
    setError("");
    setSubmitting(false);
    setFormStartedAt(String(Date.now()));
    setQuestionType(SECURITY_QUESTIONS[0]);
    setForm({
      maST: "",
      staffName: "",
      password: "",
      confirmPassword: "",
      customQuestion: "",
      answer: "",
      gmail: "",
      captchaAnswer: "",
      emailOtp: "",
    });
    setEmailOtpMessage("");
  }

  async function sendEmailOtp() {
    const maNV = normalizeUserInput(checkedUser || userInput);

    if (!maNV) return setError("Thiếu mã user cần gửi OTP.");
    if (!form.maST.trim()) return setError("Vui lòng nhập mã siêu thị trước khi gửi OTP.");
    if (!form.gmail.trim()) return setError("Vui lòng nhập Gmail xác thực trước khi gửi OTP.");
    if (gmailError) return setError(gmailError);
    if (!captcha.token || !form.captchaAnswer.trim()) {
      return setError("Vui lòng nhập captcha trước khi gửi OTP Gmail.");
    }

    try {
      setSendingEmailOtp(true);
      setEmailOtpMessage("");
      setError("");

      const res = await fetch("/api/auth/register-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          maNV,
          maST: form.maST,
          staffName: form.staffName,
          gmail: form.gmail,
          captchaToken: captcha.token || "",
          captchaAnswer: form.captchaAnswer,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Không gửi được OTP Gmail.");
      }

      updateForm("emailOtp", "");
      setEmailOtpMessage(data.message || "Đã gửi OTP Gmail. Vui lòng kiểm tra hộp thư.");
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setSendingEmailOtp(false);
    }
  }

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const maNV = normalizeUserInput(checkedUser || userInput);
    const question = questionType === "custom" ? form.customQuestion.trim() : questionType;

    if (!maNV) return setError("Thiếu mã user cần tạo tài khoản.");
    if (!form.maST.trim()) return setError("Vui lòng nhập mã siêu thị.");
    if (!form.staffName.trim()) return setError("Vui lòng nhập tên nhân viên.");
    if (passwordHint !== "Mật khẩu hợp lệ.") return setError(passwordHint);
    if (!question) return setError("Vui lòng nhập câu hỏi bảo mật.");
    if (!form.answer.trim()) return setError("Vui lòng nhập câu trả lời bảo mật.");
    if (gmailError) return setError(gmailError);
    if (!form.gmail.trim()) return setError("Vui lòng nhập Gmail xác thực.");
    if (!form.captchaAnswer.trim()) return setError("Vui lòng nhập kết quả captcha.");
    if (!/^\d{6}$/.test(form.emailOtp.trim())) return setError("OTP Gmail phải gồm đúng 6 số.");
    if (turnstileSiteKey && !turnstileToken) return setError("Vui lòng hoàn tất xác thực chống spam.");

    try {
      setSubmitting(true);
      setError("");

      const res = await fetch("/api/auth/staff-check-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          maNV,
          maST: form.maST,
          staffName: form.staffName,
          password: form.password,
          confirmPassword: form.confirmPassword,
          questionType,
          customQuestion: form.customQuestion,
          answer: form.answer,
          gmail: form.gmail,
          emailOtp: form.emailOtp,
          captchaToken: captcha.token || "",
          captchaAnswer: form.captchaAnswer,
          formStartedAt,
          companyWebsite: "",
          turnstileToken,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Không tạo được tài khoản.");
      }

      setMode("done");
    } catch (err: any) {
      setError(getErrorMessage(err));
      loadCaptcha();
      setTurnstileToken("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="account-check-page">
      <style>{styles}</style>

      {turnstileSiteKey ? (
        <Script
          id="account-check-turnstile-script"
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          async
          defer
          onReady={() => {
            setTurnstileScriptReady(true);
            setTurnstileError("");
          }}
          onLoad={() => setTurnstileScriptReady(true)}
          onError={() => {
            setTurnstileScriptReady(false);
            setTurnstileError("Không tải được xác thực chống spam. Vui lòng kiểm tra mạng.");
          }}
        />
      ) : null}

      <section className="account-check-shell">
        <header className="account-check-brand">
          <span className="account-check-logo">
            <img src="/mwg-logo.svg" alt="MWG" />
          </span>
          <div>
            <b>Viễn Thông Di Động</b>
            <em>Kiểm tra tài khoản</em>
          </div>
        </header>

        <section className="account-check-hero">
          <span>STAFF ACCOUNT</span>
          <h1>Kiểm tra trước khi tạo tài khoản.</h1>
          <p>Nhập user/mã nhân viên để kiểm tra tài khoản đã tồn tại trên hệ thống hay chưa.</p>
        </section>

        <section className="account-check-card">
          {mode === "check" && (
            <form onSubmit={checkAccount} className="account-check-form">
              <div className="account-check-step">
                <i>01</i>
                <div>
                  <h2>Nhập user cần kiểm tra</h2>
                  <p>Chỉ nhập số, ví dụ: 12345.</p>
                </div>
              </div>

              <label className="account-check-field">
                <span>User / mã nhân viên</span>
                <input
                  value={userInput}
                  onChange={(e) => setUserInput(normalizeUserInput(e.target.value))}
                  placeholder="12345"
                  autoComplete="off"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </label>

              {error && <div className="account-check-alert error">{error}</div>}

              <button type="submit" className="account-check-primary" disabled={checking}>
                {checking ? "Đang kiểm tra..." : "Kiểm tra tài khoản"}
              </button>
            </form>
          )}

          {mode === "exists" && (
            <div className="account-check-result">
              <div className="account-check-icon ok">✓</div>
              <span>Đã có tài khoản</span>
              <h2>Bạn đã có tài khoản</h2>
              <p className="account-check-admin-wait">{WAIT_MESSAGE}</p>
              <button type="button" className="account-check-secondary" onClick={resetAll}>
                Kiểm tra user khác
              </button>
            </div>
          )}

          {mode === "not-found" && (
            <div className="account-check-result">
              <div className="account-check-icon warn">!</div>
              <span>Chưa có tài khoản</span>
              <h2>User {checkedUser} chưa có tài khoản, bạn có thể tạo tài khoản với User hợp lệ, nếu SPAM sẽ bị chặn vĩnh viễn</h2>
              <button type="button" className="account-check-primary" onClick={openRegisterForm}>
                Tạo tài khoản mới
              </button>
              <button type="button" className="account-check-secondary" onClick={resetAll}>
                Nhập user khác
              </button>
            </div>
          )}

          {mode === "register" && (
            <form className="account-check-register" onSubmit={submitRegister} noValidate>
              <div className="account-check-step">
                <i>02</i>
                <div>
                  <h2>Tạo tài khoản mới</h2>
                  <p>User {checkedUser} sẽ được gửi admin duyệt sau khi tạo.</p>
                </div>
              </div>

              {error && <div className="account-check-alert error">{error}</div>}

              <div className="account-check-grid two">
                <label className="account-check-field">
                  <span>Mã nhân viên</span>
                  <input value={`${checkedUser}`} readOnly inputMode="numeric" pattern="[0-9]*" />
                </label>
                <label className="account-check-field">
                  <span>Mã siêu thị</span>
                  <input
                    value={form.maST}
                    onChange={(e) => updateForm("maST", e.target.value)}
                    placeholder="VD: 1234"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </label>
              </div>

              <label className="account-check-field">
                <span>Tên nhân viên</span>
                <input
                  value={form.staffName}
                  onChange={(e) => updateForm("staffName", e.target.value)}
                  placeholder="Nguyễn Văn A"
                  autoComplete="name"
                />
              </label>

              <div className="account-check-grid two">
                <label className="account-check-field">
                  <span>Mật khẩu</span>
                  <div className="account-check-password">
                    <input
                      type="text"
                      className={showPassword ? "" : "masked"}
                      value={form.password}
                      onChange={(e) => updateForm("password", e.target.value)}
                      placeholder="Nhập mật khẩu"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                      <PasswordEyeIcon hidden={showPassword} />
                    </button>
                  </div>
                </label>

                <label className="account-check-field">
                  <span>Xác nhận mật khẩu</span>
                  <div className="account-check-password">
                    <input
                      type="text"
                      className={showConfirmPassword ? "" : "masked"}
                      value={form.confirmPassword}
                      onChange={(e) => updateForm("confirmPassword", e.target.value)}
                      placeholder="Nhập lại mật khẩu"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                      <PasswordEyeIcon hidden={showConfirmPassword} />
                    </button>
                  </div>
                </label>
              </div>

              <div className={passwordHint === "Mật khẩu hợp lệ." ? "account-check-rule ok" : "account-check-rule"}>
                {passwordHint}
              </div>

              <label className="account-check-field">
                <span>Câu hỏi bảo mật</span>
                <select value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
                  {SECURITY_QUESTIONS.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                  <option value="custom">Tự tạo câu hỏi riêng</option>
                </select>
              </label>

              {questionType === "custom" && (
                <label className="account-check-field">
                  <span>Câu hỏi tự tạo</span>
                  <input
                    value={form.customQuestion}
                    onChange={(e) => updateForm("customQuestion", e.target.value)}
                    placeholder="Nhập câu hỏi bảo mật riêng"
                  />
                </label>
              )}

              <div className="account-check-grid two">
                <label className="account-check-field">
                  <span>Câu trả lời bảo mật</span>
                  <input
                    value={form.answer}
                    onChange={(e) => updateForm("answer", e.target.value)}
                    placeholder="Nhập câu trả lời"
                    autoComplete="off"
                  />
                </label>
                <label className="account-check-field">
                  <span>Gmail xác thực</span>
                  <input
                    type="email"
                    value={form.gmail}
                    onChange={(e) => {
                      updateForm("gmail", e.target.value);
                      updateForm("emailOtp", "");
                      setEmailOtpMessage("");
                    }}
                    placeholder="ten@gmail.com"
                    autoComplete="email"
                  />
                </label>
              </div>

              {gmailError ? <div className="account-check-alert mini-error">{gmailError}</div> : null}

              <label className="account-check-field">
                <span>Captcha</span>
                <div className="account-check-captcha">
                  <strong>{loadingCaptcha ? "Đang tải..." : captcha.question || "Bấm tải lại captcha"}</strong>
                  <button type="button" onClick={loadCaptcha} disabled={submitting}>
                    Tải lại
                  </button>
                </div>
                <input
                  value={form.captchaAnswer}
                  onChange={(e) => updateForm("captchaAnswer", e.target.value)}
                  placeholder="Nhập kết quả"
                  inputMode="numeric"
                />
              </label>

              <div className="account-check-otp-box">
                <div>
                  <span>OTP Gmail</span>
                  <p>Nhập captcha rồi bấm gửi OTP. Mã có hiệu lực trong 10 phút.</p>
                </div>
                <button type="button" onClick={sendEmailOtp} disabled={submitting || sendingEmailOtp}>
                  {sendingEmailOtp ? "Đang gửi..." : "Gửi OTP Gmail"}
                </button>
              </div>

              <label className="account-check-field">
                <span>Mã OTP Gmail</span>
                <input
                  value={form.emailOtp}
                  onChange={(e) => updateForm("emailOtp", e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Nhập 6 số trong Gmail"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </label>

              {emailOtpMessage ? <div className="account-check-alert mini-ok">{emailOtpMessage}</div> : null}

              {turnstileSiteKey ? (
                <div className="account-check-turnstile">
                  <div ref={turnstileContainerRef} className="account-check-turnstile-frame" />
                  {!turnstileScriptReady && !turnstileError ? (
                    <span>Đang tải xác thực chống spam...</span>
                  ) : null}
                  {turnstileError ? <span className="error">{turnstileError}</span> : null}
                </div>
              ) : null}

              <button type="submit" className="account-check-primary" disabled={submitting}>
                {submitting ? "Đang tạo tài khoản..." : "Tạo tài khoản chờ duyệt"}
              </button>
              <button type="button" className="account-check-secondary" onClick={resetAll} disabled={submitting}>
                Hủy và nhập user khác
              </button>
            </form>
          )}

          {mode === "done" && (
            <div className="account-check-result">
              <div className="account-check-icon ok">✓</div>
              <span>Đã gửi yêu cầu</span>
              <h2>Tạo tài khoản thành công</h2>
              <p className="account-check-admin-wait">{WAIT_MESSAGE}</p>
              <button type="button" className="account-check-primary" onClick={resetAll}>
                Kiểm tra user khác
              </button>
            </div>
          )}
        </section>
      </section>

      {submitting && mode === "register" ? (
        <div className="account-check-processing" role="alertdialog" aria-modal="true">
          <div>
            <i />
            <span>ĐANG XỬ LÝ</span>
            <h2>Đang tạo tài khoản</h2>
            <p>Vui lòng chờ, hệ thống đang kiểm tra thông tin và gửi yêu cầu đến admin.</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

const styles = `
.account-check-page {
  min-height: 100dvh;
  padding: max(14px, env(safe-area-inset-top)) 12px max(24px, env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 12% 0%, rgba(255, 212, 0, .22), transparent 32%),
    radial-gradient(circle at 92% 18%, rgba(20, 184, 166, .14), transparent 34%),
    linear-gradient(180deg, #f8fafc, #eaf0f6);
  color: #07111f;
  font-family: Roboto, Arial, sans-serif;
}

.account-check-shell {
  width: min(100%, 620px);
  margin: 0 auto;
  display: grid;
  gap: 14px;
}

.account-check-brand {
  min-height: 68px;
  padding: 10px;
  border-radius: 28px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #07111f;
  color: #fff;
  box-shadow: 0 20px 60px rgba(15, 23, 42, .12);
}

.account-check-logo {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: #ffd400;
}

.account-check-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.account-check-brand b {
  display: block;
  font-size: 18px;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: -.04em;
}

.account-check-brand em {
  display: block;
  margin-top: 5px;
  color: #cbd5e1;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.account-check-hero {
  min-height: 230px;
  padding: clamp(22px, 5vw, 34px);
  border-radius: 34px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  color: #fff;
  background:
    linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px),
    radial-gradient(circle at 88% 12%, rgba(255, 212, 0, .55), transparent 34%),
    linear-gradient(135deg, #0f172a, #020617 68%);
  background-size: 24px 24px, 24px 24px, auto, auto;
  box-shadow: 0 26px 80px rgba(15, 23, 42, .16);
}

.account-check-hero span,
.account-check-result > span {
  width: fit-content;
  padding: 8px 12px;
  border-radius: 999px;
  background: #07111f;
  color: #ffd400;
  font-size: 10px;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.account-check-hero h1 {
  margin: 15px 0 0;
  font-size: clamp(38px, 8vw, 62px);
  line-height: .92;
  font-weight: 1000;
  letter-spacing: -.075em;
}

.account-check-hero p {
  max-width: 420px;
  margin: 16px 0 0;
  color: rgba(255,255,255,.78);
  font-size: 14px;
  line-height: 1.55;
  font-weight: 850;
}

.account-check-card {
  padding: clamp(16px, 3vw, 24px);
  border-radius: 32px;
  background: rgba(255,255,255,.95);
  border: 1px solid #dbe4ef;
  box-shadow: 0 24px 80px rgba(15, 23, 42, .08);
}

.account-check-form,
.account-check-register,
.account-check-result {
  display: grid;
  gap: 14px;
}

.account-check-result {
  text-align: center;
  justify-items: center;
  padding: 10px 0;
}

.account-check-step {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
}

.account-check-step i {
  width: 46px;
  height: 46px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  background: #07111f;
  color: #ffd400;
  font-style: normal;
  font-size: 12px;
  font-weight: 1000;
}

.account-check-step h2,
.account-check-result h2 {
  margin: 0;
  color: #07111f;
  font-size: 27px;
  line-height: 1.05;
  font-weight: 1000;
  letter-spacing: -.055em;
}

.account-check-step p,
.account-check-result p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 850;
}

.account-check-result p.account-check-admin-wait {
  color: #dc2626;
  font-weight: 1000;
}

.account-check-grid.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.account-check-field {
  display: grid;
  gap: 7px;
}

.account-check-field span {
  color: #475569;
  font-size: 11px;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.account-check-field input,
.account-check-field select {
  width: 100%;
  min-height: 52px;
  border: 1px solid #cbd5e1;
  border-radius: 17px;
  padding: 0 14px;
  background: #f8fafc;
  color: #07111f;
  outline: none;
  font-size: 16px;
  font-weight: 850;
}

.account-check-field input:focus,
.account-check-field select:focus {
  background: #fff;
  border-color: #ffd400;
  box-shadow: 0 0 0 4px rgba(255, 212, 0, .18);
}

.account-check-field input[readonly] {
  background: #eef2f7;
  color: #64748b;
}

.account-check-password {
  min-height: 52px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 5px;
  border: 1px solid #cbd5e1;
  border-radius: 17px;
  background: #f8fafc;
}

.account-check-password input {
  min-height: 42px;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.account-check-password input.masked {
  -webkit-text-security: disc;
  text-security: disc;
}

.account-check-password button,
.account-check-captcha button {
  min-height: 38px;
  border: 0;
  border-radius: 13px;
  padding: 0 13px;
  background: #07111f;
  color: #ffd400;
  font-size: 11px;
  font-weight: 1000;
  cursor: pointer;
}

.account-check-password button {
  width: 42px;
  min-width: 42px;
  padding: 0;
  display: grid;
  place-items: center;
}

.account-check-password button svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
  pointer-events: none;
}

.account-check-rule,
.account-check-alert {
  padding: 12px 14px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 900;
}

.account-check-rule {
  background: #f8fafc;
  color: #64748b;
}

.account-check-rule.ok,
.account-check-alert.mini-ok {
  background: #dcfce7;
  color: #047857;
  border: 1px solid #bbf7d0;
}

.account-check-alert.error,
.account-check-alert.mini-error {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.account-check-captcha {
  min-height: 52px;
  padding: 6px;
  border: 1px solid #cbd5e1;
  border-radius: 17px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: #fff;
}

.account-check-captcha strong {
  padding-left: 8px;
  color: #07111f;
  font-size: 15px;
  font-weight: 1000;
}

.account-check-otp-box {
  padding: 12px;
  border: 1px solid #fde68a;
  border-radius: 18px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
  background: linear-gradient(135deg, #fffbeb, #ffffff);
}

.account-check-otp-box span {
  display: block;
  color: #07111f;
  font-size: 12px;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.account-check-otp-box p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
  font-weight: 850;
}

.account-check-otp-box button {
  min-height: 42px;
  border: 0;
  border-radius: 14px;
  padding: 0 14px;
  background: #07111f;
  color: #ffd400;
  font-size: 11px;
  font-weight: 1000;
  cursor: pointer;
  white-space: nowrap;
}

.account-check-otp-box button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.account-check-turnstile {
  min-height: 65px;
  display: grid;
  place-items: center;
  gap: 8px;
}

.account-check-turnstile span {
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
  text-align: center;
}

.account-check-turnstile span.error {
  padding: 9px 12px;
  border-radius: 12px;
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.account-check-primary,
.account-check-secondary {
  width: 100%;
  min-height: 54px;
  border-radius: 18px;
  font-size: 13px;
  font-weight: 1000;
  letter-spacing: .05em;
  text-transform: uppercase;
  cursor: pointer;
}

.account-check-primary {
  border: 0;
  background: #ffd400;
  color: #07111f;
  box-shadow: 0 14px 34px rgba(255, 212, 0, .22);
}

.account-check-secondary {
  border: 1px solid #dbe4ef;
  background: #fff;
  color: #07111f;
  box-shadow: none;
}

.account-check-primary:disabled,
.account-check-secondary:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.account-check-icon {
  width: 68px;
  height: 68px;
  border-radius: 24px;
  display: grid;
  place-items: center;
  font-size: 34px;
  font-weight: 1000;
}

.account-check-icon.ok {
  background: #dcfce7;
  color: #047857;
  box-shadow: 0 0 0 8px rgba(22, 163, 74, .08);
}

.account-check-icon.warn {
  background: #fffbeb;
  color: #b45309;
  box-shadow: 0 0 0 8px rgba(245, 158, 11, .1);
}

.account-check-processing {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(2, 6, 23, .58);
  backdrop-filter: blur(10px);
}

.account-check-processing > div {
  width: min(100%, 420px);
  padding: 28px;
  border-radius: 28px;
  background: #fff;
  text-align: center;
  box-shadow: 0 34px 110px rgba(2, 6, 23, .32);
}

.account-check-processing i {
  width: 62px;
  height: 62px;
  margin: 0 auto 16px;
  border-radius: 999px;
  display: block;
  border: 7px solid #e2e8f0;
  border-top-color: #ffd400;
  box-shadow: inset 0 0 0 6px #07111f;
  animation: accountCheckSpin .72s linear infinite;
}

.account-check-processing span {
  display: inline-flex;
  padding: 8px 12px;
  border-radius: 999px;
  background: #07111f;
  color: #ffd400;
  font-size: 10px;
  font-weight: 1000;
  letter-spacing: .12em;
}

.account-check-processing h2 {
  margin: 13px 0 0;
  color: #07111f;
  font-size: 25px;
  line-height: 1.1;
  font-weight: 1000;
  letter-spacing: -.04em;
}

.account-check-processing p {
  margin: 12px 0 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.55;
  font-weight: 850;
}

@keyframes accountCheckSpin {
  to { transform: rotate(360deg); }
}

@media (max-width: 560px) {
  .account-check-page {
    padding: 10px;
  }

  .account-check-grid.two {
    grid-template-columns: 1fr;
  }

  .account-check-otp-box {
    grid-template-columns: 1fr;
  }

  .account-check-hero {
    min-height: 230px;
    border-radius: 30px;
  }

  .account-check-card {
    border-radius: 28px;
  }
}
`;
