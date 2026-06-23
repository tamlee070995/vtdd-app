import type { Metadata } from "next";
import InstallAppClient from "@/components/InstallAppClient";

export const metadata: Metadata = {
  title: "Cài VTDD App",
  description: "Cài VTDD App lên màn hình chính trên Android Chrome hoặc Apple iOS Safari.",
  alternates: {
    canonical: "/install-app",
  },
};

export default function InstallAppPage() {
  return <InstallAppClient />;
}
