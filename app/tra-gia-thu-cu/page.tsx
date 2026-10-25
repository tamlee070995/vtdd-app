import type { Metadata, Viewport } from "next";
import TradeinLookup from "@/components/TradeinLookup";

export const metadata: Metadata = {
  title: "Tra cứu giá thu cũ đổi mới",
  description: "Tra giá máy cũ theo Loại 1–5 và mức trợ giá lên đời máy mới. Tra cứu trực tiếp, không cần đăng nhập.",
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, maximumScale: 5, viewportFit: "cover",
};
export default function TradeinPage() { return <TradeinLookup />; }
