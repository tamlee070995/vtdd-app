import type { Metadata, Viewport } from "next";
import OnlineHeartbeat from "@/components/OnlineHeartbeat";
import "./globals.css";
import CmsImageLightbox from "@/components/CmsImageLightbox";
import FrontendErrorReporter from "@/components/FrontendErrorReporter";
import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: {
    default: "Ngành Hàng Viễn Thông Di Động",
    template: "%s | Viễn Thông Di Động",
  },
  description: "Trung Tâm Chính Sách & Nghiệp Vụ Sản Phẩm.",
  applicationName: "VTDD App",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VTDD App",
    startupImage: [
      {
        url: "/pwa/splash-1290x2796.png",
        media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/pwa/splash-1179x2556.png",
        media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/pwa/splash-1170x2532.png",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/pwa/splash-1125x2436.png",
        media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/pwa/splash-1242x2688.png",
        media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/pwa/splash-828x1792.png",
        media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/pwa/splash-750x1334.png",
        media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/pwa/splash-640x1136.png",
        media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/pwa/icon-512.png",
    apple: "/pwa/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#07111f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <OnlineHeartbeat />
        <FrontendErrorReporter />
        <PwaRegister />
        {children}
        <CmsImageLightbox />
      </body>
    </html>
  );
}
