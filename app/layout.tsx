import type { Metadata } from "next";
import OnlineHeartbeat from "@/components/OnlineHeartbeat";
import "./globals.css";
import CmsImageLightbox from "@/components/CmsImageLightbox";
import FrontendErrorReporter from "@/components/FrontendErrorReporter";

export const metadata: Metadata = {
  title: {
    default: "Ngành Hàng Viễn Thông Di Động",
    template: "%s | Viễn Thông Di Động",
  },
  description: "Trung Tâm Chính Sách & Nghiệp Vụ Sản Phẩm.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <OnlineHeartbeat />
        <FrontendErrorReporter />
        {children}
        <CmsImageLightbox />
      </body>
    </html>
  );
}
