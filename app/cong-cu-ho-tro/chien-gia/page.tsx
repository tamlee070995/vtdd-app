import PincodeRequestApp from "@/components/PincodeRequestApp";
import PmhToolClosedPage from "@/components/PmhToolClosedPage";
import { getPublicSystemSettings } from "@/lib/system-store";
import { getPmhToolAvailability } from "@/lib/tool-settings";

export const dynamic = "force-dynamic";

export default async function ChienGiaPage() {
  const settings = await getPublicSystemSettings();
  const availability = getPmhToolAvailability(settings);

  if (!availability.enabled) {
    return (
      <PmhToolClosedPage
        title="Tổng giá TCDM thấp hơn đối thủ"
        reason={availability.reason}
      />
    );
  }

  return (
    <PincodeRequestApp
      flow="ChienGia"
      title="Tổng giá TCDM thấp hơn đối thủ"
      subtitle="Gửi thông tin máy, hình xác thực và ghi chú thẩm định để ngành hàng duyệt PMH."
    />
  );
}
