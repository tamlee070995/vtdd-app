import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import OnlineHeartbeat from "@/components/OnlineHeartbeat";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

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
      <body className={roboto.className}suppressHydrationWarning>
        <OnlineHeartbeat />
        {children}
      </body>
    </html>
  );
}
