import SupportToolsPortal from "@/components/SupportToolsPortal";
import { getPublicSystemSettings } from "@/lib/system-store";
import { getPmhToolAvailability } from "@/lib/tool-settings";

export const dynamic = "force-dynamic";

export default async function SupportToolsPage() {
  const settings = await getPublicSystemSettings();
  const pmhAvailability = getPmhToolAvailability(settings);

  return <SupportToolsPortal pmhAvailability={pmhAvailability} />;
}
