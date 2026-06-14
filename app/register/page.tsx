"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CaptchaPayload = {
  question?: string;
  token?: string;
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
          onSubmit={() => setSubmitting(true)}
        >
          {error && <div className="register-vtd-alert error">⚠️ {error}</div>}

          <div className="register-vtd-grid two">
            <label className="register-vtd-field">
              <span>Mã nhân viên</span>
              <input name="maNV" inputMode="numeric" placeholder="Ví dụ: 123123" autoComplete="off" required />
            </label>

            <label className="register-vtd-field">
              <span>Mã siêu thị</span>
              <input name="maST" inputMode="numeric" placeholder="Ví dụ: 123123" autoComplete="off" required />
            </label>
          </div>

          <label className="register-vtd-field">
            <span>Tên nhân viên</span>
            <input name="staffName" placeholder="Ví dụ: Lê Minh Tâm" autoComplete="name" required />
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
                <button type="button" onClick={() => setShowPassword((v) => !v)} disabled={submitting}>
                  {showPassword ? "ẨN" : "HIỆN"}
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
                <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} disabled={submitting}>
                  {showConfirmPassword ? "ẨN" : "HIỆN"}
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

          <button className="register-vtd-submit" type="submit" disabled={!!gmailError || submitting}>
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
