"use client";

import { useEffect, useMemo, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type DeviceType = "unknown" | "android" | "ios" | "desktop" | "installed";

type BrowserProfile = {
  device: DeviceType;
  isChrome: boolean;
  isSafari: boolean;
  isInApp: boolean;
  inAppName: string;
};

const CHROME_PLAY_URL = "https://play.google.com/store/apps/details?id=com.android.chrome&hl=vi";
const IOS_INSTALL_IMAGES = [
  {
    step: "1",
    title: "Mở link trong Safari",
    src: "/install-app/ios-step-1-safari.png",
    alt: "Ảnh hướng dẫn mở link cài VTDD App trong Safari trên Apple iOS",
  },
  {
    step: "2",
    title: "Bấm nút Chia sẻ",
    src: "/install-app/ios-step-2-share.png",
    alt: "Ảnh hướng dẫn bấm nút Chia sẻ trên Safari Apple iOS",
  },
  {
    step: "3",
    title: "Thêm vào màn hình chính",
    src: "/install-app/ios-step-3-add-home.png",
    alt: "Ảnh hướng dẫn chọn Thêm vào màn hình chính trên Apple iOS",
  },
];

const DEFAULT_PROFILE: BrowserProfile = {
  device: "unknown",
  isChrome: false,
  isSafari: false,
  isInApp: false,
  inAppName: "",
};

const INSTALL_STYLE = `
.install-app-page {
  min-height: 100vh;
  padding: max(18px, env(safe-area-inset-top)) 12px max(24px, env(safe-area-inset-bottom));
  display: flex;
  justify-content: center;
  background:
    radial-gradient(circle at 15% 0%, rgba(255, 212, 0, .26), transparent 32%),
    radial-gradient(circle at 92% 10%, rgba(37, 99, 235, .12), transparent 30%),
    linear-gradient(180deg, #ffffff 0%, #f8fafc 46%, #e8eef6 100%);
  color: #07111f;
}

.install-app-shell {
  width: min(100%, 980px);
  display: grid;
  gap: 14px;
}

.install-app-topbar {
  min-height: 64px;
  padding: 10px;
  border-radius: 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #07111f;
  color: #ffffff;
  box-shadow: 0 18px 48px rgba(15, 23, 42, .16);
}

.install-app-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.install-app-logo {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: #ffd400;
  overflow: hidden;
  flex: 0 0 auto;
}

.install-app-logo img {
  width: 82%;
  height: 82%;
  object-fit: contain;
}

.install-app-brand b,
.install-app-brand span {
  display: block;
}

.install-app-brand b {
  font-size: 17px;
  line-height: 1.05;
  font-weight: 1000;
}

.install-app-brand span {
  margin-top: 3px;
  color: rgba(255,255,255,.62);
  font-size: 10px;
  line-height: 1;
  font-weight: 950;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.install-app-hero {
  position: relative;
  overflow: hidden;
  min-height: 300px;
  padding: 28px;
  border-radius: 34px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  gap: 20px;
  align-items: stretch;
  background: linear-gradient(135deg, #07111f 0%, #101a2d 56%, #252510 100%);
  color: #ffffff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, .18);
}

.install-app-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 90% 4%, rgba(255, 212, 0, .46), transparent 28%),
    repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 1px, transparent 1px 16px);
  opacity: .8;
}

.install-app-hero-main,
.install-app-phone-card {
  position: relative;
  z-index: 1;
}

.install-app-badge {
  width: fit-content;
  padding: 8px 11px;
  border-radius: 999px;
  background: rgba(255,255,255,.10);
  border: 1px solid rgba(255,255,255,.16);
  color: #ffd400;
  font-size: 10px;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.install-app-hero h1 {
  max-width: 650px;
  margin-top: 24px;
  color: #ffffff;
  font-size: clamp(42px, 8vw, 76px);
  line-height: .88;
  letter-spacing: -0.075em;
  font-weight: 1000;
}

.install-app-hero p {
  max-width: 620px;
  margin-top: 18px;
  color: rgba(255,255,255,.72);
  font-size: 15px;
  line-height: 1.6;
  font-weight: 800;
}

.install-app-primary-actions {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.install-app-primary,
.install-app-secondary {
  min-height: 52px;
  padding: 0 18px;
  border-radius: 17px;
  border: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 1000;
  cursor: pointer;
}

.install-app-primary {
  background: #ffd400;
  color: #07111f;
  box-shadow: 0 18px 42px rgba(255, 212, 0, .22);
}

.install-app-primary:disabled {
  opacity: .55;
  cursor: not-allowed;
  box-shadow: none;
}

.install-app-secondary {
  background: rgba(255,255,255,.10);
  border: 1px solid rgba(255,255,255,.18);
  color: #ffffff;
}

.install-app-note,
.install-app-status {
  margin-top: 12px;
  padding: 12px 13px;
  border-radius: 17px;
  font-size: 12px;
  line-height: 1.45;
  font-weight: 850;
}

.install-app-note {
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.08);
  color: rgba(255,255,255,.76);
}

.install-app-status {
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  color: #065f46;
}

.install-app-phone-card {
  padding: 18px;
  border-radius: 28px;
  background: rgba(255,255,255,.10);
  border: 1px solid rgba(255,255,255,.16);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.18);
}

.install-app-phone-screen {
  min-height: 100%;
  padding: 16px;
  border-radius: 22px;
  background: #f8fafc;
  color: #07111f;
  display: grid;
  gap: 10px;
  align-content: start;
}

.install-app-mini-top {
  min-height: 52px;
  padding: 8px;
  border-radius: 18px;
  background: #07111f;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
}

.install-app-mini-top i {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: #ffd400;
  overflow: hidden;
}

.install-app-mini-top img {
  width: 82%;
  height: 82%;
  object-fit: contain;
}

.install-app-mini-top b {
  font-size: 13px;
  font-weight: 1000;
}

.install-app-mini-card {
  min-height: 74px;
  padding: 13px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
}

.install-app-mini-card span {
  color: #64748b;
  font-size: 10px;
  font-weight: 1000;
  text-transform: uppercase;
}

.install-app-mini-card b {
  display: block;
  margin-top: 5px;
  font-size: 18px;
  line-height: 1.1;
  font-weight: 1000;
}

.install-app-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.install-app-card {
  padding: 18px;
  border-radius: 26px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 14px 38px rgba(15, 23, 42, .06);
}

.install-app-card.active {
  border-color: rgba(255, 212, 0, .9);
  box-shadow: 0 20px 52px rgba(255, 212, 0, .14);
}

.install-app-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.install-app-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.install-app-title i {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: #07111f;
  color: #ffd400;
  font-style: normal;
  font-weight: 1000;
}

.install-app-title h2 {
  margin: 0;
  color: #07111f;
  font-size: 20px;
  line-height: 1.08;
  font-weight: 1000;
  letter-spacing: -0.04em;
}

.install-app-detect {
  padding: 8px 10px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  font-size: 10px;
  line-height: 1;
  font-weight: 1000;
  white-space: nowrap;
}

.install-app-card p {
  margin-top: 10px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.55;
  font-weight: 800;
}

.install-app-desktop-note {
  padding: 20px;
  border-radius: 26px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  box-shadow: 0 14px 38px rgba(15, 23, 42, .06);
}

.install-app-desktop-note p {
  margin: 10px 0 0;
  color: #9a3412;
  font-size: 13px;
  line-height: 1.55;
  font-weight: 900;
}

.install-app-steps {
  margin-top: 14px;
  display: grid;
  gap: 8px;
  list-style: none;
}

.install-app-steps li {
  display: grid;
  grid-template-columns: 34px 1fr;
  align-items: start;
  gap: 10px;
  padding: 10px;
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #07111f;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 850;
}

.install-app-steps span {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: #ffd400;
  color: #07111f;
  font-size: 11px;
  font-weight: 1000;
}

.install-app-ios-visuals {
  margin-top: 14px;
  display: grid;
  gap: 10px;
}

.install-app-ios-visual {
  overflow: hidden;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid #dbe3ef;
  box-shadow: 0 12px 30px rgba(15, 23, 42, .06);
}

.install-app-ios-visual-head {
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #07111f;
  font-size: 12px;
  font-weight: 1000;
}

.install-app-ios-visual-head span {
  min-width: 28px;
  height: 28px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: #ffd400;
  color: #07111f;
}

.install-app-ios-image {
  display: block;
  width: 100%;
  height: auto;
  border-top: 1px solid #e2e8f0;
  background: #eef4fb;
}

.install-app-card-actions {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.install-app-card-actions a,
.install-app-card-actions button {
  min-height: 46px;
  border-radius: 15px;
  border: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #07111f;
  color: #ffd400;
  font-size: 12px;
  font-weight: 1000;
  cursor: pointer;
}

.install-app-card-actions a.light {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
}

@media (max-width: 860px) {
  .install-app-hero,
  .install-app-grid {
    grid-template-columns: 1fr;
  }

  .install-app-phone-card {
    display: none;
  }
}

@media (max-width: 520px) {
  .install-app-page {
    padding-inline: 8px;
  }

  .install-app-topbar,
  .install-app-hero,
  .install-app-card {
    border-radius: 22px;
  }

  .install-app-hero {
    min-height: 0;
    padding: 22px;
  }

  .install-app-hero h1 {
    margin-top: 22px;
    font-size: clamp(42px, 13vw, 58px);
  }

  .install-app-primary-actions {
    display: grid;
  }

  .install-app-primary,
  .install-app-secondary {
    width: 100%;
  }
}
`;

function detectProfile(): BrowserProfile {
  const ua = navigator.userAgent || "";
  const lower = ua.toLowerCase();
  const isAndroid = lower.includes("android");
  const isIos = /iphone|ipad|ipod/.test(lower);
  const isDesktop = /windows|macintosh|mac os x|linux|cros/.test(lower) && !isAndroid && !isIos;
  const isChrome = lower.includes("chrome/") && !lower.includes("edg/") && !lower.includes("samsungbrowser");
  const isSafari = isIos && lower.includes("safari") && !lower.includes("crios") && !lower.includes("fxios");
  const inAppChecks = [
    { name: "LINE", test: lower.includes(" line/") || lower.includes("line/") },
    { name: "Zalo", test: lower.includes("zalo") },
    { name: "Facebook", test: lower.includes("fbav") || lower.includes("fban") },
    { name: "Messenger", test: lower.includes("messenger") },
  ];
  const inApp = inAppChecks.find((item) => item.test);

  return {
    device: isAndroid ? "android" : isIos ? "ios" : isDesktop ? "desktop" : "unknown",
    isChrome,
    isSafari,
    isInApp: Boolean(inApp),
    inAppName: inApp?.name || "",
  };
}

function isStandaloneMode() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || Boolean(nav.standalone);
}

export default function InstallAppClient() {
  const [profile, setProfile] = useState<BrowserProfile>(DEFAULT_PROFILE);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [status, setStatus] = useState("Đang nhận biết thiết bị để hiển thị hướng dẫn phù hợp.");

  useEffect(() => {
    const current = detectProfile();
    const installed = isStandaloneMode();

    setProfile(installed ? { ...current, device: "installed" } : current);
    setStatus(
      installed
        ? "VTDD App đang chạy ở chế độ app."
        : current.device === "ios"
          ? "Đã nhận biết Apple iOS. Hãy mở bằng Safari rồi thêm vào màn hình chính."
          : current.device === "android"
            ? "Đã nhận biết Android. Hãy mở bằng Chrome để cài VTDD App."
            : current.device === "desktop"
              ? "Đã nhận biết Desktop/PC/Laptop. Link cài VTDD App chỉ áp dụng cho điện thoại hoặc tablet."
              : "Không nhận biết được hệ điều hành. Hãy mở link bằng Android Chrome hoặc iPhone Safari."
    );

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setStatus("Chrome đã sẵn sàng cài VTDD App. Bấm Cài VTDD App để mở popup cài app.");
    };

    const handleInstalled = () => {
      setProfile((prev) => ({ ...prev, device: "installed" }));
      setPromptEvent(null);
      setStatus("VTDD App đã được cài trên thiết bị.");
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const browserLabel = useMemo(() => {
    if (profile.device === "installed") return "Đã cài VTDD App";
    if (profile.device === "android") return profile.isChrome ? "Android Chrome" : "Android";
    if (profile.device === "ios") return profile.isSafari ? "Apple iOS Safari" : "Apple iOS";
    if (profile.device === "desktop") return "Desktop / PC / Laptop";
    return "Đang nhận biết";
  }, [profile]);

  async function installOnChrome() {
    if (profile.device === "installed") {
      setStatus("Thiết bị này đang mở VTDD App ở dạng app.");
      return;
    }

    if (profile.device !== "android") {
      setStatus("Nút cài trực tiếp chỉ dùng cho Android Chrome. Apple iOS cần mở Safari và chọn Thêm vào màn hình chính.");
      return;
    }

    if (!profile.isChrome) {
      setStatus("Thiết bị Android cần mở bằng Chrome. Nếu chưa có Chrome, hãy tải Chrome trên CH Play.");
      return;
    }

    if (!promptEvent) {
      setStatus("Chrome chưa trả về popup cài app. Hãy đợi trang tải xong hoặc tải lại trang trong Chrome rồi thử lại.");
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => null);
    setPromptEvent(null);

    if (choice?.outcome === "accepted") {
      setStatus("Đã gửi yêu cầu cài VTDD App. Nếu app chưa hiện, kiểm tra màn hình chính của thiết bị.");
    } else {
      setStatus("Bạn đã đóng popup cài app. Có thể tải lại trang bằng Chrome rồi bấm Cài VTDD App lại.");
    }
  }

  const iosActive = profile.device === "ios";
  const androidActive = profile.device === "android";
  const desktopActive = profile.device === "desktop";
  const shouldShowAndroidGuide = androidActive || profile.device === "unknown" || profile.device === "installed";
  const shouldShowIosGuide = iosActive || profile.device === "unknown";

  return (
    <main className="install-app-page">
      <style>{INSTALL_STYLE}</style>

      <section className="install-app-shell">
        <header className="install-app-topbar">
          <div className="install-app-brand">
            <div className="install-app-logo">
              <img src="/mwg-logo.svg" alt="VTDD App" />
            </div>
            <div>
              <b>Viễn Thông Di Động</b>
              <span>VTDD App</span>
            </div>
          </div>
        </header>

        <section className="install-app-hero">
          <div className="install-app-hero-main">
            <div className="install-app-badge">Cài đặt web app</div>
            <h1>Cài VTDD App lên màn hình chính.</h1>

            {(androidActive || profile.device === "installed") && (
              <>
                <div className="install-app-primary-actions">
                  <button
                    type="button"
                    className="install-app-primary"
                    onClick={installOnChrome}
                    disabled={profile.device === "installed"}
                  >
                    {profile.device === "installed" ? "Đã cài VTDD App" : "Cài VTDD App"}
                  </button>
                </div>
              </>
            )}
          </div>

          <aside className="install-app-phone-card" aria-label="Mô phỏng VTDD App">
            <div className="install-app-phone-screen">
              <div className="install-app-mini-top">
                <i>
                  <img src="/mwg-logo.svg" alt="" />
                </i>
                <b>VTDD App</b>
              </div>
              <div className="install-app-mini-card">
                <span>Thiết bị</span>
                <b>{browserLabel}</b>
              </div>
              <div className="install-app-mini-card">
                <span>Đường dẫn</span>
                <b>/install-app</b>
              </div>
              <div className="install-app-status">
                Cài app để mở nhanh như ứng dụng riêng trên màn hình chính.
              </div>
            </div>
          </aside>
        </section>

        {desktopActive && (
          <section className="install-app-desktop-note" role="status">
            <div className="install-app-title">
              <i>PC</i>
              <h2>Link cài chỉ áp dụng cho điện thoại/tablet</h2>
            </div>
            <p>
              Hệ thống nhận biết thiết bị hiện tại là Desktop/PC/Laptop. Vui lòng mở
              https://vienthongdidong.com/install-app bằng Android hoặc Apple iOS để cài VTDD App ra màn hình chính.
            </p>
          </section>
        )}

        {!desktopActive && (
        <section className="install-app-grid">
          {shouldShowAndroidGuide && (
          <article className={androidActive ? "install-app-card active" : "install-app-card"}>
            <div className="install-app-card-head">
              <div className="install-app-title">
                <i>01</i>
                <h2>Hướng dẫn cài đặt</h2>
              </div>
              {androidActive && <span className="install-app-detect">Đã nhận biết</span>}
            </div>
            <p>Mở bằng Chrome để hiện popup cài VTDD App. Nếu chưa có Chrome, tải Chrome trên CH Play rồi quay lại link này.</p>
            <ol className="install-app-steps">
              <li>
                <span>1</span>
                <b>Mở link bằng Chrome.</b>
              </li>
              <li>
                <span>2</span>
                <b>Bấm Cài VTDD App.</b>
              </li>
              <li>
                <span>3</span>
                <b>Xác nhận Cài đặt trong popup của Chrome.</b>
              </li>
            </ol>
            <div className="install-app-card-actions">
              <a className="light" href={CHROME_PLAY_URL} target="_blank" rel="noreferrer">
                Tải Chrome trên CH Play
              </a>
            </div>
          </article>
          )}

          {shouldShowIosGuide && (
          <article className={iosActive ? "install-app-card active" : "install-app-card"}>
            <div className="install-app-card-head">
              <div className="install-app-title">
                <i>{iosActive ? "01" : "02"}</i>
                <h2>Hướng dẫn cài đặt</h2>
              </div>
              {iosActive && <span className="install-app-detect">Đã nhận biết</span>}
            </div>
            <p>Apple yêu cầu người dùng tự thêm web vào màn hình chính bằng Safari.</p>
            {iosActive && (
              <div className="install-app-ios-visuals" aria-label="Hình ảnh hướng dẫn Apple iOS">
                {IOS_INSTALL_IMAGES.map((image) => (
                  <div className="install-app-ios-visual" key={image.step}>
                    <div className="install-app-ios-visual-head">
                      <span>{image.step}</span>
                      <b>{image.title}</b>
                    </div>
                    <img className="install-app-ios-image" src={image.src} alt={image.alt} />
                  </div>
                ))}
              </div>
            )}
          </article>
          )}
        </section>
        )}
      </section>
    </main>
  );
}
