import nodemailer from "nodemailer";

type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type NewStaffMailInput = {
  to?: string;
  staffName?: string;
  maNV?: string;
  gmail?: string;
  storeCode?: string;
  storeName?: string;
  department?: string;
  adminUrl?: string;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function getAppUrl() {
  return clean(process.env.NEXT_PUBLIC_APP_URL) || "https://vtdd.online";
}

function getMailFrom() {
  const smtpUser =
    clean(process.env.SMTP_USER) ||
    clean(process.env.GMAIL_SMTP_USER);

  return (
    clean(process.env.MAIL_FROM) ||
    `Viễn Thông Di Động <${smtpUser}>`
  );
}

function getTransporter() {
  const smtpHost = clean(process.env.SMTP_HOST);
  const smtpPort = Number(clean(process.env.SMTP_PORT) || 465);
  const smtpSecureRaw = clean(process.env.SMTP_SECURE).toLowerCase();

  const smtpUser =
    clean(process.env.SMTP_USER) ||
    clean(process.env.GMAIL_SMTP_USER);

  const smtpPassword =
    clean(process.env.SMTP_PASSWORD) ||
    clean(process.env.GMAIL_SMTP_APP_PASSWORD);

  if (!smtpUser || !smtpPassword) {
    throw new Error("Thiếu SMTP_USER/SMTP_PASSWORD trong biến môi trường.");
  }

  if (smtpHost) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure:
        smtpSecureRaw === "true" ||
        smtpSecureRaw === "1" ||
        smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });
}

export async function sendMail(input: SendMailInput) {
  const to = clean(input.to);

  if (!to) {
    throw new Error("Thiếu email người nhận.");
  }

  const transporter = getTransporter();

  return transporter.sendMail({
    from: getMailFrom(),
    to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

function baseEmailLayout(title: string, content: string) {
  const appUrl = getAppUrl();

  return `
    <div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
        <div style="background:#07111f;border-radius:24px;padding:28px 28px 22px;color:#ffffff;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:14px;background:#ffd400;color:#07111f;font-weight:900;font-size:18px;margin-bottom:16px;">
            VT
          </div>

          <div style="font-size:26px;line-height:1.15;font-weight:900;letter-spacing:-.5px;">
            Viễn Thông Di Động
          </div>

          <div style="margin-top:8px;font-size:13px;color:#cbd5e1;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">
            Cổng tra cứu thu cũ
          </div>
        </div>

        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:22px;margin-top:14px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.08);">
          <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#111827;">
            ${title}
          </h1>

          <div style="font-size:15px;line-height:1.7;color:#374151;">
            ${content}
          </div>

          <div style="margin-top:24px;padding-top:18px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.6;color:#6b7280;">
            Email này được gửi tự động từ hệ thống Viễn Thông Di Động.<br/>
            Website:
            <a href="${appUrl}" style="color:#2563eb;text-decoration:none;font-weight:700;">
              ${appUrl}
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function sendResetOtpMail(input: {
  to: string;
  staffName?: string;
  maNV?: string;
  otp: string;
  expiresMinutes?: number;
}) {
  const staffName = clean(input.staffName) || "Anh/chị";
  const maNV = clean(input.maNV);
  const otp = clean(input.otp);
  const expiresMinutes = input.expiresMinutes || 10;

  const content = `
    <p>Xin chào <b>${staffName}</b>,</p>
    ${maNV ? `<p>Mã nhân viên: <b>${maNV}</b></p>` : ""}

    <p>Mã OTP đặt lại mật khẩu của bạn là:</p>

    <div style="margin:18px 0;padding:18px 22px;border-radius:18px;background:#fff7cc;border:1px solid #facc15;text-align:center;">
      <div style="font-size:34px;letter-spacing:8px;font-weight:900;color:#111827;">
        ${otp}
      </div>
    </div>

    <p>Mã OTP có hiệu lực trong <b>${expiresMinutes} phút</b>.</p>
    <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
  `;

  return sendMail({
    to: input.to,
    subject: "Viễn Thông Di Động - Mã OTP đặt lại mật khẩu",
    html: baseEmailLayout("Mã OTP đặt lại mật khẩu", content),
    text: `Mã OTP đặt lại mật khẩu: ${otp}. Hiệu lực ${expiresMinutes} phút.`,
  });
}

export async function sendAdminNewAccountMail(input: NewStaffMailInput) {
  const adminEmail = clean(input.to) || clean(process.env.ADMIN_NOTIFY_EMAIL);
  const appUrl = getAppUrl();
  const adminUrl = clean(input.adminUrl) || `${appUrl}/admin`;

  if (!adminEmail) {
    return null;
  }

  const content = `
    <p>Có tài khoản nhân viên mới đang chờ duyệt.</p>

    <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:14px;">
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Mã nhân viên</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:800;text-align:right;">${clean(input.maNV)}</td>
      </tr>

      <tr>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Tên nhân viên</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:800;text-align:right;">${clean(input.staffName)}</td>
      </tr>

      <tr>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Gmail đăng ký</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:800;text-align:right;">${clean(input.gmail)}</td>
      </tr>

      <tr>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Siêu thị</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:800;text-align:right;">${clean(input.storeCode)} ${clean(input.storeName)}</td>
      </tr>

      <tr>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Phòng ban</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:800;text-align:right;">${clean(input.department)}</td>
      </tr>
    </table>

    <div style="margin-top:22px;">
      <a href="${adminUrl}" style="display:inline-block;background:#ffd400;color:#07111f;text-decoration:none;font-weight:900;padding:14px 20px;border-radius:14px;">
        Mở trang Admin
      </a>
    </div>
  `;

  return sendMail({
    to: adminEmail,
    subject: "Viễn Thông Di Động - Tài khoản mới chờ duyệt",
    html: baseEmailLayout("Tài khoản mới chờ duyệt", content),
    text: `Tài khoản mới chờ duyệt: ${clean(input.maNV)} - ${clean(input.staffName)}. Admin: ${adminUrl}`,
  });
}

/**
 * Alias để tương thích với route cũ đang import sendNewStaffAccountMail.
 * Không xóa hàm này nếu app/api/auth/staff-register/route.ts còn import tên này.
 */
export async function sendNewStaffAccountMail(input: NewStaffMailInput) {
  return sendAdminNewAccountMail(input);
}

export async function sendStaffActivatedMail(input: {
  to: string;
  staffName?: string;
  maNV?: string;
  loginUrl?: string;
}) {
  const appUrl = getAppUrl();
  const loginUrl = clean(input.loginUrl) || `${appUrl}/login`;
  const staffName = clean(input.staffName) || "Anh/chị";
  const maNV = clean(input.maNV);

  const content = `
    <p>Xin chào <b>${staffName}</b>,</p>

    ${
      maNV
        ? `<p>Tài khoản nhân viên <b>${maNV}</b> của bạn đã được Admin kích hoạt.</p>`
        : `<p>Tài khoản của bạn đã được Admin kích hoạt.</p>`
    }

    <p>Bạn có thể đăng nhập và sử dụng hệ thống tại link bên dưới:</p>

    <div style="margin-top:22px;">
      <a href="${loginUrl}" style="display:inline-block;background:#ffd400;color:#07111f;text-decoration:none;font-weight:900;padding:14px 20px;border-radius:14px;">
        Đăng nhập hệ thống
      </a>
    </div>

    <p style="margin-top:18px;">Nếu nút không mở được, hãy copy link này:</p>
    <p style="word-break:break-all;color:#2563eb;font-weight:700;">${loginUrl}</p>
  `;

  return sendMail({
    to: input.to,
    subject: "Viễn Thông Di Động - Tài khoản đã được kích hoạt",
    html: baseEmailLayout("Tài khoản đã được kích hoạt", content),
    text: `Tài khoản đã được kích hoạt. Đăng nhập: ${loginUrl}`,
  });
}

export async function verifyMailConnection() {
  const transporter = getTransporter();

  await transporter.verify();

  return {
    success: true,
    from: getMailFrom(),
    smtpHost: clean(process.env.SMTP_HOST) || "gmail",
  };
}