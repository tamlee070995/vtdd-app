import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import StaffTradeInApp from "@/components/StaffTradeInApp";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return value || "";
  }
}

export default async function StaffPage() {
  const cookieStore = await cookies();

  const maNV = cookieStore.get("vtdd_staff_nv")?.value || "";
  const maST = cookieStore.get("vtdd_staff_st")?.value || "";
  const staffName = safeDecode(cookieStore.get("vtdd_staff_name")?.value || "");
  const forceSetup = cookieStore.get("vtdd_staff_force_setup")?.value === "1";

  if (!maNV || !maST) {
    redirect("/login");
  }

  return (
    <StaffTradeInApp
      maNV={maNV}
      maST={maST}
      staffName={staffName}
      forceSetup={forceSetup}
    />
  );
}