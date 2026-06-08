import type { Metadata, Viewport } from "next";
import "./globals.css";
import "sweetalert2/dist/sweetalert2.min.css";
import OnlineHeartbeat from "@/components/OnlineHeartbeat";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://vtdd.online"),
  title: {
    default: "VTDD.ONLINE | Tra Cứu Thu Cũ",
    template: "%s | VTDD.ONLINE",
  },
  description: "Cổng tra cứu thu cũ đổi mới dành cho nhân viên MWG và khách hàng.",
  applicationName: "VTDD.ONLINE",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffd400",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        <OnlineHeartbeat />
        {children}
      </body>
    </html>
  );
}
