import PincodeRequestApp from "@/components/PincodeRequestApp";

export const dynamic = "force-dynamic";

export default function ChienGiaPage() {
  return (
    <PincodeRequestApp
      flow="ChienGia"
      title="Tổng giá TCDM thấp hơn đối thủ"
      subtitle="Gửi thông tin máy, hình xác thực và ghi chú thẩm định để ngành hàng duyệt PMH."
    />
  );
}
