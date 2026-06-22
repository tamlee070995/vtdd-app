import nodemailer from "nodemailer";

type MailSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  rejectUnauthorized: boolean;
  name: string;
  label: string;
};

function normalizeMailHost(value: unknown) {
  let raw = String(value || "").trim();
  const markdownUrl = raw.match(/\]\((https?:\/\/[^)]+)\)/i)?.[1];
  if (markdownUrl) raw = markdownUrl;

  return raw
    .replace(/^['"]|['"]$/g, "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/g, "")
    .trim();
}

function getMailSettings(overrides: Partial<MailSettings> = {}): MailSettings {
  const host = normalizeMailHost(process.env.MAIL_HOST);
  const port = Number(process.env.MAIL_PORT || 465);
  const secure =
    String(process.env.MAIL_SECURE ?? (port === 465 ? "true" : "false"))
      .trim()
      .toLowerCase() !== "false";
  const user = String(process.env.MAIL_USER || "").trim();
  const pass = String(process.env.MAIL_PASS || "").trim();

  if (!host || !user || !pass) {
    const missing = [
      !host ? "MAIL_HOST" : "",
      !user ? "MAIL_USER" : "",
      !pass ? "MAIL_PASS" : "",
    ].filter(Boolean);

    throw new Error(`Thiếu biến môi trường mail: ${missing.join(", ")}.`);
  }

  const rejectUnauthorized =
    String(process.env.MAIL_TLS_REJECT_UNAUTHORIZED || "true")
      .trim()
      .toLowerCase() !== "false";

  return {
    host,
    port,
    secure,
    user,
    pass,
    rejectUnauthorized,
    name: String(process.env.MAIL_EHLO_NAME || "vienthongdidong.com").trim(),
    label: "primary",
    ...overrides,
  };
}

function createMailer(settings: MailSettings) {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    name: settings.name,
    requireTLS: !settings.secure,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    tls: {
      servername: settings.host,
      rejectUnauthorized: settings.rejectUnauthorized,
    },
    auth: {
      user: settings.user,
      pass: settings.pass,
    },
  });
}

function getMailer() {
  return createMailer(getMailSettings());
}

function getMailFrom() {
  return String(process.env.MAIL_FROM || `Viễn Thông Di Động <${process.env.MAIL_USER || ""}>`)
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function getAutoMailHeaders() {
  return {
    "Auto-Submitted": "auto-generated",
    "X-Auto-Response-Suppress": "All",
  };
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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value: unknown) {
  const url = String(value || "").trim();
  if (!url) return "#";
  if (/^https?:\/\//i.test(url)) return url;
  return "#";
}

function buildPreheader(text: string) {
  return `
    <div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">
      ${escapeHtml(text)}
    </div>
  `;
}

function getMailLogoUrl() {
  const raw = String(
    process.env.MAIL_LOGO_URL ||
      process.env.NEXT_PUBLIC_MAIL_LOGO_URL ||
      ""
  ).trim();

  if (/^https?:\/\//i.test(raw)) return raw;

  const baseUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  if (!baseUrl) return "";

  const path = raw || "/mwg-logo.png";
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildBrandLogo() {
  const logoUrl = getMailLogoUrl();

  if (logoUrl) {
    return `
      <td width="52" height="52" align="center" valign="middle" style="width:52px;height:52px;border-radius:18px;background:#ffd400;overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,.22);">
        <img src="${escapeHtml(logoUrl)}" width="52" height="52" alt="MWG" style="display:block;width:52px;height:52px;border:0;outline:none;text-decoration:none;object-fit:cover;border-radius:18px;" />
      </td>
    `;
  }

  return `
    <td width="52" height="52" align="center" valign="middle" style="width:52px;height:52px;border-radius:18px;background:#ffd400;color:#07111f;font-family:Roboto,Arial,sans-serif;font-size:12px;line-height:13px;font-weight:900;letter-spacing:-.8px;text-align:center;box-shadow:0 10px 24px rgba(0,0,0,.22);">
      MWG
    </td>
  `;
}

function buildBrandHeader(statusLabel: string) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="left" style="padding:0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              ${buildBrandLogo()}
              <td style="padding-left:13px;">
                <div style="font-family:Roboto,Arial,sans-serif;color:#ffffff;font-size:17px;line-height:20px;font-weight:900;letter-spacing:-.3px;">
                  Viễn Thông Di Động
                </div>
                <div style="margin-top:3px;font-family:Roboto,Arial,sans-serif;color:rgba(255,255,255,.66);font-size:10px;line-height:12px;font-weight:900;letter-spacing:1.7px;text-transform:uppercase;">
                  Staff Access System
                </div>
              </td>
            </tr>
          </table>
        </td>
        <td align="right" style="padding:0;">
          <span style="display:inline-block;padding:10px 14px;border-radius:999px;background:rgba(34,197,94,.14);border:1px solid rgba(74,222,128,.32);font-family:Roboto,Arial,sans-serif;color:#86efac;font-size:11px;line-height:12px;font-weight:900;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;">
            ${escapeHtml(statusLabel)}
          </span>
        </td>
      </tr>
    </table>
  `;
}

function buildInfoRows(rows: Array<{ label: string; value: string; accent?: boolean }>) {
  return rows
    .map((row, index) => {
      const border = index === rows.length - 1 ? "" : "border-bottom:1px solid #e5e7eb;";
      const color = row.accent ? "#047857" : "#0f172a";

      return `
        <tr>
          <td style="padding:15px 16px;${border}">
            <div style="font-family:Roboto,Arial,sans-serif;color:#64748b;font-size:10px;line-height:12px;font-weight:900;letter-spacing:1.6px;text-transform:uppercase;">
              ${escapeHtml(row.label)}
            </div>
            <div style="margin-top:6px;font-family:Roboto,Arial,sans-serif;color:${color};font-size:17px;line-height:22px;font-weight:900;letter-spacing:-.2px;">
              ${escapeHtml(row.value)}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function buildActionButton(label: string, url: string) {
  const href = safeUrl(url);

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:22px;">
      <tr>
        <td align="center" style="border-radius:18px;background:#ffd400;box-shadow:0 14px 30px rgba(245,158,11,.22);">
          <a href="${escapeHtml(href)}" target="_blank" style="display:block;padding:18px 18px;border-radius:18px;font-family:Roboto,Arial,sans-serif;color:#07111f;text-decoration:none;font-size:13px;line-height:16px;font-weight:900;letter-spacing:1.1px;text-transform:uppercase;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function buildEmailShell(params: {
  preheader: string;
  statusLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  body: string;
  footerNote?: string;
}) {
  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${escapeHtml(params.title)}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');
      body, table, td, a, div, p, span, h1, h2, h3 { font-family: Roboto, Arial, sans-serif !important; }
      @media only screen and (max-width: 620px) {
        .vtdd-container { width: 100% !important; border-radius: 0 !important; }
        .vtdd-outer { padding: 0 !important; }
        .vtdd-hero { padding: 24px 20px 28px !important; }
        .vtdd-content { padding: 20px !important; }
        .vtdd-title { font-size: 30px !important; line-height: 34px !important; }
        .vtdd-description { font-size: 14px !important; line-height: 21px !important; }
        .vtdd-card { border-radius: 18px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#eef2f7;">
    ${buildPreheader(params.preheader)}

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef2f7;">
      <tr>
        <td class="vtdd-outer" align="center" style="padding:30px 14px;">
          <table role="presentation" class="vtdd-container" width="620" cellspacing="0" cellpadding="0" border="0" style="width:620px;max-width:620px;background:#ffffff;border-radius:30px;overflow:hidden;border:1px solid #dbe3ee;box-shadow:0 28px 80px rgba(15,23,42,.14);">
            <tr>
              <td class="vtdd-hero" style="padding:30px 30px 34px;background:#07111f;background-image:radial-gradient(circle at 82% 10%, rgba(255,212,0,.32), transparent 30%),radial-gradient(circle at 0% 100%, rgba(34,211,238,.10), transparent 32%),linear-gradient(135deg,#07111f 0%,#111827 58%,#191b07 100%);">
                ${buildBrandHeader(params.statusLabel)}

                <div style="margin-top:30px;font-family:Roboto,Arial,sans-serif;color:#ffd400;font-size:11px;line-height:13px;font-weight:900;letter-spacing:1.6px;text-transform:uppercase;">
                  ${escapeHtml(params.eyebrow)}
                </div>

                <h1 class="vtdd-title" style="margin:12px 0 0;font-family:Roboto,Arial,sans-serif;color:#ffffff;font-size:42px;line-height:45px;font-weight:900;letter-spacing:-1.7px;">
                  ${escapeHtml(params.title)}
                </h1>

                <p class="vtdd-description" style="margin:14px 0 0;font-family:Roboto,Arial,sans-serif;color:rgba(255,255,255,.76);font-size:15px;line-height:23px;font-weight:700;">
                  ${params.description}
                </p>
              </td>
            </tr>

            <tr>
              <td class="vtdd-content" style="padding:26px 26px 28px;background:#ffffff;">
                ${params.body}

                <div style="height:1px;background:#e5e7eb;margin:24px 0 0;"></div>

                <p style="margin:18px 0 0;font-family:Roboto,Arial,sans-serif;color:#94a3b8;font-size:12px;line-height:18px;font-weight:700;text-align:left;">
                  ${escapeHtml(params.footerNote || "Email tự động từ hệ thống Viễn Thông Di Động. Vui lòng không trả lời email này.")}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildSuccessBox(params: { title: string; desc: string }) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="vtdd-card" style="border-radius:22px;background:#ecfdf5;border:1px solid #bbf7d0;overflow:hidden;">
      <tr>
        <td width="56" valign="top" style="padding:18px 0 18px 18px;">
          <div style="width:38px;height:38px;border-radius:999px;background:#d1fae5;border:1px solid #86efac;color:#047857;font-family:Roboto,Arial,sans-serif;font-size:24px;line-height:38px;font-weight:900;text-align:center;">
            ✓
          </div>
        </td>
        <td style="padding:18px 18px 18px 0;">
          <div style="font-family:Roboto,Arial,sans-serif;color:#0f172a;font-size:16px;line-height:20px;font-weight:900;">
            ${escapeHtml(params.title)}
          </div>
          <div style="margin-top:6px;font-family:Roboto,Arial,sans-serif;color:#64748b;font-size:13px;line-height:20px;font-weight:700;">
            ${escapeHtml(params.desc)}
          </div>
        </td>
      </tr>
    </table>
  `;
}

function buildWarningBox(params: { title: string; desc: string }) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="vtdd-card" style="margin-top:16px;border-radius:18px;background:#fff7ed;border:1px solid #fed7aa;overflow:hidden;">
      <tr>
        <td style="padding:14px 16px;">
          <div style="font-family:Roboto,Arial,sans-serif;color:#9a3412;font-size:13px;line-height:19px;font-weight:900;">
            ${escapeHtml(params.title)}
          </div>
          <div style="margin-top:5px;font-family:Roboto,Arial,sans-serif;color:#9a3412;font-size:12px;line-height:18px;font-weight:700;">
            ${params.desc}
          </div>
        </td>
      </tr>
    </table>
  `;
}

export async function sendResetOtpMail(params: {
  to: string;
  staffName: string;
  maNV: string;
  otp: string;
}) {
  const smtpUser = String(process.env.MAIL_USER || "").trim();
  const staffName = params.staffName || "Nhân viên";
  const otp = String(params.otp || "").trim();

  const html = buildEmailShell({
    preheader: `Mã OTP đặt lại mật khẩu của bạn là ${otp}. Mã có hiệu lực trong 10 phút.`,
    statusLabel: "OTP 10 phút",
    eyebrow: "Password Reset",
    title: "Mã xác thực đặt lại mật khẩu",
    description: `Xin chào <b style="color:#ffffff;">${escapeHtml(staffName)}</b>, mã xác thực cho tài khoản <b style="color:#ffffff;">${escapeHtml(params.maNV)}</b> đã được tạo.`,
    body: `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="vtdd-card" style="border-radius:24px;background:#fffbea;border:1px solid #fde68a;overflow:hidden;">
        <tr>
          <td align="center" style="padding:24px 18px;">
            <div style="font-family:Roboto,Arial,sans-serif;color:#854d0e;font-size:10px;line-height:12px;font-weight:900;letter-spacing:1.6px;text-transform:uppercase;">
              Mã OTP của bạn
            </div>
            <div style="margin-top:10px;font-family:Roboto,Arial,sans-serif;color:#07111f;font-size:42px;line-height:48px;font-weight:900;letter-spacing:9px;">
              ${escapeHtml(otp)}
            </div>
            <div style="margin-top:10px;font-family:Roboto,Arial,sans-serif;color:#92400e;font-size:13px;line-height:20px;font-weight:800;">
              Mã này có hiệu lực trong 10 phút. Không chia sẻ mã này cho bất kỳ ai.
            </div>
          </td>
        </tr>
      </table>
      ${buildWarningBox({
        title: "Không phải bạn yêu cầu?",
        desc: "Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này và kiểm tra lại bảo mật tài khoản.",
      })}
    `,
  });

  const text = [
    `Xin chào ${staffName},`,
    `Mã xác thực đặt lại mật khẩu cho tài khoản ${params.maNV} là: ${otp}`,
    "Mã này có hiệu lực trong 10 phút. Không chia sẻ mã này cho bất kỳ ai.",
    "Email tự động từ hệ thống Viễn Thông Di Động.",
  ].join("\n\n");

  const info = await sendMailWithFallback({
    from: getMailFrom(),
    envelope: smtpUser ? { from: smtpUser, to: params.to } : undefined,
    to: params.to,
    subject: "Viễn Thông Di Động - Mã xác thực đặt lại mật khẩu",
    headers: getAutoMailHeaders(),
    text,
    html,
  });

  const report = buildDeliveryReport(info);
  ensureRecipientAccepted(report, params.to);

  return report;
}

function maskEmail(email: string) {
  const [name, domain] = String(email || "").split("@");
  if (!name || !domain) return email ? "***" : "";
  return `${name.slice(0, 2)}***@${domain}`;
}

function isLikelyConnectionError(err: any) {
  const text = `${err?.code || ""} ${err?.command || ""} ${err?.message || ""}`;
  return /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EHOSTUNREACH|ENOTFOUND|ESOCKET|ECONNECTION|ETLS|Greeting never received|Connection timeout|Timed out|timeout/i.test(text);
}

function shouldTrySmtpFallback(settings: MailSettings, err: any) {
  const disabled = String(process.env.MAIL_DISABLE_SMTP_FALLBACK || "")
    .trim()
    .toLowerCase() === "true";

  if (disabled) return false;
  if (settings.port === 587 && settings.secure === false) return false;
  return isLikelyConnectionError(err);
}

export function getPublicMailError(err: any) {
  const raw = String(err?.message || err || "").trim();
  const code = String(err?.code || err?.cause?.code || "").trim();
  const text = `${code} ${raw}`;

  if (/Thiếu biến môi trường mail/i.test(raw)) return raw;
  if (/EAUTH|Invalid login|Authentication failed|535|534/i.test(text)) {
    return "SMTP đăng nhập thất bại. Kiểm tra MAIL_USER và MAIL_PASS trên môi trường web chính.";
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(text)) {
    return "Server web chính không phân giải được MAIL_HOST. Kiểm tra MAIL_HOST/DNS.";
  }
  if (/ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH|ESOCKET|ECONNECTION|Greeting never received|Connection timeout|Timed out|timeout/i.test(text)) {
    return "Server web chính không kết nối được SMTP. Khả năng cao hosting đang chặn cổng SMTP 465/587 hoặc mail server chặn IP hosting.";
  }
  if (/certificate|self signed|TLS|SSL/i.test(text)) {
    return "Lỗi TLS/SSL khi kết nối SMTP. Kiểm tra MAIL_HOST, MAIL_PORT, MAIL_SECURE hoặc chứng chỉ mail server.";
  }
  if (/SPF|DKIM|DMARC|550-5\.7|blocked|unauthenticated/i.test(text)) {
    return "Mail bị chặn do xác thực tên miền SPF/DKIM/DMARC. Cần kiểm tra DNS mail của vienthongdidong.com.";
  }

  return raw || "Không xác định được lỗi SMTP.";
}

function withMailContext(err: any, settings: MailSettings, fallbackErr?: any) {
  const detail = fallbackErr
    ? `${getPublicMailError(err)} Fallback 587 cũng lỗi: ${getPublicMailError(fallbackErr)}`
    : getPublicMailError(err);
  const wrapped = new Error(
    `[SMTP ${settings.host}:${settings.port}${settings.secure ? "/SSL" : "/STARTTLS"}] ${detail}`
  );

  (wrapped as any).code = err?.code || fallbackErr?.code;
  (wrapped as any).cause = fallbackErr || err;
  return wrapped;
}

async function sendMailWithFallback(options: any) {
  const primary = getMailSettings();

  try {
    return await createMailer(primary).sendMail(options);
  } catch (err: any) {
    if (!shouldTrySmtpFallback(primary, err)) {
      throw withMailContext(err, primary);
    }

    const fallback = getMailSettings({
      port: 587,
      secure: false,
      label: "fallback-587",
    });

    try {
      return await createMailer(fallback).sendMail(options);
    } catch (fallbackErr: any) {
      throw withMailContext(err, primary, fallbackErr);
    }
  }
}

export function getMailDiagnosticsSnapshot() {
  try {
    const settings = getMailSettings();

    return {
      configured: true,
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      user: maskEmail(settings.user),
      from: getMailFrom(),
      hasPassword: Boolean(settings.pass),
      fallback587: String(process.env.MAIL_DISABLE_SMTP_FALLBACK || "").trim().toLowerCase() !== "true",
    };
  } catch (err: any) {
    return {
      configured: false,
      error: getPublicMailError(err),
    };
  }
}

export async function verifyMailConnection() {
  const settings = getMailSettings();

  try {
    await getMailer().verify();
    return {
      success: true,
      transport: `${settings.host}:${settings.port}${settings.secure ? "/SSL" : "/STARTTLS"}`,
    };
  } catch (err: any) {
    if (!shouldTrySmtpFallback(settings, err)) {
      throw withMailContext(err, settings);
    }

    const fallback = getMailSettings({
      port: 587,
      secure: false,
      label: "fallback-587",
    });

    try {
      await createMailer(fallback).verify();
      return {
        success: true,
        transport: `${fallback.host}:587/STARTTLS`,
        fallback: true,
        primaryError: getPublicMailError(err),
      };
    } catch (fallbackErr: any) {
      throw withMailContext(err, settings, fallbackErr);
    }
  }
}

export async function sendDiagnosticMail(to: string) {
  const target = String(to || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
    throw new Error("Email test chưa đúng định dạng.");
  }

  const smtpUser = String(process.env.MAIL_USER || "").trim();
  const subject = `VTDD - Test SMTP ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`;
  const text = [
    "Đây là email test SMTP từ web chính Viễn Thông Di Động.",
    `Thời gian: ${new Date().toISOString()}`,
    `Host: ${getMailDiagnosticsSnapshot().configured ? (getMailDiagnosticsSnapshot() as any).host : "Chưa cấu hình"}`,
  ].join("\n\n");

  const info = await sendMailWithFallback({
    from: getMailFrom(),
    envelope: smtpUser ? { from: smtpUser, to: target } : undefined,
    to: target,
    subject,
    headers: getAutoMailHeaders(),
    text,
    html: buildEmailShell({
      preheader: "Email test SMTP từ web chính Viễn Thông Di Động.",
      statusLabel: "SMTP Test",
      eyebrow: "Mail Diagnostics",
      title: "Test gửi mail thành công",
      description: "Nếu bạn nhận được email này, web chính đã kết nối được SMTP.",
      body: buildSuccessBox({
        title: "SMTP đã gửi email test.",
        desc: `Người nhận: ${target}`,
      }),
    }),
  });

  const report = buildDeliveryReport(info);
  ensureRecipientAccepted(report, target);
  return report;
}

export async function sendNewStaffAccountMail(params: {
  to?: string;
  maNV: string;
  staffName: string;
  gmail: string;
  adminUrl: string;
}) {
  const smtpUser = String(process.env.MAIL_USER || "").trim();
  const to = params.to || process.env.NEW_STAFF_NOTIFY_EMAIL || "tamlee070995@gmail.com";

  if (!to) {
    throw new Error("Thiếu email nhận thông báo tài khoản mới.");
  }

  const staffName = params.staffName || "Nhân viên mới";
  const adminUrl = safeUrl(params.adminUrl);

  const html = buildEmailShell({
    preheader: `Tài khoản mới ${params.maNV} đang chờ Admin duyệt Active.`,
    statusLabel: "Chờ duyệt",
    eyebrow: "New Staff Account",
    title: "Có tài khoản mới chờ duyệt",
    description: `Một nhân viên vừa tạo tài khoản trên hệ thống TCDM. Vui lòng kiểm tra thông tin và chuyển trạng thái <b style="color:#ffffff;">Active</b> nếu hợp lệ.`,
    body: `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="vtdd-card" style="border-radius:22px;border:1px solid #e5e7eb;background:#ffffff;overflow:hidden;">
        ${buildInfoRows([
          { label: "Mã nhân viên", value: params.maNV },
          { label: "Tên nhân viên", value: staffName },
          { label: "Gmail xác thực", value: params.gmail },
        ])}
      </table>
      ${buildActionButton("Mở trang Admin để duyệt", adminUrl)}
      ${buildWarningBox({
        title: "Gợi ý xử lý",
        desc: "Kiểm tra mã nhân viên, siêu thị/phòng ban và Gmail trước khi duyệt Active để tránh cấp nhầm tài khoản.",
      })}
    `,
  });

  const text = [
    "Có tài khoản mới chờ duyệt.",
    `Mã nhân viên: ${params.maNV}`,
    `Tên nhân viên: ${staffName}`,
    `Gmail xác thực: ${params.gmail}`,
    `Mở Admin: ${adminUrl}`,
  ].join("\n\n");

  const info = await sendMailWithFallback({
    from: getMailFrom(),
    envelope: smtpUser ? { from: smtpUser, to } : undefined,
    to,
    subject: `Viễn Thông Di Động - Tài khoản mới chờ duyệt: ${params.maNV}`,
    headers: getAutoMailHeaders(),
    text,
    html,
  });

  const report = buildDeliveryReport(info);
  ensureRecipientAccepted(report, to);

  return report;
}

export async function sendStaffActivatedMail(params: {
  to: string;
  staffName: string;
  maNV: string;
  loginUrl: string;
}) {
  const smtpUser = String(process.env.MAIL_USER || "").trim();
  const staffName = params.staffName || "Nhân viên";
  const loginUrl = safeUrl(params.loginUrl);

  const text = [
    `Xin chào ${staffName},`,
    `Tài khoản nhân viên ${params.maNV} của bạn đã được Admin duyệt Active trên trang TCDM.`,
    `Đăng nhập tại: ${loginUrl}`,
    "Email tự động từ hệ thống Viễn Thông Di Động.",
  ].join("\n\n");

  const html = buildEmailShell({
    preheader: `Tài khoản nhân viên ${params.maNV} đã được kích hoạt. Bạn có thể đăng nhập và sử dụng hệ thống.`,
    statusLabel: "Đã kích hoạt",
    eyebrow: "Account Activated",
    title: "Tài khoản của bạn đã sẵn sàng",
    description: `Xin chào <b style="color:#ffffff;">${escapeHtml(staffName)}</b>, tài khoản nhân viên <b style="color:#ffd400;">${escapeHtml(params.maNV)}</b> đã được Admin duyệt Active trên hệ thống TCDM.`,
    body: `
      ${buildSuccessBox({
        title: "Bạn có thể đăng nhập và sử dụng hệ thống ngay.",
        desc: "Sau khi đăng nhập lần đầu, hãy cập nhật Gmail, câu hỏi bảo mật và mật khẩu để bảo vệ tài khoản.",
      })}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="vtdd-card" style="margin-top:18px;border-radius:22px;border:1px solid #e5e7eb;background:#ffffff;overflow:hidden;">
        ${buildInfoRows([
          { label: "Mã nhân viên", value: params.maNV },
          { label: "Trạng thái", value: "Active - Đã được phép truy cập", accent: true },
        ])}
      </table>

      ${buildActionButton("Mở trang đăng nhập", loginUrl)}

      ${buildWarningBox({
        title: "Không mở được nút đăng nhập?",
        desc: `Copy link này và dán vào trình duyệt:<br><a href="${escapeHtml(loginUrl)}" target="_blank" style="color:#0f172a;font-weight:900;text-decoration:underline;">${escapeHtml(loginUrl)}</a>`,
      })}
    `,
  });

  const info = await sendMailWithFallback({
    from: getMailFrom(),
    envelope: smtpUser ? { from: smtpUser, to: params.to } : undefined,
    to: params.to,
    text,
    subject: "Viễn Thông Di Động - Tài khoản đã được kích hoạt",
    headers: getAutoMailHeaders(),
    html,
  });

  const report = buildDeliveryReport(info);
  ensureRecipientAccepted(report, params.to);

  return report;
}

export async function sendAdminLoginFailedAlertMail(params: {
  to: string[];
  attemptedMaNV: string;
  reason: string;
  ip: string;
  userAgent: string;
  failCount: number;
  adminUrl: string;
}) {
  const recipients = normalizeMailList(params.to);
  if (recipients.length === 0) {
    throw new Error("Thiếu email Admin nhận cảnh báo đăng nhập.");
  }

  const smtpUser = String(process.env.MAIL_USER || "").trim();
  const adminUrl = safeUrl(params.adminUrl);
  const attemptedMaNV = params.attemptedMaNV || "Không rõ";
  const ip = params.ip || "Không xác định";
  const userAgent = params.userAgent || "Không xác định";

  const html = buildEmailShell({
    preheader: `Cảnh báo ${params.failCount} lần đăng nhập Admin thất bại cho mã ${attemptedMaNV}.`,
    statusLabel: "Security Alert",
    eyebrow: "Admin Login Warning",
    title: "Có dấu hiệu đăng nhập Admin sai nhiều lần",
    description: `Hệ thống ghi nhận mã nhân viên <b style="color:#ffd400;">${escapeHtml(attemptedMaNV)}</b> đăng nhập Admin thất bại từ <b style="color:#ffd400;">${escapeHtml(params.failCount)}</b> lần trở lên. Vui lòng kiểm tra và cân nhắc chặn IP nếu có dấu hiệu spam.`,
    body: `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="vtdd-card" style="border-radius:22px;border:1px solid #fee2e2;background:#fff7f7;overflow:hidden;">
        ${buildInfoRows([
          { label: "Mã nhân viên nhập", value: attemptedMaNV },
          { label: "Số lần sai", value: `${params.failCount}`, accent: true },
          { label: "Lý do lần gần nhất", value: params.reason || "Đăng nhập không hợp lệ" },
          { label: "IP", value: ip },
          { label: "Thiết bị / trình duyệt", value: userAgent },
        ])}
      </table>

      ${buildActionButton("Mở trang Admin để kiểm tra", adminUrl)}

      ${buildWarningBox({
        title: "Gợi ý xử lý",
        desc: "Nếu IP lạ hoặc thử nhiều mã nhân viên khác nhau, hãy thêm IP vào danh sách chặn trong mục hệ thống tường lửa.",
      })}
    `,
  });

  const text = [
    "Cảnh báo đăng nhập Admin sai nhiều lần.",
    `Mã nhân viên nhập: ${attemptedMaNV}`,
    `Số lần sai: ${params.failCount}`,
    `Lý do: ${params.reason || "Đăng nhập không hợp lệ"}`,
    `IP: ${ip}`,
    `Thiết bị / trình duyệt: ${userAgent}`,
    `Admin: ${adminUrl}`,
  ].join("\n\n");

  const info = await sendMailWithFallback({
    from: getMailFrom(),
    envelope: smtpUser ? { from: smtpUser, to: recipients } : undefined,
    to: recipients.join(", "),
    subject: `Viễn Thông Di Động - Cảnh báo đăng nhập Admin sai: ${attemptedMaNV}`,
    headers: getAutoMailHeaders(),
    text,
    html,
  });

  const report = buildDeliveryReport(info);
  if (report.accepted.length === 0) {
    throw new Error(`SMTP chưa xác nhận người nhận cảnh báo Admin. ${report.response}`.trim());
  }

  return report;
}
