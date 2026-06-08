import nodemailer from "nodemailer";

function getMailer() {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error("Thiếu GMAIL_SMTP_USER hoặc GMAIL_SMTP_APP_PASSWORD trong .env.local");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });
}

function getMailFrom() {
  return process.env.MAIL_FROM || process.env.GMAIL_SMTP_USER || "";
}

export async function sendResetOtpMail(params: {
  to: string;
  staffName: string;
  maNV: string;
  otp: string;
}) {
  const transporter = getMailer();

  await transporter.sendMail({
    from: getMailFrom(),
    to: params.to,
    subject: "Viễn Thông Di Động - Mã xác thực đặt lại mật khẩu",
    html: `
      <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
        <div style="max-width:520px;margin:auto;background:#ffffff;border-radius:18px;padding:24px;border:1px solid #e2e8f0;">
          <h2 style="margin:0;color:#0f172a;">Viễn Thông Di Động</h2>
          <p style="color:#64748b;font-weight:700;">Xin chào ${params.staffName || "Nhân viên"},</p>
          <p style="color:#0f172a;">Mã xác thực đặt lại mật khẩu cho tài khoản <b>${params.maNV}</b> là:</p>
          <div style="font-size:34px;font-weight:900;letter-spacing:8px;color:#111827;background:#ffd400;border-radius:14px;padding:16px;text-align:center;">
            ${params.otp}
          </div>
          <p style="color:#64748b;font-size:13px;line-height:1.5;margin-top:18px;">
            Mã này có hiệu lực trong 10 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendNewStaffAccountMail(params: {
  to?: string;
  maNV: string;
  staffName: string;
  gmail: string;
  adminUrl: string;
}) {
  const transporter = getMailer();
  const to = params.to || process.env.ADMIN_NOTIFY_EMAIL || "tamlee070995@gmail.com";

  await transporter.sendMail({
    from: getMailFrom(),
    to,
    subject: `Viễn Thông Di Động - Tài khoản mới chờ duyệt: ${params.maNV}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
        <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:20px;padding:24px;border:1px solid #e2e8f0;">
          <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#0f172a;color:#ffd400;font-size:11px;font-weight:900;letter-spacing:.08em;">
            NEW STAFF ACCOUNT
          </div>

          <h2 style="margin:16px 0 8px;color:#0f172a;font-size:24px;">Có tài khoản mới chờ duyệt</h2>

          <p style="color:#475569;font-size:14px;line-height:1.5;">
            Một nhân viên vừa tạo tài khoản trên trang TCDM. Vui lòng kiểm tra và chuyển trạng thái Active nếu hợp lệ.
          </p>

          <div style="margin-top:16px;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <div style="padding:12px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
              <b style="color:#64748b;font-size:12px;">Mã nhân viên</b>
              <div style="margin-top:5px;color:#0f172a;font-size:18px;font-weight:900;">${params.maNV}</div>
            </div>

            <div style="padding:12px 14px;border-bottom:1px solid #e2e8f0;">
              <b style="color:#64748b;font-size:12px;">Tên nhân viên</b>
              <div style="margin-top:5px;color:#0f172a;font-size:16px;font-weight:900;">${params.staffName}</div>
            </div>

            <div style="padding:12px 14px;">
              <b style="color:#64748b;font-size:12px;">Gmail xác thực</b>
              <div style="margin-top:5px;color:#0f172a;font-size:15px;font-weight:900;">${params.gmail}</div>
            </div>
          </div>

          <a href="${params.adminUrl}" style="margin-top:18px;width:100%;min-height:50px;border-radius:16px;background:#ffd400;color:#111827;text-decoration:none;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;letter-spacing:.06em;">
            MỞ TRANG ADMIN ĐỂ DUYỆT
          </a>

          <p style="margin-top:16px;color:#94a3b8;font-size:12px;line-height:1.5;">
            Email tự động từ hệ thống Viễn Thông Di Động.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendStaffActivatedMail(params: {
  to: string;
  staffName: string;
  maNV: string;
  loginUrl: string;
}) {
  const transporter = getMailer();

  await transporter.sendMail({
    from: getMailFrom(),
    to: params.to,
    subject: "Viễn Thông Di Động - Tài khoản đã được kích hoạt",
    html: `
      <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
        <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:20px;padding:24px;border:1px solid #e2e8f0;">
          <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#0f172a;color:#ffd400;font-size:11px;font-weight:900;letter-spacing:.08em;">
            ACCOUNT ACTIVATED
          </div>

          <h2 style="margin:16px 0 8px;color:#0f172a;font-size:24px;">Tài khoản đã được kích hoạt</h2>

          <p style="color:#475569;font-size:14px;line-height:1.55;">
            Xin chào <b>${params.staffName || "Nhân viên"}</b>, tài khoản nhân viên
            <b>${params.maNV}</b> của bạn đã được Admin duyệt Active trên trang TCDM.
          </p>

          <div style="margin-top:16px;padding:14px;border-radius:16px;background:#ecfdf5;border:1px solid #bbf7d0;color:#047857;font-size:14px;line-height:1.5;font-weight:700;">
            Bạn có thể đăng nhập và sử dụng hệ thống theo link bên dưới.
          </div>

          <a href="${params.loginUrl}" style="margin-top:18px;width:100%;min-height:50px;border-radius:16px;background:#ffd400;color:#111827;text-decoration:none;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;letter-spacing:.06em;">
            MỞ TRANG ĐĂNG NHẬP
          </a>

          <p style="margin-top:16px;color:#94a3b8;font-size:12px;line-height:1.5;">
            Email tự động từ hệ thống Viễn Thông Di Động.
          </p>
        </div>
      </div>
    `,
  });
}
