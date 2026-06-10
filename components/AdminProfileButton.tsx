"use client";

import { useEffect, useState } from "react";

const QUESTIONS = [
  "Tên thú cưng đầu tiên của bạn là gì?",
  "Tên giáo viên chủ nhiệm đầu tiên của bạn là gì?",
  "Món ăn yêu thích của bạn là gì?",
  "Tên người bạn thân nhất thời đi học là gì?",
];

export default function AdminProfileButton() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [changePassword, setChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gmail, setGmail] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    async function loadProfile() {
      try {
        const res = await fetch("/api/staff/profile", { cache: "no-store" });
        const data = await res.json();
        if (data?.success) {
          setGmail(data.profile?.gmail || "");
          setQuestion(data.profile?.securityQuestion || "");
        }
      } catch {}
    }
    loadProfile();
  }, [open]);

  async function saveProfile() {
    setMsg("");
    if (!currentPassword) { setMsg("Vui lòng nhập mật khẩu hiện tại."); return; }
    if (!gmail || !question) { setMsg("Vui lòng nhập Gmail và câu hỏi bảo mật."); return; }
    if (changePassword && (!newPassword || newPassword !== confirmPassword)) { setMsg("Mật khẩu mới chưa hợp lệ hoặc xác nhận chưa khớp."); return; }
    try {
      setSaving(true);
      const res = await fetch("/api/staff/update-security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, changePassword, newPassword: changePassword ? newPassword : "", confirmPassword: changePassword ? confirmPassword : "", question, answer, gmail }),
      });
      const data = await res.json();
      if (!data.success) { setMsg(data.message || "Không cập nhật được."); setSaving(false); return; }
      setMsg("Đã cập nhật thông tin thành công.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setAnswer(""); setSaving(false);
    } catch { setMsg("Lỗi kết nối. Không lưu được thông tin."); setSaving(false); }
  }

  return (
    <>
      <button type="button" className="admin-profile-top-btn" onClick={() => setOpen(true)}>Cập nhật thông tin</button>
      {open && (
        <section className="admin-profile-layer">
          <div className="admin-profile-modal">
            <button type="button" className="admin-profile-close" onClick={() => setOpen(false)}>×</button>
            <span>Bảo mật tài khoản</span>
            <h2>Cập nhật thông tin</h2>
            <p>Đổi mật khẩu, Gmail nhận OTP và câu hỏi bảo mật cho tài khoản Admin.</p>
            <label>Mật khẩu hiện tại</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Nhập mật khẩu hiện tại" />
            <label className="admin-profile-check"><input type="checkbox" checked={changePassword} onChange={(e) => setChangePassword(e.target.checked)} /><b>Đổi mật khẩu đăng nhập</b></label>
            {changePassword && <div className="admin-profile-2col"><div><label>Mật khẩu mới</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mật khẩu mới" /></div><div><label>Xác nhận mật khẩu</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu" /></div></div>}
            <label>Gmail nhận OTP</label><input type="email" value={gmail} onChange={(e) => setGmail(e.target.value)} placeholder="ten@gmail.com" />
            <label>Câu hỏi bảo mật</label><select value={question} onChange={(e) => setQuestion(e.target.value)}><option value="">Chọn câu hỏi bảo mật</option>{QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}</select>
            <label>Câu trả lời bảo mật</label><textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Để trống nếu không đổi" rows={2} />
            {msg && <div className="admin-profile-msg">{msg}</div>}
            <button type="button" className="admin-profile-save" disabled={saving} onClick={saveProfile}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</button>
          </div>
        </section>
      )}
    </>
  );
}
