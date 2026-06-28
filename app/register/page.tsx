"use client";

import Link from "next/link";
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

function getParam(name: string) {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) || "";
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

export default function RegisterPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaPayload>({});
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);
  const [questionType, setQuestionType] = useState(SECURITY_QUESTIONS[0]);
  const [gmail, setGmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formStartedAt] = useState(() => String(Date.now()));
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileScriptReady, setTurnstileScriptReady] = useState(false);
  const [turnstileError, setTurnstileError] = useState("");
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileSiteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "").trim();

  const gmailError = useMemo(() => {
    const value = gmail.trim().toLowerCase();

    if (!value) return "";
    if (value.includes(" ")) return "Gmail không được có khoảng trắng.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Gmail chưa đúng định dạng.";
    if (!value.endsWith("@gmail.com")) return "Chỉ dùng Gmail cá nhân @gmail.com.";

    return "";
  }, [gmail]);

  const passwordHint = useMemo(() => {
    if (!password) return "Tối thiểu 6 ký tự, có chữ HOA, chữ thường, số và ký tự ! @ #.";
    if (password.length < 6) return "Mật khẩu phải có ít nhất 6 ký tự.";
    if (!/[A-Z]/.test(password)) return "Cần ít nhất 1 chữ HOA.";
    if (!/[a-z]/.test(password)) return "Cần ít nhất 1 chữ thường.";
    if (!/[0-9]/.test(password)) return "Cần ít nhất 1 số.";
    if (!/[!@#]/.test(password)) return "Cần ít nhất 1 ký tự đặc biệt: ! @ #.";
    if (confirmPassword && password !== confirmPassword) return "Mật khẩu xác nhận chưa khớp.";
    return "Mật khẩu hợp lệ.";
  }, [password, confirmPassword]);

  async function loadCaptcha() {
    try {
      setLoadingCaptcha(true);
      const res = await fetch("/api/auth/register-captcha", { cache: "no-store" });
      const data = await res.json();

      setCaptcha({
        question: data.question || data.captchaQuestion || "",
        token: data.token || data.captchaToken || "",
      });
    } catch {
      setCaptcha({ question: "Không tải được captcha", token: "" });
    } finally {
      setLoadingCaptcha(false);
    }
  }

  useEffect(() => {
    setError(getParam("error"));
    setSuccess(getParam("success"));
    loadCaptcha();
  }, []);

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
        setTurnstileError("Không tải được xác thực chống spam. Vui lòng tải lại trang hoặc kiểm tra domain Turnstile.");
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
    if (!turnstileSiteKey || !turnstileScriptReady || !turnstileContainerRef.current) return;

    const targetWindow = window as TurnstileWindow;
    const turnstile = targetWindow.turnstile;
    const container = turnstileContainerRef.current;

    if (!turnstile) return;

    if (turnstileWidgetIdRef.current) {
      try {
        turnstile.remove(turnstileWidgetIdRef.current);
      } catch {
        // Widget can already be gone after a fast refresh.
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
          setTurnstileError("Turnstile chưa xác thực được. Vui lòng tải lại trang hoặc kiểm tra domain đã khai báo.");
        },
        theme: "light",
      });

      turnstileWidgetIdRef.current = widgetId;
      setTurnstileError("");
    } catch {
      setTurnstileToken("");
      setTurnstileError("Không khởi tạo được Turnstile. Vui lòng kiểm tra Site key và domain.");
    }

    return () => {
      if (!turnstileWidgetIdRef.current) return;

      try {
        turnstile.remove(turnstileWidgetIdRef.current);
      } catch {
        // Widget can already be gone after a fast refresh.
      }
      turnstileWidgetIdRef.current = null;
    };
  }, [turnstileScriptReady, turnstileSiteKey]);

  function getFormText(form: HTMLFormElement, name: string) {
    return String(new FormData(form).get(name) || "").trim();
  }

  function focusField(form: HTMLFormElement, name: string) {
    const field = form.elements.namedItem(name);
    const input = Array.isArray(field) ? field[0] : field;

    if (input instanceof HTMLElement) {
      input.focus({ preventScroll: true });
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function stopSubmitWithMessage(form: HTMLFormElement, fieldName: string, message: string) {
    setSubmitting(false);
    setError(message);

    window.setTimeout(() => {
      focusField(form, fieldName);
    }, 0);
  }

  function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const question = getFormText(form, "questionType");
    const checks = [
      { name: "maNV", message: "Vui lòng nhập mã nhân viên." },
      { name: "maST", message: "Vui lòng nhập mã siêu thị." },
      { name: "staffName", message: "Vui lòng nhập tên nhân viên." },
      { name: "password", message: "Vui lòng nhập mật khẩu đăng nhập." },
      { name: "confirmPassword", message: "Vui lòng nhập lại mật khẩu xác nhận." },
      ...(question === "custom" ? [{ name: "customQuestion", message: "Vui lòng nhập câu hỏi bảo mật tự tạo." }] : []),
      { name: "answer", message: "Vui lòng nhập câu trả lời bảo mật." },
      { name: "gmail", message: "Vui lòng nhập Gmail xác thực." },
      { name: "captchaAnswer", message: "Vui lòng nhập kết quả captcha." },
    ];

    for (const item of checks) {
      if (getFormText(form, item.name)) continue;

      event.preventDefault();
      stopSubmitWithMessage(form, item.name, item.message);
      return;
    }

    if (passwordHint !== "Mật khẩu hợp lệ.") {
      event.preventDefault();
      stopSubmitWithMessage(form, "password", passwordHint);
      return;
    }

    if (gmailError) {
      event.preventDefault();
      stopSubmitWithMessage(form, "gmail", gmailError);
      return;
    }

    if (turnstileSiteKey && !turnstileToken) {
      event.preventDefault();
      stopSubmitWithMessage(form, "captchaAnswer", "Vui lòng hoàn tất xác thực chống spam trước khi tạo tài khoản.");
      return;
    }

    setError("");
    setSubmitting(true);
  }

  return (
    <main className="register-vtd-page">
      <style>{styles}</style>

      <section className="register-vtd-shell">
        <header className="register-vtd-brand">
          <Link href="/tradein-price" className="register-vtd-logo" aria-label="Quay lại bảng giá">
            <img src="/mwg-logo.svg" alt="MWG" />
          </Link>

          <div>
            <strong>Viễn Thông Di Động</strong>
            <span>Tạo tài khoản nhân viên</span>
          </div>
        </header>

        <section className="register-vtd-hero">
          <div className="register-vtd-kicker">STAFF ACCESS</div>
          <h1>Tạo tài khoản chờ duyệt</h1>
          <p>
            Nhập thông tin nhân viên để gửi yêu cầu kích hoạt. Admin sẽ kiểm tra và duyệt Active trước khi sử dụng.
          </p>
        </section>

        <form
          className="register-vtd-card"
          action="/api/auth/staff-register"
          method="POST"
          noValidate
          onSubmit={handleRegisterSubmit}
        >
          <div className="register-vtd-honeypot" aria-hidden="true">
            <label>
              Company website
              <input name="companyWebsite" type="text" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <input type="hidden" name="formStartedAt" value={formStartedAt} />

          {error && <div className="register-vtd-alert error">⚠️ {error}</div>}

          <div className="register-vtd-grid two">
            <label className="register-vtd-field">
              <span>Mã nhân viên</span>
              <input
                name="maNV"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Ví dụ: 123123"
                autoComplete="off"
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "");
                }}
                required
              />
            </label>

            <label className="register-vtd-field">
              <span>Mã siêu thị</span>
              <input name="maST" inputMode="numeric" placeholder="Ví dụ: 123123" autoComplete="off" required />
            </label>
          </div>

          <label className="register-vtd-field">
            <span>Tên nhân viên</span>
            <input name="staffName" placeholder="Ví dụ: Nguyễn Văn A" autoComplete="name" required />
          </label>

          <div className="register-vtd-grid two">
            <label className="register-vtd-field">
              <span>Mật khẩu</span>
              <div className="register-vtd-password-wrap">
                <input
                  name="password"
                  type="text"
                  className={showPassword ? "register-vtd-secure-input" : "register-vtd-secure-input masked"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  autoComplete="new-password"
                  spellCheck={false}
                  required
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} disabled={submitting} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                  <PasswordEyeIcon hidden={showPassword} />
                </button>
              </div>
            </label>

            <label className="register-vtd-field">
              <span>Xác nhận mật khẩu</span>
              <div className="register-vtd-password-wrap">
                <input
                  name="confirmPassword"
                  type="text"
                  className={showConfirmPassword ? "register-vtd-secure-input" : "register-vtd-secure-input masked"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  autoComplete="new-password"
                  spellCheck={false}
                  required
                />
                <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} disabled={submitting} aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                  <PasswordEyeIcon hidden={showConfirmPassword} />
                </button>
              </div>
            </label>
          </div>

          <div className={passwordHint === "Mật khẩu hợp lệ." ? "register-vtd-rule ok" : "register-vtd-rule"}>
            {passwordHint}
          </div>

          <label className="register-vtd-field">
            <span>Câu hỏi bảo mật</span>
            <select name="questionType" value={questionType} onChange={(e) => setQuestionType(e.target.value)} required>
              {SECURITY_QUESTIONS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
              <option value="custom">Tự tạo câu hỏi riêng</option>
            </select>
          </label>

          {questionType === "custom" && (
            <label className="register-vtd-field">
              <span>Câu hỏi tự tạo</span>
              <input name="customQuestion" placeholder="Nhập câu hỏi bảo mật riêng" />
            </label>
          )}

          <label className="register-vtd-field">
            <span>Câu trả lời bảo mật</span>
            <input name="answer" placeholder="Nhập câu trả lời bảo mật" autoComplete="off" required />
          </label>

          <label className="register-vtd-field">
            <span>Gmail xác thực</span>
            <input
              name="gmail"
              type="email"
              value={gmail}
              onChange={(e) => setGmail(e.target.value)}
              placeholder="ten@gmail.com"
              autoComplete="email"
              required
            />
          </label>

          {gmailError ? (
            <div className="register-vtd-alert mini-error">{gmailError}</div>
          ) : gmail ? (
            <div className="register-vtd-alert mini-ok">Gmail hợp lệ.</div>
          ) : null}

          <div className="register-vtd-captcha">
            <input type="hidden" name="captchaToken" value={captcha.token || ""} />

            <label className="register-vtd-field">
              <span>Captcha</span>
              <div className="register-vtd-captcha-line">
                <strong>{loadingCaptcha ? "Đang tải..." : captcha.question || "Bấm tải lại captcha"}</strong>
                <button type="button" onClick={loadCaptcha} disabled={submitting}>Tải lại</button>
              </div>
              <input name="captchaAnswer" inputMode="numeric" placeholder="Nhập kết quả" required />
            </label>
          </div>

          {turnstileSiteKey ? (
            <div className="register-vtd-turnstile">
              <Script
                id="register-turnstile-script"
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
                  setTurnstileError("Không tải được xác thực chống spam. Vui lòng kiểm tra mạng hoặc domain Turnstile.");
                }}
              />
              <input type="hidden" name="turnstileToken" value={turnstileToken} />
              <div ref={turnstileContainerRef} className="register-vtd-turnstile-frame" />
              {!turnstileScriptReady && !turnstileError && (
                <span className="register-vtd-turnstile-loading">Đang tải xác thực chống spam...</span>
              )}
              {turnstileError && (
                <span className="register-vtd-turnstile-loading error">{turnstileError}</span>
              )}
            </div>
          ) : (
            <input type="hidden" name="turnstileToken" value="" />
          )}

          <button
            className="register-vtd-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Đang gửi yêu cầu..." : "Tạo tài khoản chờ duyệt"}
          </button>

          <Link href="/login" className="register-vtd-back">
            Quay lại đăng nhập
          </Link>
        </form>

        {submitting && !success && (
          <div className="register-vtd-modal-backdrop" role="alertdialog" aria-modal="true" aria-live="assertive">
            <div className="register-vtd-processing-modal">
              <div className="register-vtd-processing-ring" aria-hidden="true"></div>
              <div className="register-vtd-modal-kicker">ĐANG XỬ LÝ</div>
              <h2>Đang gửi yêu cầu tạo tài khoản</h2>
              <p>Vui lòng chờ trong giây lát, hệ thống đang kiểm tra thông tin và gửi thông báo cho Admin.</p>
            </div>
          </div>
        )}

        {success && (
          <div className="register-vtd-modal-backdrop" role="dialog" aria-modal="true">
            <div className="register-vtd-success-modal">
              <div className="register-vtd-modal-icon">✓</div>
              <div className="register-vtd-modal-kicker">TẠO TÀI KHOẢN THÀNH CÔNG</div>
              <h2>Đã hoàn tất tạo tài khoản</h2>
              <p>
                Chờ admin xét duyệt sử dụng, sẽ nhận được phản hồi qua mail đăng ký
                ngay khi admin duyệt xong.
              </p>
              <button
                type="button"
                className="register-vtd-modal-ok"
                onClick={() => {
                  window.location.href = "/login";
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

const styles = `
.register-vtd-page {
  min-height: 100dvh;
  padding: clamp(12px, 2vw, 24px);
  background: radial-gradient(circle at 12% 0%, rgba(255, 212, 0, .2), transparent 30%), #eef3f8;
  color: #07111f;
  font-family: Roboto, Arial, sans-serif;
}

.register-vtd-shell {
  width: min(100%, 680px);
  margin: 0 auto;
}

.register-vtd-brand {
  height: 68px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.register-vtd-logo {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: #ffd400;
  box-shadow: 0 0 0 6px rgba(255, 212, 0, .14);
}

.register-vtd-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.register-vtd-brand strong {
  display: block;
  font-size: 18px;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: -.04em;
}

.register-vtd-brand span {
  display: block;
  margin-top: 5px;
  color: #64748b;
  font-size: 12px;
  font-weight: 850;
}

.register-vtd-hero {
  min-height: 210px;
  padding: clamp(22px, 4vw, 34px);
  border-radius: 32px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background: radial-gradient(circle at 88% 14%, rgba(255, 212, 0, .55), transparent 34%), linear-gradient(135deg, #0f172a, #020617);
  color: #fff;
  box-shadow: 0 26px 80px rgba(15, 23, 42, .16);
}

.register-vtd-kicker {
  width: fit-content;
  margin-bottom: 15px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, .12);
  color: #ffd400;
  font-size: 10px;
  font-weight: 1000;
  letter-spacing: .14em;
}

.register-vtd-hero h1 {
  margin: 0;
  font-size: clamp(38px, 8vw, 66px);
  line-height: .92;
  font-weight: 1000;
  letter-spacing: -.07em;
}

.register-vtd-hero p {
  margin: 16px 0 0;
  color: rgba(255, 255, 255, .78);
  font-size: 14px;
  line-height: 1.5;
  font-weight: 800;
}

.register-vtd-card {
  margin-top: 14px;
  padding: clamp(16px, 3vw, 26px);
  border-radius: 30px;
  background: rgba(255, 255, 255, .94);
  border: 1px solid rgba(203, 213, 225, .95);
  box-shadow: 0 22px 70px rgba(15, 23, 42, .08);
}

.register-vtd-honeypot {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.register-vtd-grid.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.register-vtd-field {
  display: grid;
  gap: 7px;
  margin-bottom: 13px;
}

.register-vtd-field span {
  color: #475569;
  font-size: 11px;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.register-vtd-field input,
.register-vtd-field select {
  width: 100%;
  min-height: 50px;
  border: 1px solid #cbd5e1;
  border-radius: 16px;
  padding: 0 14px;
  background: #f8fafc;
  color: #07111f;
  outline: none;
  font-size: 14px;
  font-weight: 850;
}

.register-vtd-field input:focus,
.register-vtd-field select:focus {
  background: #fff;
  border-color: #ffd400;
  box-shadow: 0 0 0 4px rgba(255, 212, 0, .18);
}

.register-vtd-password-wrap {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  border: 1px solid #cbd5e1;
  border-radius: 16px;
  padding: 5px;
  background: #f8fafc;
}

.register-vtd-password-wrap input {
  min-height: 42px;
  border: 0;
  box-shadow: none;
  background: transparent;
}

.register-vtd-password-wrap button,
.register-vtd-captcha-line button {
  border: 0;
  min-height: 38px;
  border-radius: 13px;
  padding: 0 13px;
  background: #07111f;
  color: #ffd400;
  font-size: 11px;
  font-weight: 1000;
  cursor: pointer;
}

.register-vtd-password-wrap button {
  width: 42px;
  min-width: 42px;
  padding: 0;
  display: grid;
  place-items: center;
}

.register-vtd-password-wrap button svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
  pointer-events: none;
}

.register-vtd-rule {
  margin: -3px 0 14px;
  padding: 11px 13px;
  border-radius: 14px;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
  font-weight: 800;
}

.register-vtd-rule.ok {
  background: #ecfdf5;
  color: #047857;
}

.register-vtd-alert {
  margin-bottom: 13px;
  padding: 13px 14px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 900;
}

.register-vtd-alert.error,
.register-vtd-alert.mini-error {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.register-vtd-alert.success,
.register-vtd-alert.mini-ok {
  background: #dcfce7;
  color: #047857;
  border: 1px solid #bbf7d0;
}

.register-vtd-alert.mini-error,
.register-vtd-alert.mini-ok {
  padding: 10px 12px;
  font-size: 12px;
}

.register-vtd-captcha-line {
  min-height: 50px;
  padding: 6px;
  border: 1px solid #cbd5e1;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: #fff;
}

.register-vtd-captcha-line strong {
  padding-left: 8px;
  color: #07111f;
  font-size: 14px;
  font-weight: 1000;
}

.register-vtd-turnstile {
  min-height: 65px;
  margin: 4px 0 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.register-vtd-turnstile-frame {
  min-height: 65px;
  display: grid;
  place-items: center;
}

.register-vtd-turnstile-loading {
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  font-weight: 900;
}

.register-vtd-turnstile-loading.error {
  max-width: 100%;
  padding: 9px 12px;
  border-radius: 12px;
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.register-vtd-submit {
  width: 100%;
  min-height: 54px;
  border: 0;
  border-radius: 18px;
  background: #ffd400;
  color: #07111f;
  cursor: pointer;
  font-size: 13px;
  font-weight: 1000;
  letter-spacing: .05em;
  text-transform: uppercase;
}

.register-vtd-submit:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.register-vtd-back {
  width: fit-content;
  margin: 18px auto 0;
  display: block;
  color: #ef4444;
  text-decoration: none;
  font-size: 12px;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}


.register-vtd-password-wrap input::-ms-reveal,
.register-vtd-password-wrap input::-ms-clear {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}

.register-vtd-password-wrap input::-webkit-credentials-auto-fill-button,
.register-vtd-password-wrap input::-webkit-contacts-auto-fill-button,
.register-vtd-password-wrap input::-webkit-textfield-decoration-container {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

.register-vtd-secure-input.masked {
  -webkit-text-security: disc;
  text-security: disc;
}

.register-vtd-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  padding: 18px;
  display: grid;
  place-items: center;
  background: rgba(2, 6, 23, .58);
  backdrop-filter: blur(10px);
}

.register-vtd-success-modal {
  width: min(100%, 430px);
  padding: 26px;
  border-radius: 28px;
  background: #ffffff;
  border: 1px solid rgba(203, 213, 225, .95);
  box-shadow: 0 34px 110px rgba(2, 6, 23, .32);
  text-align: center;
  animation: registerModalIn .18s ease-out;
}

.register-vtd-processing-modal {
  width: min(100%, 430px);
  padding: 28px;
  border-radius: 28px;
  background: radial-gradient(circle at 85% 12%, rgba(255, 212, 0, .22), transparent 34%), #ffffff;
  border: 1px solid rgba(203, 213, 225, .95);
  box-shadow: 0 34px 110px rgba(2, 6, 23, .32);
  text-align: center;
  animation: registerModalIn .18s ease-out;
}

.register-vtd-processing-ring {
  width: 62px;
  height: 62px;
  margin: 0 auto 16px;
  border-radius: 999px;
  border: 7px solid #e2e8f0;
  border-top-color: #ffd400;
  box-shadow: inset 0 0 0 6px #07111f;
  animation: registerSpin .72s linear infinite;
}

.register-vtd-processing-modal h2 {
  margin: 0;
  color: #07111f;
  font-size: 24px;
  line-height: 1.12;
  font-weight: 1000;
  letter-spacing: -.035em;
}

.register-vtd-processing-modal p {
  margin: 13px 0 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.55;
  font-weight: 800;
}

.register-vtd-modal-icon {
  width: 62px;
  height: 62px;
  margin: 0 auto 14px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  background: #dcfce7;
  color: #047857;
  font-size: 34px;
  font-weight: 1000;
  box-shadow: 0 0 0 8px rgba(22, 163, 74, .08);
}

.register-vtd-modal-kicker {
  width: fit-content;
  margin: 0 auto 12px;
  padding: 8px 12px;
  border-radius: 999px;
  background: #07111f;
  color: #ffd400;
  font-size: 10px;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: .12em;
}

.register-vtd-success-modal h2 {
  margin: 0;
  color: #07111f;
  font-size: 25px;
  line-height: 1.1;
  font-weight: 1000;
  letter-spacing: -.04em;
}

.register-vtd-success-modal p {
  margin: 14px 0 22px;
  color: #475569;
  font-size: 14px;
  line-height: 1.55;
  font-weight: 800;
}

.register-vtd-modal-ok {
  width: 100%;
  min-height: 52px;
  border: 0;
  border-radius: 17px;
  background: #ffd400;
  color: #07111f;
  cursor: pointer;
  font-size: 13px;
  font-weight: 1000;
  letter-spacing: .06em;
  text-transform: uppercase;
}

@keyframes registerModalIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes registerSpin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 560px) {
  .register-vtd-page {
    padding: 10px;
  }

  .register-vtd-grid.two {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .register-vtd-hero {
    min-height: 230px;
    border-radius: 28px;
  }

  .register-vtd-card {
    border-radius: 26px;
  }
}
`;
