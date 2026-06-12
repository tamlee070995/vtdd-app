import { NextRequest, NextResponse } from "next/server";
import {
  getHomeCmsItems,
  HOME_CMS_SLUGS,
  publishHomeCmsItem,
  saveHomeCmsDraft,
  unpublishHomeCmsItem,
  type HomeCmsSlug,
} from "@/lib/home-cms-store";
import { adminCanAccessModule, requireAdminApi, type AdminModuleKey } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function validSlug(value: any): HomeCmsSlug | null {
  const slug = String(value || "").trim() as HomeCmsSlug;
  return HOME_CMS_SLUGS.includes(slug) ? slug : null;
}

export async function GET() {
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  const items = await getHomeCmsItems();
  const visibleItems = { ...items };

  HOME_CMS_SLUGS.forEach((slug) => {
    if (adminCanAccessModule(admin, slug as AdminModuleKey)) return;

    visibleItems[slug] = {
      ...items[slug],
      title: "",
      summary: "",
      body: "",
      draftTitle: "",
      draftSummary: "",
      draftBody: "",
      published: false,
    };
  });

  return NextResponse.json({
    success: true,
    items: visibleItems,
    permission: admin?.permission || "",
    modules: admin?.modules || [],
  });
}

export async function POST(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req);
  if (response) return response;

  try {
    const body = await req.json();
    const slug = validSlug(body.slug);
    const action = String(body.action || "").trim().toUpperCase();

    if (!slug) {
      return NextResponse.json({ success: false, message: "Slug trang không hợp lệ." }, { status: 400 });
    }

    if (!adminCanAccessModule(admin, slug as AdminModuleKey)) {
      return NextResponse.json({ success: false, message: "Không có quyền truy cập." }, { status: 403 });
    }

    if (action === "SAVE_DRAFT") {
      await saveHomeCmsDraft(
        slug,
        {
          title: body.title || "",
          summary: body.summary || "",
          body: body.body || "",
        },
        admin?.name || "Admin"
      );

      return NextResponse.json({ success: true, message: "Đã lưu bản nháp." });
    }

    if (action === "PUBLISH") {
      await publishHomeCmsItem(slug, admin?.name || "Admin");
      return NextResponse.json({ success: true, message: "Đã xuất bản nội dung ra trang chủ." });
    }

    if (action === "UNPUBLISH") {
      await unpublishHomeCmsItem(slug, admin?.name || "Admin");
      return NextResponse.json({ success: true, message: "Đã ngừng xuất bản. Trang chủ sẽ hiện Đang cập nhật." });
    }

    return NextResponse.json({ success: false, message: "Action không hợp lệ." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không lưu được nội dung CMS." },
      { status: 500 }
    );
  }
}
