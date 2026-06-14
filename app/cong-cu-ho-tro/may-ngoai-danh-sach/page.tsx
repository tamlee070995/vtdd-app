import PincodeRequestApp from "@/components/PincodeRequestApp";
import PmhToolClosedPage from "@/components/PmhToolClosedPage";
import { getPublicSystemSettings } from "@/lib/system-store";
import { getPmhToolAvailability } from "@/lib/tool-settings";

export const dynamic = "force-dynamic";

export default async function MayNgoaiDanhSachPage() {
  const settings = await getPublicSystemSettings();
  const availability = getPmhToolAvailability(settings);

  if (!availability.enabled) {
    return (
      <PmhToolClosedPage
        title="Máy ngoài danh sách"
        reason={availability.reason}
      />
    );
  }

  return (
    <PincodeRequestApp
      flow="NgoaiDS"
      title="Máy ngoài danh sách"
      subtitle="Gửi hồ sơ máy chưa có trong danh sách để ngành hàng thẩm định và cấp PMH TCDM."
    />
  );
}
