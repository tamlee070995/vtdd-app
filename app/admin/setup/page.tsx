import { redirect } from "next/navigation";
import AdminProfileButton from "@/components/AdminProfileButton";
import { getCurrentAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminSetupPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (!admin.forceSetup) redirect("/admin");

  return (
    <main>
      <AdminProfileButton required mustChangePassword={admin.mustChangePassword} />
    </main>
  );
}
