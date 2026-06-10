import AdminLoginForm from "@/components/AdminLoginForm";

type PageProps = {
  searchParams?: Promise<{ error?: string }> | { error?: string };
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const error = typeof params?.error === "string" ? params.error : "";

  return <AdminLoginForm initialError={error} />;
}
