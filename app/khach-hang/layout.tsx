import { headers } from "next/headers";
import type { ReactNode } from "react";
import FirewallBlockedPage from "@/components/FirewallBlockedPage";
import { checkFirewallAccess, getClientIpFromHeaders } from "@/lib/firewall";
import { getSystemSettings } from "@/lib/system-store";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const headersList = await headers();
  const settings = await getSystemSettings();
  const firewall = checkFirewallAccess(settings, getClientIpFromHeaders(headersList));

  if (!firewall.allowed) {
    return <FirewallBlockedPage ip={firewall.ip} message={firewall.reason} />;
  }

  return children;
}
