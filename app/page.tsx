import HomePortal, { type HomeGroup, type HomeTool } from "@/components/HomePortal";
import { getHomeCmsItems, type HomeCmsItem } from "@/lib/home-cms-store";

export const dynamic = "force-dynamic";

function cmsTool(item: HomeCmsItem): HomeTool {
  return {
    title: item.published ? item.title : item.draftTitle,
    desc: item.published ? item.summary : item.draftSummary,
    icon: "document",
    ...(item.published ? { href: `/p/${item.slug}` } : { status: "Đang cập nhật" }),
  };
}

export default async function HomePage() {
  const cms = await getHomeCmsItems();
  const groups: HomeGroup[] = [
    {
      id: "he-thu-cu-doi-moi", title: "Thu cũ đổi mới", navTitle: "Thu cũ đổi mới", shortTitle: "Thu cũ", icon: "tradein",
      desc: "Công cụ tra giá, in tem và quy trình thu cũ đổi mới.",
      items: [
        { title: "Tra cứu giá thu cũ đổi mới", desc: "Giá máy Loại 1–5 và mức trợ giá lên đời máy mới.", href: "/tra-gia-thu-cu", icon: "search" },
        { title: "In sticker trợ giá", desc: "Chỉnh nội dung, in tối đa 6 sticker trên một trang A4.", href: "/sticker-tcdm", icon: "printer" },
        cmsTool(cms["quy-trinh-thu-cu"]),
      ],
    },
    {
      id: "he-may-moi", title: "Hệ máy mới", navTitle: "Hệ máy mới", shortTitle: "Máy mới", icon: "phone",
      desc: "Chính sách sản phẩm mới, bán ra và bảo hành.", items: [cmsTool(cms["may-moi"])],
    },
    {
      id: "he-may-cu", title: "Hệ máy cũ", navTitle: "Hệ máy cũ", shortTitle: "Máy cũ", icon: "used",
      desc: "Thông tin nghiệp vụ cho máy đã sử dụng và máy cũ thu mua.", items: [cmsTool(cms["may-cu"])],
    },
    {
      id: "demo", title: "Demo", navTitle: "Demo", shortTitle: "Demo", icon: "demo",
      desc: "Hướng dẫn theo hãng và công cụ xử lý máy trưng bày.",
      items: [{ title: cms.demo.published ? cms.demo.title : "Gỡ Demo", desc: "Chọn hãng để xem hướng dẫn gỡ demo và công cụ hỗ trợ.", href: "/p/demo", icon: "demo" }],
    },
    {
      id: "cong-cu-ho-tro", title: "Công cụ hỗ trợ", navTitle: "Công cụ hỗ trợ", shortTitle: "Công cụ", icon: "tools",
      desc: "Công cụ nghiệp vụ hỗ trợ vận hành tại siêu thị.",
      items: [{ title: "Cổng công cụ hỗ trợ siêu thị", desc: "PMH, chiến giá, thẩm định hồ sơ và các công cụ hỗ trợ.", href: "/cong-cu-ho-tro", icon: "tools" }],
    },
  ];
  return <HomePortal groups={groups} />;
}
