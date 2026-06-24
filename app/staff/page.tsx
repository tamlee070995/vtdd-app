import { redirect } from "next/navigation";
import { headers } from "next/headers";
import FirewallBlockedPage from "@/components/FirewallBlockedPage";
import StaffTradeInApp from "@/components/StaffTradeInApp";
import { checkFirewallAccess, checkFirewallUserAccess, getClientIpFromHeaders } from "@/lib/firewall";
import { getCurrentStaffFromCookies } from "@/lib/staff-auth";
import { getSystemSettings } from "@/lib/system-store";

export default async function StaffPage() {
  const currentStaff = await getCurrentStaffFromCookies();

  if (!currentStaff) {
    redirect("/login");
  }

  const headersList = await headers();
  const settings = await getSystemSettings();
  const clientIp = getClientIpFromHeaders(headersList);
  const firewall = checkFirewallAccess(settings, clientIp);

  if (!firewall.allowed) {
    return <FirewallBlockedPage ip={firewall.ip} message={firewall.reason} />;
  }

  const userFirewall = checkFirewallUserAccess(settings, currentStaff.maNV, clientIp);

  if (!userFirewall.allowed) {
    return <FirewallBlockedPage ip={userFirewall.ip} user={userFirewall.user} message={userFirewall.reason} />;
  }

  return (
    <StaffTradeInApp
      maNV={currentStaff.maNV}
      maST={currentStaff.maST}
      staffName={currentStaff.staffName}
      forceSetup={currentStaff.forceSetup}
      mustChangePassword={currentStaff.mustChangePassword}
    />
  );
}
