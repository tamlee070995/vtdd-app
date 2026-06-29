import Link from "next/link";
import styles from "./page.module.css";

export const metadata = {
  title: "Hướng dẫn nội bộ | Viễn Thông Di Động",
  robots: {
    index: false,
    follow: false,
  },
};

type GuideItem = {
  id: string;
  no: string;
  title: string;
  badge: string;
  when: string[];
  flow: string[];
  issues: string[];
};

const GUIDES: GuideItem[] = [
  {
    id: "tra-gia-nhan-vien",
    no: "01",
    title: "Tra giá TCDM nhân viên",
    badge: "Bảng giá",
    when: [
      "Dùng khi cần tra giá thu cũ đổi mới cho khách tại siêu thị.",
      "Dùng cho cả luồng Thu cũ đổi mới và Chỉ thu cũ nếu tab đang được mở.",
    ],
    flow: [
      "Chọn đúng luồng, chọn máy mới trước rồi chọn máy cũ.",
      "Chọn đúng bộ nhớ, loại máy và kiểm tra tổng tiền trước khi báo khách.",
      "Nếu có cảnh báo hệ thống, đọc xong mới thao tác để tránh báo sai chính sách.",
    ],
    issues: [
      "Không thấy máy mới: kiểm tra ngành hàng/hãng hoặc báo Admin kiểm tra Data_Moi.",
      "Không thấy máy cũ: thử tìm gần đúng theo tên, mã máy hoặc bộ nhớ.",
      "Giá bất thường: chụp màn hình và báo Admin kiểm tra dữ liệu.",
    ],
  },
  {
    id: "chien-gia",
    no: "02",
    title: "Tổng giá TCDM thấp hơn đối thủ",
    badge: "PMH",
    when: [
      "Dùng khi tổng giá TCDM thấp hơn giá đối thủ và cần gửi hồ sơ xin PMH.",
      "Áp dụng cho hồ sơ có đủ ảnh xác thực giá, thông tin máy và file ghi âm/dò giá nếu có.",
    ],
    flow: [
      "Nhập mã siêu thị và mã nhân viên đúng với nhau.",
      "Chọn ngành hàng, máy cũ, máy mới đúng danh sách hệ thống.",
      "Upload đủ ảnh theo mẫu, kiểm tra lại ảnh rõ nội dung rồi bấm gửi duyệt.",
    ],
    issues: [
      "IMEI/SN sai cú pháp: nhập lại đúng số ký tự theo hướng dẫn trên form.",
      "Thiếu ảnh: nút gửi duyệt sẽ chưa hiện, cần bổ sung đủ file bắt buộc.",
      "Bị yêu cầu chụp lại: chỉ chụp lại đúng ảnh Admin yêu cầu.",
    ],
  },
  {
    id: "may-ngoai-danh-sach",
    no: "03",
    title: "Máy ngoài danh sách",
    badge: "PMH",
    when: [
      "Dùng khi sản phẩm khách mang đến chưa có trong danh sách máy thu.",
      "Dùng để ngành hàng thẩm định và cấp PMH phù hợp nếu hồ sơ hợp lệ.",
    ],
    flow: [
      "Nhập đúng mã siêu thị, mã nhân viên, IMEI hoặc Serial Number.",
      "Ghi model máy cũ rõ ràng, chọn RAM/ROM và chọn máy mới theo danh sách.",
      "Chụp đủ 6 ảnh theo mẫu, ảnh phải rõ góc máy và thông tin thiết bị.",
    ],
    issues: [
      "Mã nhân viên không khớp mã siêu thị: kiểm tra lại trước khi gửi.",
      "Ảnh mờ hoặc sai góc: hồ sơ dễ bị yêu cầu chụp lại.",
      "Đã có hồ sơ cũ chưa xem PMH: bấm xem PMH trước hoặc chọn tạo yêu cầu mới.",
    ],
  },
  {
    id: "in-sticker",
    no: "04",
    title: "In sticker trợ giá",
    badge: "Print",
    when: [
      "Dùng khi cần in tem/sticker trợ giá cho khu vực trưng bày hoặc chương trình.",
      "Có thể chỉnh chữ trực tiếp trước khi in.",
    ],
    flow: [
      "Chọn đúng mẫu sticker cần dùng.",
      "Sửa nội dung, số tiền hoặc thông điệp theo chương trình hiện hành.",
      "In A4, tối đa 6 sticker/trang, kiểm tra lề in trước khi in hàng loạt.",
    ],
    issues: [
      "Sticker bị lệch: chọn lề in Minimum hoặc không lề tùy máy in.",
      "Chữ quá dài: rút gọn nội dung trước khi in.",
      "Màu không rõ: kiểm tra chế độ in màu hoặc tăng chất lượng bản in.",
    ],
  },
];

export default function InternalGuidePage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/cong-cu-ho-tro">
          <span className={styles.logo}>
            <img src="/mwg-logo.svg" alt="MWG" />
          </span>
          <span>
            <strong>Viễn Thông Di Động</strong>
            <small>Hướng dẫn nội bộ</small>
          </span>
        </Link>
        <Link className={styles.homeButton} href="/cong-cu-ho-tro">
          Danh mục
        </Link>
      </header>

      <section className={styles.hero}>
        <span>Internal Guide</span>
        <h1>Hướng dẫn nhanh cho từng công cụ</h1>
        <p>
          Mỗi mục chỉ giữ những việc cần nhớ nhất: dùng khi nào, quy trình đúng và lỗi thường gặp.
          Nhân viên có thể mở nhanh khi thao tác để giảm hỏi lại và tránh gửi sai hồ sơ.
        </p>
      </section>

      <nav className={styles.quickNav} aria-label="Danh sách hướng dẫn">
        {GUIDES.map((guide) => (
          <a key={guide.id} href={`#${guide.id}`}>
            <span>{guide.no}</span>
            {guide.title}
          </a>
        ))}
      </nav>

      <section className={styles.guideList}>
        {GUIDES.map((guide) => (
          <article className={styles.guideCard} id={guide.id} key={guide.id}>
            <div className={styles.guideHead}>
              <span className={styles.number}>{guide.no}</span>
              <div>
                <p>{guide.badge}</p>
                <h2>{guide.title}</h2>
              </div>
            </div>

            <div className={styles.guideGrid}>
              <GuideColumn title="Dùng khi nào" items={guide.when} />
              <GuideColumn title="Quy trình đúng" items={guide.flow} />
              <GuideColumn title="Lỗi thường gặp" items={guide.issues} />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function GuideColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <section className={styles.guideColumn}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
