import type { Metadata } from "next";
import "./globals.css";
import "sweetalert2/dist/sweetalert2.min.css";
import OnlineHeartbeat from "@/components/OnlineHeartbeat";

export const metadata: Metadata = {
  title: "VTDD.ONLINE",
  description: "Trade-in Value Portal",
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
