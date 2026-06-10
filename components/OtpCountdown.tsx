"use client";

import { useEffect, useState } from "react";

function formatLeft(total: number) {
  const safe = Math.max(0, total);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function OtpCountdown({ seconds = 600 }: { seconds?: number }) {
  const [left, setLeft] = useState(seconds > 0 ? seconds : 600);

  useEffect(() => {
    const initial = seconds > 0 ? seconds : 600;
    setLeft(initial);
    const timer = window.setInterval(() => {
      setLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  const initial = seconds > 0 ? seconds : 600;
  const percent = Math.max(0, Math.min(100, Math.round((left / initial) * 100)));

  return (
    <section className="otp-countdown-card">
      <div>
        <span>Mã OTP còn hiệu lực</span>
        <b>{formatLeft(left)}</b>
      </div>
      <i><em style={{ width: `${percent}%` }} /></i>
      <p>{left > 0 ? "Không chia sẻ mã OTP cho bất kỳ ai." : "Mã OTP đã hết hạn. Vui lòng gửi lại mã mới."}</p>
    </section>
  );
}
