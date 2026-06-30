import Link from "next/link";
import GuideCopyButton from "./GuideCopyButton";
import styles from "./page.module.css";

export const metadata = {
  title: "Hướng dẫn nội bộ | Viễn Thông Di Động",
  robots: {
    index: false,
    follow: false,
  },
};

type GuideSection = {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  intro: string;
  blocks: Array<{
    title: string;
    tone?: "success" | "info" | "warning";
    items: string[];
  }>;
};

const GUIDES: GuideSection[] = [
  {
    id: "tra-gia-nhan-vien",
    group: "TRA GIÁ TCDM",
    title: "Tra giá TCDM nhân viên",
    subtitle: "Dùng để tra bảng giá thu cũ đổi mới, chọn luồng và báo giá cho khách tại siêu thị.",
    intro: "Mục này dùng khi nhân viên cần tra nhanh giá tham khảo trước khi kiểm tra máy thực tế. Luôn chọn đúng luồng và đọc thông báo hệ thống trước khi báo khách.",
    blocks: [
      {
        title: "Dùng khi nào",
        tone: "success",
        items: [
          "Khách cần đổi máy cũ lên máy mới hoặc chỉ bán máy cũ.",
          "Nhân viên cần xem nhanh giá theo model, bộ nhớ và tình trạng máy.",
        ],
      },
      {
        title: "Quy trình đúng",
        items: [
          "Chọn đúng luồng Thu cũ đổi mới hoặc Chỉ thu cũ.",
          "Chọn máy mới trước, sau đó chọn máy cũ, bộ nhớ và loại máy.",
          "Kiểm tra tổng tiền dự kiến và ghi chú cảnh báo trước khi báo khách.",
        ],
      },
      {
        title: "Lỗi thường gặp",
        tone: "warning",
        items: [
          "Không thấy máy mới: kiểm tra lại hãng/ngành hàng hoặc báo Admin kiểm tra Data_Moi.",
          "Không thấy máy cũ: thử tìm gần đúng theo tên máy, mã máy hoặc bộ nhớ.",
          "Giá bất thường: chụp màn hình và báo Admin kiểm tra dữ liệu.",
        ],
      },
    ],
  },
  {
    id: "chien-gia",
    group: "CÔNG CỤ PMH",
    title: "Tổng giá TCDM thấp hơn đối thủ",
    subtitle: "Gửi hồ sơ chiến giá khi tổng giá TCDM thấp hơn đối thủ và cần ngành hàng duyệt PMH.",
    intro: "Hồ sơ cần đủ thông tin máy, ảnh xác thực và file ghi âm/dò giá nếu có. Gửi thiếu thông tin sẽ dễ bị yêu cầu chụp lại hoặc từ chối.",
    blocks: [
      {
        title: "Điều kiện gửi",
        tone: "success",
        items: [
          "Mã siêu thị và mã nhân viên phải khớp với nhau.",
          "Có đủ thông tin máy cũ, máy mới và bằng chứng giá đối thủ.",
        ],
      },
      {
        title: "Quy trình đúng",
        items: [
          "Nhập mã ST, mã NV, IMEI hoặc Serial Number đúng cú pháp.",
          "Chọn ngành hàng, máy cũ và máy mới theo danh sách hệ thống.",
          "Upload đủ ảnh theo mẫu và kiểm tra ảnh rõ nội dung trước khi gửi duyệt.",
        ],
      },
      {
        title: "Khi hồ sơ phản hồi",
        tone: "warning",
        items: [
          "Nếu được duyệt: bấm xem PMH để ghi nhận hoàn tất.",
          "Nếu yêu cầu chụp lại: chỉ cập nhật đúng ảnh Admin yêu cầu.",
          "Nếu bị từ chối: đọc lý do, tạo yêu cầu mới khi cần.",
        ],
      },
    ],
  },
  {
    id: "may-ngoai-danh-sach",
    group: "CÔNG CỤ PMH",
    title: "Máy ngoài danh sách",
    subtitle: "Gửi yêu cầu hỗ trợ khi sản phẩm khách mang đến chưa có trong danh sách máy thu.",
    intro: "Mục này dùng để ngành hàng thẩm định model ngoài danh sách và cấp PMH phù hợp nếu hồ sơ hợp lệ.",
    blocks: [
      {
        title: "Dùng khi nào",
        tone: "success",
        items: [
          "Máy khách mang đến chưa tìm thấy trong danh sách máy cũ.",
          "Cần ngành hàng xác minh model, tình trạng và cấp mã hỗ trợ.",
        ],
      },
      {
        title: "Quy trình đúng",
        items: [
          "Nhập đúng mã ST, mã NV, IMEI hoặc Serial Number.",
          "Ghi model máy cũ rõ ràng, chọn RAM/ROM và máy mới theo danh sách.",
          "Chụp đủ 6 ảnh theo mẫu, ảnh phải rõ góc máy và thông tin thiết bị.",
        ],
      },
      {
        title: "Lưu ý",
        tone: "warning",
        items: [
          "Mã nhân viên không khớp mã siêu thị sẽ không gửi được hồ sơ.",
          "Ảnh mờ hoặc sai góc sẽ dễ bị yêu cầu chụp lại.",
          "Nếu đã có PMH cũ chưa xem, hãy xem hoặc đóng yêu cầu cũ trước khi tạo mới.",
        ],
      },
    ],
  },
  {
    id: "in-sticker",
    group: "IN ẤN",
    title: "In sticker trợ giá",
    subtitle: "Tạo tem trợ giá thu cũ đổi mới và in tối đa 6 tem trên một trang A4.",
    intro: "Dùng khi cần in nhanh sticker hỗ trợ trưng bày hoặc chương trình tại siêu thị. Có thể sửa chữ trực tiếp trước khi in.",
    blocks: [
      {
        title: "Dùng khi nào",
        tone: "success",
        items: [
          "Cần in tem trợ giá cho khu trưng bày.",
          "Cần chỉnh nội dung, số tiền hoặc thông điệp theo chương trình hiện hành.",
        ],
      },
      {
        title: "Quy trình đúng",
        items: [
          "Chọn đúng mẫu sticker cần dùng.",
          "Sửa nội dung ngắn gọn, dễ đọc trên tem.",
          "Kiểm tra lề in trước khi in hàng loạt.",
        ],
      },
      {
        title: "Lỗi thường gặp",
        tone: "warning",
        items: [
          "Sticker bị lệch: chọn lề in Minimum hoặc không lề tùy máy in.",
          "Chữ quá dài: rút gọn nội dung trước khi in.",
          "Màu không rõ: kiểm tra chế độ in màu hoặc chất lượng bản in.",
        ],
      },
    ],
  },
];

const NAV_GROUPS = [
  {
    title: "TRA GIÁ TCDM",
    items: GUIDES.filter((guide) => guide.group === "TRA GIÁ TCDM"),
  },
  {
    title: "CÔNG CỤ PMH",
    items: GUIDES.filter((guide) => guide.group === "CÔNG CỤ PMH"),
  },
  {
    title: "IN ẤN",
    items: GUIDES.filter((guide) => guide.group === "IN ẤN"),
  },
];

export default function InternalGuidePage() {
  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/cong-cu-ho-tro">
          <span className={styles.logo}>
            <img src="/mwg-logo.svg" alt="MWG" />
          </span>
          <span>
            <strong>Viễn Thông Di Động</strong>
            <small>Hướng dẫn nội bộ</small>
          </span>
        </Link>

        <p className={styles.sidebarIntro}>Hướng dẫn sử dụng công cụ</p>
        <nav className={styles.nav} aria-label="Danh mục hướng dẫn">
          {NAV_GROUPS.map((group) => (
            <section key={group.title} className={styles.navGroup}>
              <h2>{group.title}</h2>
              {group.items.map((item) => (
                <a key={item.id} href={`#${item.id}`}>
                  {item.title}
                  <span aria-hidden="true">›</span>
                </a>
              ))}
            </section>
          ))}
        </nav>
      </aside>

      <section className={styles.content}>
        <header className={styles.header}>
          <div>
            <p>TÀI LIỆU NỘI BỘ</p>
            <h1>Hướng dẫn sử dụng công cụ</h1>
            <span>Dành cho nhân viên thao tác tra giá, gửi hồ sơ PMH và in sticker trợ giá.</span>
          </div>
          <GuideCopyButton />
        </header>

        <div className={styles.mobileNav} aria-label="Danh mục nhanh">
          {GUIDES.map((guide) => (
            <a key={guide.id} href={`#${guide.id}`}>
              {guide.title}
            </a>
          ))}
        </div>

        <div className={styles.articleList}>
          {GUIDES.map((guide) => (
            <article id={guide.id} className={styles.article} key={guide.id}>
              <p className={styles.eyebrow}>{guide.group}</p>
              <h2>{guide.title}</h2>
              <p className={styles.subtitle}>{guide.subtitle}</p>
              <p className={styles.intro}>{guide.intro}</p>

              <div className={styles.blockList}>
                {guide.blocks.map((block) => (
                  <section className={`${styles.block} ${block.tone ? styles[block.tone] : ""}`} key={block.title}>
                    <h3>{block.title}</h3>
                    <ul>
                      {block.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
