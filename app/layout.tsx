import type { Metadata, Viewport } from "next";

import "./roboto.css";
import "./globals.css";
import "./portal-ui.css";
import MobileViewport from "@/components/MobileViewport";
import NetworkStatus from "@/components/NetworkStatus";
import CmsImageLightbox from "@/components/CmsImageLightbox";
import FrontendErrorReporter from "@/components/FrontendErrorReporter";
import PwaRegister from "@/components/PwaRegister";
import AppBootSplash from "@/components/AppBootSplash";
import AppNavigationFeedback from "@/components/AppNavigationFeedback";
import PortalShell from "@/components/PortalShell";

export const metadata: Metadata = {
  metadataBase: new URL("https://vienthongdidong.com"),
  title: {
    default: "Ngành Hàng Viễn Thông Di Động",
    template: "%s | Viễn Thông Di Động",
  },
  description: "Trung Tâm Chính Sách & Nghiệp Vụ Sản Phẩm.",
  applicationName: "VTDD App",
  manifest: "/manifest.webmanifest?v=2",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "Viễn Thông Di Động",
    title: "Ngành Hàng Viễn Thông Di Động",
    description: "Trung Tâm Chính Sách & Nghiệp Vụ Sản Phẩm.",
    images: [{ url: "/brand/share-logo-v2.png", width: 1200, height: 1200, alt: "Viễn Thông Di Động" }],
  },
  twitter: {
    card: "summary",
    title: "Ngành Hàng Viễn Thông Di Động",
    description: "Trung Tâm Chính Sách & Nghiệp Vụ Sản Phẩm.",
    images: ["/brand/share-logo-v2.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VTDD App",
    startupImage: [
      {
        url: "/pwa/splash-1290x2796.png?v=2",
        media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/pwa/splash-1179x2556.png?v=2",
        media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/pwa/splash-1170x2532.png?v=2",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/pwa/splash-1125x2436.png?v=2",
        media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/pwa/splash-1242x2688.png?v=2",
        media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/pwa/splash-828x1792.png?v=2",
        media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/pwa/splash-750x1334.png?v=2",
        media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/pwa/splash-640x1136.png?v=2",
        media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/pwa/icon-512.png?v=2",
    shortcut: "/favicon.ico?v=2",
    apple: "/pwa/apple-touch-icon.png?v=2",
  },
};

export const viewport: Viewport = {
  themeColor: "#07111f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/roboto/roboto-latin-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/roboto/roboto-vietnamese-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/roboto/roboto-latin-ext-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning className="vtdd-ui">
        <MobileViewport />
        <NetworkStatus />

        <FrontendErrorReporter />
        <PwaRegister />
        <AppBootSplash />
        <AppNavigationFeedback><PortalShell>{children}</PortalShell></AppNavigationFeedback>
        <CmsImageLightbox />
      </body>
    </html>
  );
}
