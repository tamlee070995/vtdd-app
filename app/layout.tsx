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
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
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
