import SupportToolsPortal from "@/components/SupportToolsPortal";
import { getCurrentStaffFromCookies } from "@/lib/staff-auth";
import { staffHasCheckinToolAccess } from "@/lib/staff-store";
import { getPublicSystemSettings } from "@/lib/system-store";
import { getCheckinToolAvailability, getPmhToolAvailability } from "@/lib/tool-settings";

export const dynamic = "force-dynamic";

export default async function SupportToolsPage() {
  const settings = await getPublicSystemSettings();
  const pmhAvailability = getPmhToolAvailability(settings);
  const checkinAvailability = getCheckinToolAvailability(settings);
  const currentStaff = await getCurrentStaffFromCookies();
  const checkinAccess = staffHasCheckinToolAccess(currentStaff?.staff);

  return (
    <SupportToolsPortal
      pmhAvailability={pmhAvailability}
      checkinAvailability={checkinAvailability}
      checkinAccess={checkinAccess}
      checkinSignedIn={Boolean(currentStaff)}
    />
  );
}
