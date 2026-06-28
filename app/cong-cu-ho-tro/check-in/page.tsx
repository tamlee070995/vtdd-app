import Link from "next/link";
import CheckinToolApp from "@/components/CheckinToolApp";
import { getCurrentStaffFromCookies } from "@/lib/staff-auth";
import { staffHasCheckinToolAccess } from "@/lib/staff-store";
import { getPublicSystemSettings } from "@/lib/system-store";
import { getCheckinToolAvailability } from "@/lib/tool-settings";

export const dynamic = "force-dynamic";

function CheckinAccessBlocked({ signedIn }: { signedIn: boolean }) {
  return (
    <main className="checkin-access-page">
      <style>{`
        .checkin-access-page {
          min-height: 100dvh;
          padding: 22px;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at 10% 0%, rgba(255, 212, 0, .22), transparent 30%),
            radial-gradient(circle at 95% 12%, rgba(59, 130, 246, .13), transparent 30%),
            #eef3f8;
          color: #07111f;
          font-family: Roboto, Arial, sans-serif;
        }
        .checkin-access-card {
          width: min(100%, 520px);
          padding: 28px;
          border-radius: 28px;
          background: #fff;
          border: 1px solid #dbe5f0;
          box-shadow: 0 24px 76px rgba(15,23,42,.14);
        }
        .checkin-access-logo {
          width: 64px;
          height: 64px;
          border-radius: 20px;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: #ffd400;
          margin-bottom: 18px;
        }
        .checkin-access-logo img { width: 100%; height: 100%; object-fit: contain; }
        .checkin-access-card span {
          display: inline-flex;
          padding: 8px 12px;
          border-radius: 999px;
          background: #07111f;
          color: #ffd400;
          font-size: 11px;
          font-weight: 1000;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .checkin-access-card h1 {
          margin: 14px 0 10px;
          font-size: clamp(28px, 7vw, 44px);
          line-height: .98;
          letter-spacing: 0;
        }
        .checkin-access-card p {
          margin: 0 0 20px;
          color: #52627a;
          font-size: 15px;
          font-weight: 800;
          line-height: 1.55;
        }
        .checkin-access-actions {
          display: grid;
          gap: 10px;
        }
        .checkin-access-actions form {
          margin: 0;
        }
        .checkin-access-actions a,
        .checkin-access-actions button {
          min-height: 50px;
          width: 100%;
          border: 0;
          border-radius: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          font-size: 13px;
          font-weight: 1000;
          text-transform: uppercase;
          font-family: inherit;
          cursor: pointer;
        }
        .checkin-access-actions a.primary {
          background: #ffd400;
          color: #07111f;
        }
        .checkin-access-actions button.secondary {
          background: #07111f;
          color: #fff;
        }
      `}</style>
      <section className="checkin-access-card">
        <div className="checkin-access-logo">
          <img src="/mwg-logo.svg" alt="MWG" />
        </div>
        <span>Internal Tool</span>
        <h1>Check-in chỉ dành cho tài khoản được cấp quyền</h1>
        <p>
          {signedIn
            ? "Tài khoản của bạn chưa được Admin cấp quyền dùng công cụ Check-in. Vui lòng liên hệ Admin để được mở quyền."
            : "Vui lòng đăng nhập bằng tài khoản nhân viên đã được cấp quyền Check-in trước khi sử dụng công cụ này."}
        </p>
        <div className="checkin-access-actions">
          <Link className="primary" href="/login?next=/cong-cu-ho-tro/check-in">Đăng nhập nhân viên</Link>
          <form action="/api/auth/staff-logout" method="POST">
            <input type="hidden" name="next" value="/cong-cu-ho-tro" />
            <button className="secondary" type="submit">Về cổng hỗ trợ</button>
          </form>
        </div>
      </section>
    </main>
  );
}

function CheckinClosed({ reason }: { reason: string }) {
  return (
    <main className="checkin-access-page">
      <style>{`
        .checkin-access-page {
          min-height: 100dvh;
          padding: 22px;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at 10% 0%, rgba(255, 212, 0, .22), transparent 30%),
            radial-gradient(circle at 95% 12%, rgba(59, 130, 246, .13), transparent 30%),
            #eef3f8;
          color: #07111f;
          font-family: Roboto, Arial, sans-serif;
        }
        .checkin-access-card {
          width: min(100%, 520px);
          padding: 28px;
          border-radius: 28px;
          background: #fff;
          border: 1px solid #fed7aa;
          box-shadow: 0 24px 76px rgba(15,23,42,.14);
        }
        .checkin-access-logo {
          width: 64px;
          height: 64px;
          border-radius: 20px;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: #ffd400;
          margin-bottom: 18px;
        }
        .checkin-access-logo img { width: 100%; height: 100%; object-fit: contain; }
        .checkin-access-card span {
          display: inline-flex;
          padding: 8px 12px;
          border-radius: 999px;
          background: #fff7ed;
          color: #9a3412;
          font-size: 11px;
          font-weight: 1000;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .checkin-access-card h1 {
          margin: 14px 0 10px;
          font-size: clamp(28px, 7vw, 44px);
          line-height: .98;
          letter-spacing: 0;
        }
        .checkin-access-card p {
          margin: 0 0 20px;
          color: #52627a;
          font-size: 15px;
          font-weight: 800;
          line-height: 1.55;
        }
        .checkin-access-card a {
          min-height: 50px;
          width: 100%;
          border-radius: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #ffd400;
          color: #07111f;
          text-decoration: none;
          font-size: 13px;
          font-weight: 1000;
          text-transform: uppercase;
        }
      `}</style>
      <section className="checkin-access-card">
        <div className="checkin-access-logo">
          <img src="/mwg-logo.svg" alt="MWG" />
        </div>
        <span>Ngoài giờ chạy</span>
        <h1>Check-in đang tạm đóng</h1>
        <p>{reason || "Công cụ Check-in đang tạm đóng theo cài đặt Admin."}</p>
        <Link href="/cong-cu-ho-tro">Về cổng hỗ trợ</Link>
      </section>
    </main>
  );
}

export default async function CheckinPage() {
  const settings = await getPublicSystemSettings();
  const availability = getCheckinToolAvailability(settings);

  if (!availability.enabled) {
    return <CheckinClosed reason={availability.reason} />;
  }

  const current = await getCurrentStaffFromCookies();

  if (!current) {
    return <CheckinAccessBlocked signedIn={false} />;
  }

  if (!staffHasCheckinToolAccess(current.staff)) {
    return <CheckinAccessBlocked signedIn />;
  }

  return <CheckinToolApp />;
}
