import { redirect } from "next/navigation";
import StaffTradeInApp from "@/components/StaffTradeInApp";
import { getCurrentStaffFromCookies } from "@/lib/staff-auth";

export default async function StaffPage() {
  const currentStaff = await getCurrentStaffFromCookies();

  if (!currentStaff) {
    redirect("/login");
  }

  return (
    <StaffTradeInApp
      maNV={currentStaff.maNV}
      maST={currentStaff.maST}
      staffName={currentStaff.staffName}
      forceSetup={currentStaff.forceSetup}
    />
  );
}
