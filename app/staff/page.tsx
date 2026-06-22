import { redirect } from "next/navigation";
import { headers } from "next/headers";
import FirewallBlockedPage from "@/components/FirewallBlockedPage";
import StaffTradeInApp from "@/components/StaffTradeInApp";
import { checkFirewallAccess, getClientIpFromHeaders } from "@/lib/firewall";
import { getCurrentStaffFromCookies } from "@/lib/staff-auth";
import { getSystemSettings } from "@/lib/system-store";

export default async function StaffPage() {
  const currentStaff = await getCurrentStaffFromCookies();

  if (!currentStaff) {
    redirect("/login");
  }

  const headersList = await headers();
  const settings = await getSystemSettings();
  const firewall = checkFirewallAccess(settings, getClientIpFromHeaders(headersList));

  if (!firewall.allowed) {
    return <FirewallBlockedPage ip={firewall.ip} message={firewall.reason} />;
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
