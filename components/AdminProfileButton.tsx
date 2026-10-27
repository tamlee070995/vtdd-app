"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PasswordInput from "@/components/PasswordInput";
import UiNotice from "./UiNotice";
import { clientErrorMessage, requestJson } from "@/lib/client-request";

const QUESTIONS = [
  "Tên thú cưng đầu tiên của bạn là gì?",
  "Tên giáo viên chủ nhiệm đầu tiên của bạn là gì?",
  "Món ăn yêu thích của bạn là gì?",
  "Tên người bạn thân nhất thời đi học là gì?",
];

function safeProfileDisplayText(value: unknown) {
  const text = String(value || "").trim();
  return text.startsWith("enc:v1:") ? "" : text;
}

export default function AdminProfileButton({ required = false, mustChangePassword = false }: { required?: boolean; mustChangePassword?: boolean }) {
  const [open, setOpen] = useState(required);
  const [forceSetup, setForceSetup] = useState(required);
  const [passwordRequired, setPasswordRequired] = useState(mustChangePassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [changePassword, setChangePassword] = useState(mustChangePassword);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gmail, setGmail] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    async function loadProfile() {
      setLoading(true); setLoadError(false);
      try {
        const data = await requestJson<{ success: boolean; message?: string; profile: { gmail: string; securityQuestion: string; forceSetup: boolean; mustChangePassword: boolean } }>("/api/staff/profile");
        if (!active) return;
        if (data?.success) {
          setGmail(safeProfileDisplayText(data.profile?.gmail));
          setQuestion(safeProfileDisplayText(data.profile?.securityQuestion));
          setForceSetup(required || Boolean(data.profile?.forceSetup));
          setPasswordRequired(Boolean(data.profile?.mustChangePassword));
          if (data.profile?.mustChangePassword) setChangePassword(true);
        } else {
          setMsg(data?.message || "Không tải được thông tin. Vui lòng tải lại trang.");
        }
      } catch (reason) { if (active) { setLoadError(true); setMsg(clientErrorMessage(reason, "Không tải được thông tin.")); } }
      finally { if (active) setLoading(false); }
    }
    loadProfile();
    return () => { active = false; };
  }, [open, required, attempt]);

  async function saveProfile() {
    setMsg("");
    setSaved(false);
    if (!currentPassword) { setMsg("Vui lòng nhập mật khẩu hiện tại."); return; }
    if (!gmail || !question) { setMsg("Vui lòng nhập Gmail và câu hỏi bảo mật."); return; }
    if (forceSetup && !answer.trim()) { setMsg("Vui lòng nhập câu trả lời bảo mật."); return; }
    if (changePassword && (!newPassword || newPassword !== confirmPassword)) { setMsg("Mật khẩu mới chưa hợp lệ hoặc xác nhận chưa khớp."); return; }
    try {
      setSaving(true);
      const data = await requestJson<{ success: boolean; message: string }>("/api/staff/update-security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, changePassword, newPassword: changePassword ? newPassword : "", confirmPassword: changePassword ? confirmPassword : "", question, answer, gmail }),
      });
      if (!data.success) { setMsg(data.message || "Không cập nhật được."); setSaving(false); return; }
      if (forceSetup) { window.location.assign("/admin"); return; }
      setMsg("Đã cập nhật thông tin thành công.");
      setSaved(true);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setAnswer(""); setSaving(false);
    } catch (reason) { setMsg(clientErrorMessage(reason, "Không lưu được thông tin.")); setSaving(false); }
  }

  const panel = (
        <section className="admin-profile-layer">
          <div className="admin-profile-modal" role="dialog" aria-modal="true" aria-labelledby="admin-profile-title">
            {!forceSetup && <button type="button" className="admin-profile-close" aria-label="Đóng" onClick={() => setOpen(false)}>×</button>}
            <span>Bảo mật tài khoản</span>
            <h2 id="admin-profile-title">Cập nhật thông tin</h2>
            <p>{forceSetup ? "Bạn cần hoàn tất thông tin bảo mật trước khi tiếp tục sử dụng quản trị." : "Đổi mật khẩu, Gmail nhận OTP và câu hỏi bảo mật cho tài khoản Admin / Mod."}</p>
            <form onSubmit={(event) => { event.preventDefault(); void saveProfile(); }}>
              <fieldset disabled={saving || loading} className="admin-profile-fields">
                <label htmlFor="profile-current-password">Mật khẩu hiện tại</label>
                <PasswordInput id="profile-current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Nhập mật khẩu hiện tại" autoComplete="current-password" required />
                <label className="admin-profile-check"><input type="checkbox" checked={changePassword} disabled={passwordRequired} onChange={(e) => setChangePassword(e.target.checked)} /><b>Đổi mật khẩu đăng nhập{passwordRequired ? " (bắt buộc)" : ""}</b></label>
                {changePassword && <><p>Mật khẩu tối thiểu 6 ký tự, gồm chữ hoa, chữ thường, số và ký tự ! @ #.</p><div className="admin-profile-2col"><div><label htmlFor="profile-new-password">Mật khẩu mới</label><PasswordInput id="profile-new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mật khẩu mới" autoComplete="new-password" required /></div><div><label htmlFor="profile-confirm-password">Xác nhận mật khẩu</label><PasswordInput id="profile-confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu" autoComplete="new-password" required /></div></div></>}
                <label htmlFor="profile-gmail">Gmail nhận OTP</label><input id="profile-gmail" type="email" value={gmail} onChange={(e) => setGmail(e.target.value)} placeholder="ten@gmail.com" required />
                <label htmlFor="profile-question">Câu hỏi bảo mật</label><select id="profile-question" value={question} onChange={(e) => setQuestion(e.target.value)} required><option value="">Chọn câu hỏi bảo mật</option>{QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}</select>
                <label htmlFor="profile-answer">Câu trả lời bảo mật</label><textarea id="profile-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={forceSetup ? "Nhập câu trả lời bảo mật" : "Để trống nếu không đổi"} required={forceSetup} rows={2} />
                <button type="submit" className="admin-profile-save" disabled={saving || loading || loadError}>{loading ? "Đang tải thông tin..." : saving ? "Đang lưu..." : forceSetup ? "Lưu và vào quản trị" : "Lưu thay đổi"}</button>
              </fieldset>
            </form>
            {msg && <UiNotice tone={saved ? "success" : "error"} onRetry={loadError ? () => { setMsg(""); setAttempt(value => value + 1); } : undefined} busy={loading}>{msg}</UiNotice>}
            {forceSetup && <a className="admin-profile-exit" href="/api/auth/admin-logout">Đăng xuất</a>}
          </div>
        </section>
  );

  return (
    <>
      {!required && <button type="button" className="admin-profile-top-btn" onClick={() => setOpen(true)}>Cập nhật thông tin</button>}
      {open ? required ? panel : createPortal(panel, document.body) : null}
    </>
  );
}
