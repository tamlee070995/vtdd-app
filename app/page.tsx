import HomePortal, { type HomeGroup, type HomeTool } from "@/components/HomePortal";
import { getHomeCmsItems, type HomeCmsItem } from "@/lib/home-cms-store";

export const dynamic = "force-dynamic";

function cmsTool(item: HomeCmsItem): HomeTool {
  return {
    title: item.published ? item.title : item.draftTitle,
    desc: item.published ? item.summary : item.draftSummary,
    mobileDesc: item.slug === "quy-trinh-thu-cu" ? "Thao tác, kiểm tra, xử lý hồ sơ" : item.slug === "may-moi" ? "Chính sách bảo hành theo hãng" : "Nghiệp vụ máy cũ và máy thu mua",
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
      mobileDesc: "Tra giá, in tem và quy trình thu cũ.",
      items: [
        { title: "Tra cứu giá thu cũ đổi mới", desc: "Tìm đúng tên máy và dung lượng, xem giá thu Loại 1–5 cùng mức trợ giá lên đời máy mới.", mobileDesc: "Giá Loại 1–5 và trợ giá lên đời", featured: true, href: "/tra-gia-thu-cu", icon: "search" },
        { title: "In sticker trợ giá", desc: "Chọn mẫu, chỉnh nội dung và in tối đa 6 sticker trên một trang A4.", mobileDesc: "In tối đa 6 tem trên trang A4", href: "/sticker-tcdm", icon: "printer" },
        cmsTool(cms["quy-trinh-thu-cu"]),
      ],
    },
    {
      id: "he-may-moi", title: "Hệ máy mới", navTitle: "Hệ máy mới", shortTitle: "Máy mới", icon: "phone",
      desc: "Chính sách sản phẩm mới, bán ra và bảo hành.", items: [cmsTool(cms["may-moi"])],
      mobileDesc: "Chính sách sản phẩm mới và bảo hành.",
    },
    {
      id: "he-may-cu", title: "Hệ máy cũ", navTitle: "Hệ máy cũ", shortTitle: "Máy cũ", icon: "used",
      desc: "Thông tin nghiệp vụ cho máy đã sử dụng và máy cũ thu mua.", items: [cmsTool(cms["may-cu"])],
      mobileDesc: "Nghiệp vụ máy đã dùng và máy thu mua.",
    },
    {
      id: "demo", title: "Demo", navTitle: "Demo", shortTitle: "Demo", icon: "demo",
      desc: "Hướng dẫn theo hãng và công cụ xử lý máy trưng bày.",
      mobileDesc: "Hướng dẫn gỡ demo theo từng hãng.",
      items: [{ title: cms.demo.published ? cms.demo.title : "Gỡ Demo", desc: "Chọn hãng để xem hướng dẫn gỡ demo, ảnh minh họa và công cụ hỗ trợ được đính kèm.", mobileDesc: "Chọn hãng, xem hướng dẫn gỡ demo", href: "/p/demo", icon: "demo" }],
    },

  ];
  return <HomePortal groups={groups} />;
}
