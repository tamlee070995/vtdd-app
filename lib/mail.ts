import nodemailer from "nodemailer";

function getMailer() {
  const host = String(process.env.MAIL_HOST || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  const port = Number(process.env.MAIL_PORT || 465);
  const secure =
    String(process.env.MAIL_SECURE ?? (port === 465 ? "true" : "false"))
      .trim()
      .toLowerCase() !== "false";
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;

  if (!host || !user || !pass) {
    throw new Error("Thiếu MAIL_HOST, MAIL_USER hoặc MAIL_PASS trong .env.local");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

function getMailFrom() {
  return process.env.MAIL_FROM || `Viễn Thông Di Động <${process.env.MAIL_USER || ""}>`;
}

function normalizeMailList(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
}

function buildDeliveryReport(info: any) {
  return {
    accepted: normalizeMailList(info?.accepted),
    rejected: normalizeMailList(info?.rejected),
    response: String(info?.response || ""),
    messageId: String(info?.messageId || ""),
  };
}

function ensureRecipientAccepted(report: ReturnType<typeof buildDeliveryReport>, to: string) {
  const target = String(to || "").trim().toLowerCase();

  if (target && report.accepted.includes(target)) return;

  if (target && report.rejected.includes(target)) {
    throw new Error(`SMTP từ chối người nhận ${target}. ${report.response}`.trim());
  }

  if (report.accepted.length === 0) {
    throw new Error(`SMTP chưa xác nhận người nhận. ${report.response}`.trim());
  }
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

  if (!to) {
    throw new Error("Thiếu email nhận thông báo tài khoản mới.");
  }

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
  const smtpUser = String(process.env.MAIL_USER || "").trim();

  function escapeHtml(value: unknown) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const staffName = escapeHtml(params.staffName || "Nhân viên");
  const maNV = escapeHtml(params.maNV);
  const loginUrl = escapeHtml(params.loginUrl);

  const text = [
    `Xin chào ${params.staffName || "Nhân viên"},`,
    `Tài khoản nhân viên ${params.maNV} của bạn đã được Admin duyệt Active trên trang TCDM.`,
    `Đăng nhập tại: ${params.loginUrl}`,
    "Email tự động từ hệ thống Viễn Thông Di Động.",
  ].join("\n\n");

  const info = await transporter.sendMail({
    from: getMailFrom(),
    sender: smtpUser || undefined,
    replyTo: smtpUser || undefined,
    envelope: smtpUser ? { from: smtpUser, to: params.to } : undefined,
    to: params.to,
    text,
    subject: "Viễn Thông Di Động - Tài khoản đã được kích hoạt",
    html: `
      <!doctype html>
      <html lang="vi">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Tài khoản đã được kích hoạt</title>
        </head>
        <body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#eef2f7;margin:0;padding:0;">
            <tr>
              <td align="center" style="padding:28px 14px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;width:100%;border-collapse:separate;border-spacing:0;">
                  <tr>
                    <td style="border-radius:30px 30px 0 0;overflow:hidden;background:#07111f;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:linear-gradient(135deg,#07111f 0%,#101827 48%,#2b2600 100%);">
                        <tr>
                          <td style="padding:28px 28px 26px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td align="left" style="vertical-align:middle;">
                                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                    <tr>
                                      <td style="width:46px;height:46px;border-radius:16px;background:#ffd400;text-align:center;vertical-align:middle;color:#07111f;font-weight:900;font-size:18px;line-height:46px;box-shadow:0 0 0 6px rgba(255,212,0,.13);">
                                        VT
                                      </td>
                                      <td style="padding-left:12px;vertical-align:middle;">
                                        <div style="font-size:16px;font-weight:900;color:#ffffff;line-height:1.1;">Viễn Thông Di Động</div>
                                        <div style="margin-top:4px;font-size:11px;font-weight:800;color:rgba(255,255,255,.62);letter-spacing:.08em;text-transform:uppercase;">Staff Access System</div>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                                <td align="right" style="vertical-align:middle;">
                                  <span style="display:inline-block;padding:9px 12px;border-radius:999px;background:rgba(34,197,94,.14);border:1px solid rgba(34,197,94,.34);color:#86efac;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;">
                                    Đã kích hoạt
                                  </span>
                                </td>
                              </tr>
                            </table>

                            <div style="margin-top:34px;font-size:12px;font-weight:900;letter-spacing:.10em;text-transform:uppercase;color:#ffd400;">
                              Account activated
                            </div>
                            <h1 style="margin:10px 0 0;color:#ffffff;font-size:34px;line-height:1.05;font-weight:900;letter-spacing:-.04em;">
                              Tài khoản của bạn đã sẵn sàng
                            </h1>
                            <p style="margin:14px 0 0;max-width:520px;color:rgba(255,255,255,.76);font-size:15px;line-height:1.55;font-weight:700;">
                              Xin chào <b style="color:#ffffff;">${staffName}</b>, tài khoản nhân viên <b style="color:#ffd400;">${maNV}</b> đã được Admin duyệt Active trên hệ thống TCDM.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="background:#ffffff;padding:0 28px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;border-radius:0 0 30px 30px;box-shadow:0 24px 70px rgba(15,23,42,.12);">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:-18px;">
                        <tr>
                          <td style="padding:18px;border-radius:22px;background:#f8fafc;border:1px solid #e2e8f0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td width="46" style="vertical-align:top;">
                                  <div style="width:38px;height:38px;border-radius:999px;background:#dcfce7;border:1px solid #86efac;color:#047857;text-align:center;line-height:38px;font-weight:900;font-size:18px;">✓</div>
                                </td>
                                <td style="vertical-align:top;">
                                  <div style="font-size:16px;line-height:1.35;font-weight:900;color:#0f172a;">Bạn có thể đăng nhập và sử dụng hệ thống ngay.</div>
                                  <div style="margin-top:7px;color:#64748b;font-size:13px;line-height:1.5;font-weight:700;">
                                    Sau khi đăng nhập lần đầu, hãy cập nhật Gmail, câu hỏi bảo mật và mật khẩu để bảo vệ tài khoản.
                                  </div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:18px;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
                        <tr>
                          <td style="padding:14px 16px;background:#ffffff;border-bottom:1px solid #e2e8f0;">
                            <div style="font-size:11px;font-weight:900;color:#64748b;letter-spacing:.08em;text-transform:uppercase;">Mã nhân viên</div>
                            <div style="margin-top:5px;color:#0f172a;font-size:18px;line-height:1.2;font-weight:900;">${maNV}</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:14px 16px;background:#ffffff;">
                            <div style="font-size:11px;font-weight:900;color:#64748b;letter-spacing:.08em;text-transform:uppercase;">Trạng thái</div>
                            <div style="margin-top:5px;color:#047857;font-size:15px;line-height:1.35;font-weight:900;">Active - Đã được phép truy cập</div>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;">
                        <tr>
                          <td align="center" style="border-radius:18px;background:#ffd400;">
                            <a href="${loginUrl}" target="_blank" style="display:block;padding:17px 18px;border-radius:18px;background:#ffd400;color:#111827;text-decoration:none;font-size:14px;line-height:1;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">
                              Mở trang đăng nhập
                            </a>
                          </td>
                        </tr>
                      </table>

                      <div style="margin-top:16px;padding:13px 14px;border-radius:16px;background:#fffbea;border:1px solid rgba(250,204,21,.45);color:#854d0e;font-size:12.5px;line-height:1.5;font-weight:800;">
                        Nếu nút đăng nhập không mở được, hãy copy link này và dán vào trình duyệt:<br />
                        <a href="${loginUrl}" target="_blank" style="color:#0f172a;text-decoration:underline;font-weight:900;word-break:break-all;">${loginUrl}</a>
                      </div>

                      <div style="margin-top:22px;padding-top:18px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.55;font-weight:700;">
                        Email tự động từ hệ thống Viễn Thông Di Động. Vui lòng không trả lời email này.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });

  const report = buildDeliveryReport(info);
  ensureRecipientAccepted(report, params.to);
  return report;
}
