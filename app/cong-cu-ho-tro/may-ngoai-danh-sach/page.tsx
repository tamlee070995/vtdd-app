import PincodeRequestApp from "@/components/PincodeRequestApp";

export const dynamic = "force-dynamic";

export default function MayNgoaiDanhSachPage() {
  return (
    <PincodeRequestApp
      flow="NgoaiDS"
      title="Máy ngoài danh sách"
      subtitle="Gửi hồ sơ máy chưa có trong danh sách để ngành hàng thẩm định và cấp PMH TCDM."
    />
  );
}
