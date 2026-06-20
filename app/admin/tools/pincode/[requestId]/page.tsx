import { redirect } from "next/navigation";
import PincodeReviewPage from "@/components/PincodeReviewPage";
import { adminCanUsePmhTool, requireAdminPage } from "@/lib/admin-auth";
import { getPincodeRequestById, getPmhStats } from "@/lib/pincode-store";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ requestId: string }> | { requestId: string };
};

export default async function AdminPincodeReviewPage({ params }: PageProps) {
  const admin = await requireAdminPage();

  if (!admin) {
    redirect("/admin/login");
  }

  if (!adminCanUsePmhTool(admin)) {
    redirect("/admin");
  }

  const resolvedParams = await params;
  const request = await getPincodeRequestById(resolvedParams.requestId);

  if (!request) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", fontFamily: "Roboto, Arial, sans-serif", background: "#eef3f8" }}>
        <section style={{ width: "min(100% - 24px, 520px)", padding: 24, borderRadius: 24, background: "#fff", border: "1px solid #dbe5ef", textAlign: "center" }}>
          <h1 style={{ margin: 0, color: "#07111f", fontSize: 28 }}>Không tìm thấy hồ sơ</h1>
          <p style={{ color: "#64748b", fontWeight: 850 }}>Hồ sơ có thể đã bị xóa hoặc không còn hợp lệ.</p>
        </section>
      </main>
    );
  }

  const pmhStats = await getPmhStats(request.flow);

  return <PincodeReviewPage request={request} pmhStats={pmhStats} adminName={admin.name} />;
}
