"use client";

import { useEffect, useState } from "react";

export default function NetworkStatus() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(navigator.onLine === false);
    const frame = requestAnimationFrame(update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return offline ? <aside className="ui-offline" role="status"><b>Mất kết nối mạng</b><span>Nội dung bạn đang nhập vẫn được giữ. Kiểm tra Wi-Fi hoặc dữ liệu di động để tiếp tục.</span></aside> : null;
}
