import Link from "next/link";
import OtpCountdown from "@/components/OtpCountdown";

export const dynamic = "force-dynamic";

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function AdminForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const error = getParam(params.error);
  const success = getParam(params.success);
  const sent = getParam(params.sent) === "1";
  const maNV = getParam(params.maNV);
  const retryAfterSec = Number(getParam(params.retryAfterSec) || 0);

  return (
    <main className="admin-forgot-pro-page">
      <section className="admin-forgot-pro-card">
        <aside className="admin-forgot-pro-hero">
          <div className="admin-forgot-pro-logo"><img src="/mwg-logo.svg" alt="MWG" /></div>
          <span>SECURE RECOVERY</span>
          <h1>Khôi phục mật khẩu Admin</h1>
          <p>OTP chỉ gửi tới Gmail của Quản trị viên.</p>
        </aside>

        <div className="admin-forgot-pro-body">
          {error && <div className="admin-forgot-pro-alert error">{error}</div>}
          {success && <div className="admin-forgot-pro-alert success">{success}</div>}
          {retryAfterSec > 0 && <div className="admin-forgot-pro-alert warn">Vui lòng chờ khoảng {Math.ceil(retryAfterSec / 60)} phút nữa trước khi gửi lại OTP.</div>}
          {sent && !retryAfterSec ? <OtpCountdown seconds={600} /> : null}
          {sent && retryAfterSec > 0 ? <OtpCountdown seconds={retryAfterSec} /> : null}

          {!sent ? (
            <form action="/api/auth/admin-forgot-password/request" method="post" className="admin-forgot-pro-form">
              <div className="admin-forgot-pro-step">Bước 1 / Gửi mã OTP</div>
              <label>
                <span>Mã nhân viên</span>
                <input name="maNV" placeholder="Ví dụ: 123123" autoComplete="username" />
              </label>
              <button type="submit">Gửi mã xác thực</button>
            </form>
          ) : (
            <form action="/api/auth/admin-forgot-password/reset" method="post" className="admin-forgot-pro-form">
              <div className="admin-forgot-pro-step">Bước 2 / Đặt lại mật khẩu</div>
              <input type="hidden" name="maNV" value={maNV} />
              <label>
                <span>Mã nhân viên</span>
                <input value={maNV} readOnly />
              </label>
              <label>
                <span>OTP</span>
                <input name="otp" placeholder="Nhập mã OTP" inputMode="numeric" autoComplete="one-time-code" />
              </label>
              <PasswordField id="adminForgotPwd1" name="password" label="Mật khẩu mới" placeholder="Nhập mật khẩu mới" />
              <PasswordField id="adminForgotPwd2" name="confirmPassword" label="Xác nhận mật khẩu" placeholder="Nhập lại mật khẩu" />
              <button type="submit">Đặt lại mật khẩu</button>
            </form>
          )}

          <Link href="/admin/login" className="admin-forgot-pro-back">Quay lại đăng nhập Admin</Link>
        </div>
      </section>

      <style>{`
        .admin-forgot-pro-page { min-height:100dvh; padding:clamp(12px,2vw,26px); display:grid; place-items:center; background:radial-gradient(circle at 12% 0%, rgba(255,212,0,.22), transparent 30%), #eef3f8; font-family:Roboto, Arial, sans-serif; color:#07111f; }
        .admin-forgot-pro-card { width:min(100%, 1000px); min-height:590px; display:grid; grid-template-columns:.92fr 1.08fr; overflow:hidden; border-radius:34px; background:#fff; border:1px solid rgba(203,213,225,.95); box-shadow:0 30px 100px rgba(15,23,42,.15); }
        .admin-forgot-pro-hero { padding:clamp(28px,4vw,54px); display:flex; flex-direction:column; justify-content:flex-end; background:radial-gradient(circle at 88% 14%, rgba(255,212,0,.52), transparent 32%), linear-gradient(135deg,#07111f,#020617); color:#fff; }
        .admin-forgot-pro-logo { width:68px; height:68px; border-radius:21px; overflow:hidden; display:grid; place-items:center; background:#ffd400; margin-bottom:auto; box-shadow:0 0 0 8px rgba(255,212,0,.12); }
        .admin-forgot-pro-logo img { width:100%; height:100%; object-fit:contain; }
        .admin-forgot-pro-hero > span { width:fit-content; margin-bottom:18px; padding:10px 14px; border-radius:999px; background:rgba(255,255,255,.1); color:#ffd400; font-size:11px; font-weight:1000; letter-spacing:.12em; }
        .admin-forgot-pro-hero h1 { margin:0; font-size:clamp(42px,5.8vw,78px); line-height:.9; font-weight:1000; letter-spacing:-.08em; }
        .admin-forgot-pro-hero p { max-width:420px; margin:20px 0 0; color:rgba(255,255,255,.76); font-size:14px; line-height:1.55; font-weight:800; }
        .admin-forgot-pro-body { padding:clamp(26px,4vw,56px); display:flex; flex-direction:column; justify-content:center; gap:14px; }
        .admin-forgot-pro-alert { padding:13px 15px; border-radius:16px; font-size:13px; line-height:1.4; font-weight:850; }
        .admin-forgot-pro-alert.error { background:#fef2f2; border:1px solid #fecaca; color:#dc2626; }
        .admin-forgot-pro-alert.success { background:#ecfdf5; border:1px solid #bbf7d0; color:#047857; }
        .admin-forgot-pro-alert.warn { background:#fffbeb; border:1px solid #fde68a; color:#92400e; }
        .admin-forgot-pro-form { display:grid; gap:14px; }
        .admin-forgot-pro-step { width:fit-content; padding:9px 13px; border-radius:999px; background:#07111f; color:#ffd400; font-size:11px; font-weight:1000; letter-spacing:.08em; text-transform:uppercase; }
        .admin-forgot-pro-form label { display:grid; gap:8px; }
        .admin-forgot-pro-form label span { color:#64748b; font-size:11px; font-weight:1000; letter-spacing:.08em; text-transform:uppercase; }
        .admin-forgot-pro-form input { min-height:56px; border:1px solid #cbd5e1; border-radius:18px; background:#f8fafc; padding:0 15px; color:#07111f; font-size:15px; font-weight:850; outline:none; }
        .admin-forgot-pro-form input:focus { background:#fff; border-color:#ffd400; box-shadow:0 0 0 4px rgba(255,212,0,.2); }
        .admin-forgot-pro-password-wrap { position:relative; }
        .admin-forgot-pro-toggle { position:absolute; opacity:0; pointer-events:none; }
        .admin-forgot-pro-password-input { padding-right:92px !important; -webkit-text-security:disc; }
        .admin-forgot-pro-password-wrap:has(.admin-forgot-pro-toggle:checked) .admin-forgot-pro-password-input { -webkit-text-security:none; }
        .admin-forgot-pro-eye { position:absolute; right:10px; top:50%; transform:translateY(-50%); width:70px; height:40px; border-radius:14px; display:grid; place-items:center; background:#07111f; color:#ffd400; cursor:pointer; font-size:11px; font-weight:1000; user-select:none; }
        .admin-forgot-pro-eye .hide { display:none; }
        .admin-forgot-pro-password-wrap:has(.admin-forgot-pro-toggle:checked) .admin-forgot-pro-eye .show { display:none; }
        .admin-forgot-pro-password-wrap:has(.admin-forgot-pro-toggle:checked) .admin-forgot-pro-eye .hide { display:block; }
        .admin-forgot-pro-form button { min-height:56px; border:0; border-radius:18px; background:#ffd400; color:#07111f; font-size:13px; font-weight:1000; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; }
        .admin-forgot-pro-back { display:block; width:fit-content; margin:6px auto 0; color:#ef4444; text-decoration:none; font-size:12px; font-weight:1000; letter-spacing:.08em; text-transform:uppercase; }
        @media (max-width: 820px) { .admin-forgot-pro-card { grid-template-columns:1fr; min-height:auto; border-radius:30px; } .admin-forgot-pro-hero { min-height:260px; } }
      `}</style>
    </main>
  );
}

function PasswordField({ id, name, label, placeholder }: { id: string; name: string; label: string; placeholder: string }) {
  return (
    <label>
      <span>{label}</span>
      <div className="admin-forgot-pro-password-wrap">
        <input id={id} className="admin-forgot-pro-toggle" type="checkbox" />
        <input name={name} type="text" className="admin-forgot-pro-password-input" placeholder={placeholder} autoComplete="new-password" />
        <label htmlFor={id} className="admin-forgot-pro-eye">
          <i className="show">HIỆN</i>
          <i className="hide">ẨN</i>
        </label>
      </div>
    </label>
  );
}
