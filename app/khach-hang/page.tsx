"use client";

import { useEffect, useMemo, useState } from "react";

type SheetRow = any[];


type SystemSettings = Record<string, string>;

type NotifySettings = {
  marquee: string;
  fixedBanner: string;
  pushMessage: string;
  pushVersion: string;
  priceEffectiveFrom: string;
  priceEffectiveTo: string;
};

const EMPTY_NOTIFY: NotifySettings = {
  marquee: "",
  fixedBanner: "",
  pushMessage: "",
  pushVersion: "",
  priceEffectiveFrom: "",
  priceEffectiveTo: "",
};

const SYSTEM_UI_CSS = `
.vtdd-system-marquee {
  position: relative;
  overflow: hidden;
  min-height: 42px;
  border-radius: 18px;
  border: 1px solid rgba(250, 204, 21, .45);
  background: #fffbea;
  color: #854d0e;
  box-shadow: 0 12px 24px rgba(245, 158, 11, .10);
}

.vtdd-system-marquee span {
  position: absolute;
  top: 50%;
  left: 100%;
  white-space: nowrap;
  transform: translateY(-50%);
  font-size: 12px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .02em;
  animation: vtddMarquee 18s linear infinite;
}

@keyframes vtddMarquee {
  from { left: 100%; }
  to { left: -140%; }
}

.vtdd-system-banner,
.vtdd-system-effective {
  padding: 12px 13px;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 12px 26px rgba(15, 23, 42, .06);
}

.vtdd-system-banner {
  border-color: rgba(59, 130, 246, .22);
  background: linear-gradient(135deg, #eff6ff, #ffffff);
}

.vtdd-system-banner span,
.vtdd-system-effective span {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 9.5px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .10em;
  text-transform: uppercase;
}

.vtdd-system-banner b,
.vtdd-system-effective b {
  display: block;
  color: #0f172a;
  font-size: 12.5px;
  line-height: 1.45;
  font-weight: 900;
}

.vtdd-system-effective {
  border-color: rgba(16, 185, 129, .22);
  background: linear-gradient(135deg, #ecfdf5, #ffffff);
}

.vtdd-system-effective b {
  color: #047857;
}

.vtdd-tab-locked-note {
  margin-top: 10px;
  padding: 12px;
  border-radius: 18px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.45;
  font-weight: 850;
}

.mode-switch button:disabled,
.customer-mode-card button:disabled {
  opacity: .48;
  cursor: not-allowed;
  filter: grayscale(.25);
}

.vtdd-lock-page {
  min-height: 100vh;
  padding: max(18px, env(safe-area-inset-top)) 14px max(18px, env(safe-area-inset-bottom));
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 18% 0%, rgba(255, 212, 0, .22), transparent 34%),
    linear-gradient(180deg, #ffffff 0%, #f8fafc 48%, #eef2f7 100%);
}

.vtdd-lock-card {
  width: min(100%, 440px);
  padding: 24px 18px 18px;
  border-radius: 32px;
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 212, 0, .26), transparent 38%),
    #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 26px 80px rgba(15, 23, 42, .16);
  text-align: center;
}

.vtdd-lock-icon {
  width: 62px;
  height: 62px;
  margin: 0 auto 14px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  background: #0f172a;
  color: #ffd400;
  font-size: 26px;
  font-weight: 900;
}

.vtdd-lock-card span {
  width: fit-content;
  margin: 0 auto;
  padding: 8px 11px;
  border-radius: 999px;
  display: inline-flex;
  background: #fffbea;
  border: 1px solid rgba(250, 204, 21, .45);
  color: #854d0e;
  font-size: 9.5px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .10em;
  text-transform: uppercase;
}

.vtdd-lock-card h1 {
  margin-top: 14px;
  color: #0f172a;
  font-size: 30px;
  line-height: 1.05;
  font-weight: 900;
  letter-spacing: -.055em;
  text-transform: uppercase;
}

.vtdd-lock-card p {
  margin-top: 10px;
  color: #475569;
  font-size: 13px;
  line-height: 1.5;
  font-weight: 800;
}

.vtdd-lock-card a {
  min-height: 50px;
  margin-top: 18px;
  border-radius: 17px;
  display: grid;
  place-items: center;
  background: #ffd400;
  color: #111827;
  font-size: 11.5px;
  font-weight: 900;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.vtdd-push-layer {
  position: fixed;
  inset: 0;
  z-index: 999999;
  padding: 16px;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, .58);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.vtdd-push-card {
  width: min(100%, 420px);
  padding: 20px;
  border-radius: 28px;
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 212, 0, .20), transparent 38%),
    #ffffff;
  border: 1px solid rgba(226, 232, 240, .95);
  box-shadow: 0 28px 88px rgba(15, 23, 42, .32);
}

.vtdd-push-card span {
  width: fit-content;
  padding: 8px 11px;
  border-radius: 999px;
  display: inline-flex;
  background: #0f172a;
  color: #ffd400;
  font-size: 9.5px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .10em;
  text-transform: uppercase;
}

.vtdd-push-card h2 {
  margin-top: 14px;
  color: #0f172a;
  font-size: 24px;
  line-height: 1.05;
  font-weight: 900;
  letter-spacing: -.045em;
}

.vtdd-push-card p {
  margin-top: 10px;
  color: #475569;
  font-size: 13px;
  line-height: 1.5;
  font-weight: 800;
}

.vtdd-push-card button {
  width: 100%;
  min-height: 52px;
  margin-top: 16px;
  border: 0;
  border-radius: 18px;
  background: #ffd400;
  color: #111827;
  font-size: 11.5px;
  font-weight: 900;
  letter-spacing: .06em;
  text-transform: uppercase;
}
`;

function settingEnabled(settings: SystemSettings, key: string) {
  const value = String(settings?.[key] || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function getSystemText(settings: SystemSettings, key: string) {
  return String(settings?.[key] || "").trim();
}

function getEffectiveRange(notify: NotifySettings) {
  const from = String(notify.priceEffectiveFrom || "").trim();
  const to = String(notify.priceEffectiveTo || "").trim();

  if (from && to) return `Bảng giá áp dụng từ ${from} đến ${to}`;
  if (from) return `Bảng giá áp dụng từ ${from}`;
  if (to) return `Bảng giá áp dụng đến ${to}`;
  return "";
}


const TYPE_OPTIONS = [
  {
    label: "Loại 1",
    value: "1",
    index: 3,
    desc: "Hoạt động tốt, hoàn toàn không trầy xước. Pin iPhone từ 90% trở lên. iPhone 14 Series trở lên phải là mã VN/A.",
  },
  {
    label: "Loại 2",
    value: "2",
    index: 4,
    desc: "Hoạt động tốt, máy có trầy xước nhẹ hoặc lông mèo.",
  },
  {
    label: "Loại 3",
    value: "3",
    index: 5,
    desc: "Hoạt động tốt, máy trầy xước nặng hoặc cấn móp.",
  },
  {
    label: "Loại 4",
    value: "4",
    index: 6,
    desc: "Máy bể vỡ, cấn móp nặng hoặc có lỗi chức năng.",
  },
  {
    label: "Loại 5",
    value: "5",
    index: 7,
    desc: "Máy đã thay màn lô hoặc có lỗi hiển thị màn hình như sọc, đốm, chảy mực, âm ảnh.",
  },
  {
    label: "Loại 5+",
    value: "5+",
    index: 8,
    desc: "Máy đầy đủ chức năng nhưng có lỗi màn hình. Trường hợp này cần có đối tác hỗ trợ.",
  },
];

function parseMoney(value: any) {
  if (typeof value === "number") return value;

  const s = String(value || "").trim();
  if (!s) return 0;

  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);

  const raw = s.replace(/[^\d]/g, "");
  return raw ? Number(raw) : 0;
}

function parseRate(value: any) {
  if (typeof value === "number") return value > 1 ? value / 100 : value;

  const s = String(value || "").trim();
  if (!s) return 0;

  if (s.includes("%")) {
    const n = Number(s.replace("%", "").replace(",", ".").trim());
    return isNaN(n) ? 0 : n / 100;
  }

  const n = Number(s.replace(",", "."));
  if (isNaN(n)) return 0;

  return n > 1 ? n / 100 : n;
}

function formatMoney(value: number) {
  if (!value || value <= 0) return "0 đ";
  return value.toLocaleString("vi-VN") + " đ";
}

function unique(list: string[]) {
  return Array.from(new Set(list.filter(Boolean)));
}

function isAppleBrand(value: any) {
  const s = String(value || "").toUpperCase();
  return s.includes("APPLE") || s.includes("IPHONE") || s.includes("IPAD");
}

export default function CustomerPage() {
  const [loading, setLoading] = useState(true);
  const [loadMsg, setLoadMsg] = useState("Đang tải bảng giá mới nhất.");
  const [dataMoi, setDataMoi] = useState<SheetRow[]>([]);
  const [dataCu, setDataCu] = useState<SheetRow[]>([]);
  const [dataTablet, setDataTablet] = useState<SheetRow[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({});
  const [notifySettings, setNotifySettings] = useState<NotifySettings>(EMPTY_NOTIFY);
  const [showSystemPush, setShowSystemPush] = useState(false);

  const [mode, setMode] = useState<"tradein" | "buyonly">("tradein");
  const [hang, setHang] = useState("");
  const [spMoi, setSpMoi] = useState("");
  const [spCu, setSpCu] = useState("");
  const [loai, setLoai] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/data/super-fast", { cache: "no-store" });
        const json = await res.json();

        if (!json.success) {
          setLoadMsg(json.message || "Không tải được bảng giá.");
          setLoading(false);
          return;
        }

        setDataMoi(json.data.moi || []);
        setDataCu(json.data.cu || []);
        setDataTablet(json.data.tablet || []);
        setSystemSettings(json.data.system || {});
        setNotifySettings({
          marquee: "",
          fixedBanner: "",
          pushMessage: "",
          pushVersion: "",
          priceEffectiveFrom: json.data.notify?.priceEffectiveFrom || "",
          priceEffectiveTo: json.data.notify?.priceEffectiveTo || "",
        });
        setLoading(false);
      } catch {
        setLoadMsg("Lỗi kết nối dữ liệu.");
        setLoading(false);
      }
    }

    load();
  }, []);

  const brands = useMemo(() => {
    return unique(dataMoi.slice(1).map((row) => String(row[0] || "").trim()));
  }, [dataMoi]);

  const newProducts = useMemo(() => {
    return unique(
      dataMoi
        .slice(1)
        .filter((row) => !hang || String(row[0] || "").trim() === hang)
        .map((row) => String(row[1] || "").trim())
        .filter(Boolean)
    );
  }, [dataMoi, hang]);

  const selectedNewRow = useMemo(() => {
    return dataMoi.find((row) => String(row[1] || "").trim() === spMoi) || null;
  }, [dataMoi, spMoi]);

  const activeOldData = useMemo(() => {
    if (mode === "buyonly") {
      return dataCu.concat(dataTablet.slice(1));
    }

    const nganh = String(selectedNewRow?.[5] || "").toLowerCase();

    if (nganh.includes("tablet") || nganh.includes("máy tính bảng")) {
      if (nganh.includes("điện thoại")) return dataCu.concat(dataTablet.slice(1));
      return dataTablet;
    }

    return dataCu;
  }, [mode, dataCu, dataTablet, selectedNewRow]);

  const oldProducts = useMemo(() => {
    return unique(
      activeOldData
        .slice(1)
        .map((row) => String(row[1] || "").trim())
        .filter(Boolean)
    );
  }, [activeOldData]);

  const selectedOldRow = useMemo(() => {
    return activeOldData.find((row) => String(row[1] || "").trim() === spCu) || null;
  }, [activeOldData, spCu]);

  const memory = selectedOldRow?.[2] ? String(selectedOldRow[2]) : "";

  const canChooseNewProduct = mode === "tradein" && !!hang;
  const canChooseOldProduct = mode === "buyonly" || (mode === "tradein" && !!spMoi);
  const canChooseType = !!selectedOldRow && !!spCu;
  const selectedTypeInfo = TYPE_OPTIONS.find((item) => item.value === loai) || null;

  const systemLocked = settingEnabled(systemSettings, "SYSTEM_LOCK_ENABLED");
  const customerPageLocked = settingEnabled(systemSettings, "CUSTOMER_PAGE_LOCKED");
  const customerTradeinLocked = settingEnabled(systemSettings, "CUSTOMER_TRADEIN_LOCKED");
  const customerBuyonlyLocked = settingEnabled(systemSettings, "CUSTOMER_BUYONLY_LOCKED");
  const allCustomerTabsLocked = customerTradeinLocked && customerBuyonlyLocked;
  const currentCustomerTabLocked = mode === "tradein" ? customerTradeinLocked : customerBuyonlyLocked;
  const customerAccessLocked = systemLocked || customerPageLocked || allCustomerTabsLocked;

  const priceInfo = useMemo(() => {
    const type = TYPE_OPTIONS.find((x) => x.value === loai);

    if (!selectedOldRow || !type) {
      return {
        giaXac: 0,
        troGiaHang: 0,
        troGiaMWG: 0,
        tongTien: 0,
        tiLe: 0,
        maxTroGia: 0,
        minTroGia: 0,
      };
    }

    const oldBrand = String(selectedOldRow[0] || "").trim().toUpperCase();
    const apple = isAppleBrand(oldBrand);

    const giaXac = parseMoney(selectedOldRow[type.index]);

    let troGiaMWG = 0;
    if (type.index === 3 || type.index === 4) {
      troGiaMWG = apple ? parseMoney(selectedOldRow[10]) : parseMoney(selectedOldRow[11]);
    }

    let tiLe = 0;
    let maxTroGia = 0;
    let minTroGia = 0;
    let troGiaHang = 0;

    if (mode === "tradein" && selectedNewRow) {
      tiLe = apple ? parseRate(selectedNewRow[3]) : parseRate(selectedNewRow[2]);
      maxTroGia = parseMoney(selectedNewRow[4]);
      minTroGia = apple ? parseMoney(selectedNewRow[7]) : parseMoney(selectedNewRow[6]);

      if (giaXac > 0 && tiLe > 0) {
        troGiaHang = Math.round((giaXac * tiLe) / 5000) * 5000;

        if (maxTroGia > 0 && troGiaHang > maxTroGia) {
          troGiaHang = maxTroGia;
        }

        if (minTroGia > 0 && troGiaHang < minTroGia && giaXac > 0) {
          troGiaHang = minTroGia;
        }
      }
    }

    return {
      giaXac,
      troGiaHang,
      troGiaMWG,
      tongTien: giaXac + troGiaHang + troGiaMWG,
      tiLe,
      maxTroGia,
      minTroGia,
    };
  }, [mode, selectedNewRow, selectedOldRow, loai]);


  useEffect(() => {
    if (!notifySettings.pushMessage) return;

    const version = notifySettings.pushVersion || notifySettings.pushMessage;
    const key = `vtdd_customer_push_seen_${version}`;

    try {
      if (window.localStorage.getItem(key) !== "1") {
        setShowSystemPush(true);
      }
    } catch {
      setShowSystemPush(true);
    }
  }, [notifySettings.pushMessage, notifySettings.pushVersion]);

  useEffect(() => {
    if (mode === "tradein" && customerTradeinLocked && !customerBuyonlyLocked) {
      setMode("buyonly");
      setHang("");
      setSpMoi("");
      setSpCu("");
      setLoai("");
    }

    if (mode === "buyonly" && customerBuyonlyLocked && !customerTradeinLocked) {
      setMode("tradein");
      setHang("");
      setSpMoi("");
      setSpCu("");
      setLoai("");
    }
  }, [mode, customerTradeinLocked, customerBuyonlyLocked]);

  function closeSystemPush() {
    const version = notifySettings.pushVersion || notifySettings.pushMessage;

    if (version) {
      window.localStorage.setItem(`vtdd_customer_push_seen_${version}`, "1");
    }

    setShowSystemPush(false);
  }

  function renderSystemStyle() {
    return <style>{SYSTEM_UI_CSS}</style>;
  }

  function renderSystemNotices() {
    const effectiveRange = getEffectiveRange(notifySettings);

    return (
      <>
        {effectiveRange ? (
          <div className="vtdd-system-effective">
            <span>Ngày áp dụng</span>
            <b>{effectiveRange}</b>
          </div>
        ) : null}
      </>
    );
  }

  function renderPushNotify() {
    if (!showSystemPush || !notifySettings.pushMessage) return null;

    return (
      <section className="vtdd-push-layer" role="dialog" aria-modal="true">
        <div className="vtdd-push-card">
          <span>Thông báo mới</span>
          <h2>Thông báo từ Admin</h2>
          <p>{notifySettings.pushMessage}</p>
          <button type="button" onClick={closeSystemPush}>ĐÃ HIỂU</button>
        </div>
      </section>
    );
  }

  function renderSystemLock() {
    const message = getSystemText(systemSettings, "SYSTEM_LOCK_MESSAGE") || "HỆ THỐNG ĐANG CẬP NHẬT KHẨN.";

    return (
      <main className="vtdd-lock-page">
        {renderSystemStyle()}
        <section className="vtdd-lock-card">
          <div className="vtdd-lock-icon">!</div>
          <span>Tạm khóa truy cập</span>
          <h1>Hệ thống đang cập nhật</h1>
          <p>{message}</p>
          <a href="/">Quay về trang chủ</a>
        </section>
      </main>
    );
  }

  function resetForm() {
    setHang("");
    setSpMoi("");
    setSpCu("");
    setLoai("");
  }

  if (loading) {
    return (
      <main className="customer-personal-page">
        <section className="customer-personal-loader">
          <div className="customer-loader-orb"></div>
          <h1>VTDD.ONLINE</h1>
          <p>{loadMsg}</p>
        </section>
      </main>
    );
  }

  if (customerAccessLocked) {
    return renderSystemLock();
  }

  return (
    <main className="customer-personal-page">
      {renderSystemStyle()}
      <section className="customer-personal-shell">
        <header className="customer-personal-hero">
          <div className="customer-personal-brand">
            <div>VT</div>
            <span>VTDD.ONLINE</span>
          </div>

          <div className="customer-personal-kicker">TRA CỨU DÀNH CHO KHÁCH HÀNG</div>

          <h1>
            THU CŨ
            <span>ĐỔI MỚI</span>
          </h1>

          <p>
            Tra cứu nhanh giá tham khảo khi thu cũ đổi mới. Giá cuối cùng sẽ được xác nhận sau khi kiểm tra máy thực tế tại siêu thị.
          </p>
        </header>

        {renderSystemNotices()}

        {currentCustomerTabLocked && (
          <div className="vtdd-tab-locked-note">
            Tab hiện tại đang tạm khóa theo cài đặt Admin. Vui lòng chọn tab còn lại hoặc thử lại sau.
          </div>
        )}

        <section className="customer-mode-card">
          <button
            className={mode === "tradein" ? "active" : ""}
            disabled={customerTradeinLocked}
            onClick={() => {
              if (customerTradeinLocked) return;
              setMode("tradein");
              resetForm();
            }}
          >
            Thu cũ đổi mới{customerTradeinLocked ? " • Khóa" : ""}
          </button>

          <button
            className={mode === "buyonly" ? "active" : ""}
            disabled={customerBuyonlyLocked}
            onClick={() => {
              if (customerBuyonlyLocked) return;
              setMode("buyonly");
              resetForm();
            }}
          >
            Chỉ thu cũ{customerBuyonlyLocked ? " • Khóa" : ""}
          </button>
        </section>

        <section className="customer-form-card">
          {mode === "tradein" && (
            <>
              <div className="customer-section-title">
                <span>01</span>
                <div>
                  <b>Máy muốn mua mới</b>
                  <p>Chọn sản phẩm khách muốn lên đời.</p>
                </div>
              </div>

              <label>Hãng máy mới</label>
              <select
                value={hang}
                onChange={(e) => {
                  setHang(e.target.value);
                  setSpMoi("");
                  setSpCu("");
                  setLoai("");
                }}
              >
                <option value="">Chọn hãng</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              <label>Tên sản phẩm mới</label>
              <input
                list="customer-new-products"
                value={spMoi}
                disabled={!canChooseNewProduct}
                onChange={(e) => {
                  setSpMoi(e.target.value);
                  setSpCu("");
                  setLoai("");
                }}
                placeholder={canChooseNewProduct ? "Gõ hoặc chọn máy mới" : "Chọn hãng trước"}
              />

              <datalist id="customer-new-products">
                {newProducts.map((p, index) => (
                  <option key={`new-${p}-${index}`} value={p} />
                ))}
              </datalist>
            </>
          )}

          <div className="customer-section-title second">
            <span>{mode === "buyonly" ? "01" : "02"}</span>
            <div>
              <b>Máy cũ của khách</b>
              <p>Chọn đúng model và tình trạng máy.</p>
            </div>
          </div>

          <label>Tên sản phẩm cũ</label>
          <input
            list="customer-old-products"
            value={spCu}
            disabled={!canChooseOldProduct}
            onChange={(e) => {
              setSpCu(e.target.value);
              setLoai("");
            }}
            placeholder={canChooseOldProduct ? "Gõ hoặc chọn máy cũ" : "Chọn máy mới trước"}
          />

          <datalist id="customer-old-products">
            {oldProducts.map((p, index) => (
              <option key={`old-${p}-${index}`} value={p} />
            ))}
          </datalist>

          <label>Bộ nhớ</label>
          <input value={memory} readOnly placeholder="Tự động theo máy cũ" />

          <div className="customer-type-title">Chọn tình trạng máy</div>

          <div className="customer-type-pill-grid">
            {TYPE_OPTIONS.map((item) => {
              return (
                <button
                  key={item.value}
                  type="button"
                  className={loai === item.value ? "active" : ""}
                  onClick={() => setLoai(item.value)}
                  disabled={!canChooseType}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {selectedTypeInfo && (
            <div className="customer-type-detail-card">
              <div>
                <span>Chi tiết loại đã chọn</span>
                <b>{selectedTypeInfo.label}</b>
              </div>

              <p>{selectedTypeInfo.desc}</p>
            </div>
          )}
        </section>

        <section className={loai ? "customer-result-card show" : "customer-result-card"}>
          <div className="customer-result-kicker">TỔNG TIỀN DỰ KIẾN</div>

          <div className="customer-result-total">{formatMoney(priceInfo.tongTien)}</div>

          <div className="customer-result-note">
            Giá chỉ mang tính tham khảo. Kết quả cuối cùng phụ thuộc tình trạng thực tế, tài khoản, IMEI/Serial và chính sách tại thời điểm giao dịch.
          </div>

          <div className="customer-result-rows">
            <div>
              <span>Máy mới</span>
              <b>{mode === "tradein" ? spMoi || "Chưa chọn" : "Chỉ thu cũ"}</b>
            </div>

            <div>
              <span>Máy cũ</span>
              <b>{spCu ? `${spCu}${memory ? " · " + memory : ""}` : "Chưa chọn"}</b>
            </div>

            <div>
              <span>Tình trạng</span>
              <b>{loai ? `Loại ${loai}` : "Chưa chọn"}</b>
            </div>

            <div className="customer-total-row-only">
              <span>Tổng tiền dự kiến</span>
              <b>{formatMoney(priceInfo.tongTien)}</b>
            </div>
          </div>

          <a className="customer-store-btn customer-hotline-btn" href="tel:1900232460">
            <span>Tổng đài hỗ trợ</span>
            <b>Gọi mua: 1900 232 460 (8:00 - 21:30)</b>
          </a>
        </section>
      </section>

      {/* Push notify chỉ áp dụng cho trang nhân viên */}
    </main>
  );
}
