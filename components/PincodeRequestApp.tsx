"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type PincodeFlow = "ChienGia" | "NgoaiDS";

type PincodeRequest = {
  requestId: string;
  createdAt: string;
  flow: PincodeFlow;
  flowLabel: string;
  maST: string;
  maNV: string;
  staffName: string;
  storeName: string;
  imei: string;
  modelCu: string;
  modelMoi: string;
  note: string;
  status: "Pending" | "Approved" | "Rejected_Soft" | "Rejected_Hard" | "Completed";
  pinCode: string;
  menhGia: string;
  reason: string;
  updatedAt: string;
  completedAt: string;
};

type UploadItem = {
  id: string;
  file: File;
  preview: string;
};

type PincodeRequestAppProps = {
  flow: PincodeFlow;
  title: string;
  subtitle: string;
};

const FLOW_META: Record<PincodeFlow, { badge: string; accent: string; requestLabel: string }> = {
  ChienGia: {
    badge: "CHIẾN GIÁ",
    accent: "#ffd400",
    requestLabel: "Hồ sơ chiến giá",
  },
  NgoaiDS: {
    badge: "MÁY NGOÀI DANH SÁCH",
    accent: "#38bdf8",
    requestLabel: "Hồ sơ máy ngoài danh sách",
  },
};

const MAX_IMAGES = 6;
const MIN_IMAGES = 3;

function clean(value: string) {
  return String(value || "").trim();
}

function formatStatus(status: string) {
  if (status === "Approved") return "Đã cấp PMH";
  if (status === "Completed") return "Đã nhận PMH";
  if (status === "Rejected_Soft") return "Cần cập nhật";
  if (status === "Rejected_Hard") return "Từ chối";
  return "Chờ duyệt";
}

function makeImageDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Chỉ nhận file hình ảnh."));
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      const maxSize = 1400;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Không xử lý được ảnh."));
        return;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Không đọc được ảnh ${file.name}.`));
    };

    image.src = url;
  });
}

export default function PincodeRequestApp({ flow, title, subtitle }: PincodeRequestAppProps) {
  const meta = FLOW_META[flow];
  const storageKey = `vtdd_pincode_request_${flow}`;
  const [maST, setMaST] = useState("");
  const [maNV, setMaNV] = useState("");
  const [imei, setImei] = useState("");
  const [modelCu, setModelCu] = useState("");
  const [modelMoi, setModelMoi] = useState("");
  const [note, setNote] = useState("");
  const [images, setImages] = useState<UploadItem[]>([]);
  const [request, setRequest] = useState<PincodeRequest | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [toast, setToast] = useState("");

  const canSubmit = useMemo(() => {
    return (
      clean(maST) &&
      clean(maNV) &&
      clean(imei).length >= 6 &&
      clean(modelCu) &&
      clean(modelMoi) &&
      images.length >= MIN_IMAGES &&
      !submitting
    );
  }, [maST, maNV, imei, modelCu, modelMoi, images.length, submitting]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function loadStatus(requestId: string, options?: { silent?: boolean }) {
    try {
      if (!options?.silent) setLoadingStatus(true);
      const res = await fetch(`/api/tools/pincode/status?requestId=${encodeURIComponent(requestId)}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) throw new Error(data?.message || "Không kiểm tra được trạng thái.");

      setRequest(data.request);
      setLoadingStatus(false);
    } catch (err: any) {
      setLoadingStatus(false);
      showToast(err?.message || "Không kiểm tra được trạng thái.");
    }
  }

  useEffect(() => {
    const savedId = window.localStorage.getItem(storageKey);
    if (savedId) loadStatus(savedId, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!request?.requestId) return;
    if (request.status !== "Pending" && request.status !== "Approved") return;

    const timer = window.setInterval(() => {
      loadStatus(request.requestId, { silent: true });
    }, 5000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.requestId, request?.status]);

  function addImages(files: FileList | null) {
    if (!files?.length) return;

    const nextFiles = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, Math.max(0, MAX_IMAGES - images.length));

    if (nextFiles.length === 0) {
      showToast(`Tối đa ${MAX_IMAGES} ảnh cho một hồ sơ.`);
      return;
    }

    const nextItems = nextFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
    }));

    setImages((current) => [...current, ...nextItems].slice(0, MAX_IMAGES));
  }

  function removeImage(id: string) {
    setImages((current) => {
      const item = current.find((image) => image.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return current.filter((image) => image.id !== id);
    });
  }

  async function submitRequest() {
    try {
      if (!canSubmit) {
        showToast(`Nhập đủ thông tin và tối thiểu ${MIN_IMAGES} ảnh thẩm định.`);
        return;
      }

      setSubmitting(true);
      const imagePayload = await Promise.all(images.map((item) => makeImageDataUrl(item.file)));
      const res = await fetch("/api/tools/pincode/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: JSON.stringify({
          flow,
          maST,
          maNV,
          imei,
          modelCu,
          modelMoi,
          note,
          images: imagePayload.map((dataUrl) => ({ dataUrl })),
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) throw new Error(data?.message || "Không gửi được hồ sơ.");

      setRequest(data.request);
      setRevealed(false);
      if (data.request?.requestId) window.localStorage.setItem(storageKey, data.request.requestId);
      showToast(data.message || "Đã gửi hồ sơ.");
      setSubmitting(false);
    } catch (err: any) {
      setSubmitting(false);
      showToast(err?.message || "Không gửi được hồ sơ.");
    }
  }

  async function revealAndCopy() {
    if (!request?.pinCode) return;

    setRevealed(true);
    try {
      await navigator.clipboard?.writeText(request.pinCode);
      showToast("Đã copy PMH.");
    } catch {
      showToast("PMH đã hiển thị, copy thủ công nếu trình duyệt không cho phép.");
    }

    try {
      await fetch("/api/tools/pincode/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: JSON.stringify({ requestId: request.requestId }),
      });
      await loadStatus(request.requestId, { silent: true });
    } catch {
      // Không chặn nhân viên nhận mã nếu bước ghi nhận tạm lỗi.
    }
  }

  function startFresh() {
    setRequest(null);
    setRevealed(false);
    window.localStorage.removeItem(storageKey);
  }

  const isRejectedSoft = request?.status === "Rejected_Soft";
  const isRejectedHard = request?.status === "Rejected_Hard";
  const isApproved = request?.status === "Approved" || request?.status === "Completed";

  return (
    <main className="pincode-page" style={{ "--pmh-accent": meta.accent } as CSSProperties}>
      <style>{STYLE}</style>

      <header className="pmh-topbar">
        <Link href="/" className="pmh-brand" aria-label="Về trang chủ">
          <img src="/mwg-logo.svg" alt="MWG" />
          <span>
            <b>ICT</b>
            <small>Công cụ hỗ trợ</small>
          </span>
        </Link>
        <Link href="/cong-cu-ho-tro" className="pmh-back">
          Danh mục
        </Link>
      </header>

      <section className="pmh-request-layout">
        <aside className="pmh-request-side">
          <span>{meta.badge}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>

          {request ? (
            <div className={`pmh-status-box ${request.status}`}>
              <small>{meta.requestLabel}</small>
              <b>{formatStatus(request.status)}</b>
              <em>{request.requestId}</em>
            </div>
          ) : (
            <div className="pmh-status-box">
              <small>{meta.requestLabel}</small>
              <b>Chưa gửi hồ sơ</b>
              <em>PMH sẽ hiện tại đây sau khi được duyệt</em>
            </div>
          )}
        </aside>

        <section className="pmh-request-main">
          <div className="pmh-form-grid">
            <label>
              <span>Mã siêu thị</span>
              <input value={maST} onChange={(event) => setMaST(event.target.value)} inputMode="numeric" placeholder="VD: 1234" />
            </label>
            <label>
              <span>Mã nhân viên</span>
              <input value={maNV} onChange={(event) => setMaNV(event.target.value)} inputMode="numeric" placeholder="VD: 100123" />
            </label>
            <label>
              <span>IMEI / Serial</span>
              <input value={imei} onChange={(event) => setImei(event.target.value.toUpperCase())} placeholder="Nhập IMEI hoặc serial" />
            </label>
            <label>
              <span>Máy cũ</span>
              <input value={modelCu} onChange={(event) => setModelCu(event.target.value)} placeholder="Tên model máy cũ" />
            </label>
            <label>
              <span>Máy mới</span>
              <input value={modelMoi} onChange={(event) => setModelMoi(event.target.value)} placeholder="Tên model máy đổi" />
            </label>
            <label className="wide">
              <span>Ghi chú thẩm định</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nội dung thẩm định, giá đối thủ, tình trạng máy..." />
            </label>
          </div>

          <div className="pmh-upload-panel">
            <div className="pmh-upload-title">
              <b>Ảnh hồ sơ</b>
              <small>{images.length}/{MAX_IMAGES} ảnh</small>
            </div>
            <label className="pmh-file-drop">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                multiple
                onChange={(event) => {
                  addImages(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
              <span>Chọn ảnh thẩm định</span>
              <em>Tối thiểu {MIN_IMAGES} ảnh</em>
            </label>
            <div className="pmh-preview-grid">
              {images.map((item, index) => (
                <div key={item.id} className="pmh-preview-item">
                  <img src={item.preview} alt={`Ảnh hồ sơ ${index + 1}`} />
                  <button type="button" onClick={() => removeImage(item.id)} aria-label="Xóa ảnh">
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pmh-submit-row">
            <button type="button" onClick={submitRequest} disabled={!canSubmit}>
              {submitting ? "Đang gửi..." : isRejectedSoft ? "Gửi lại hồ sơ" : "Gửi duyệt PMH"}
            </button>
            {request ? (
              <button type="button" className="secondary" onClick={() => loadStatus(request.requestId)} disabled={loadingStatus}>
                {loadingStatus ? "Đang kiểm tra..." : "Kiểm tra trạng thái"}
              </button>
            ) : null}
          </div>

          {request ? (
            <section className={`pmh-result ${request.status}`}>
              <div className="pmh-result-head">
                <span>{formatStatus(request.status)}</span>
                <b>{request.staffName || `NV ${request.maNV}`}</b>
                <small>{request.createdAt}</small>
              </div>

              {request.reason ? <p className="pmh-result-note">{request.reason}</p> : null}

              {request.status === "Pending" ? (
                <div className="pmh-waiting">
                  <i />
                  <span>Hồ sơ đang chờ ngành hàng duyệt. Trang sẽ tự kiểm tra lại mỗi 5 giây.</span>
                </div>
              ) : null}

              {isApproved ? (
                <div className="pmh-pin-panel">
                  <div>
                    <span>PMH được cấp</span>
                    <b className={revealed || request.status === "Completed" ? "" : "blurred"}>{request.pinCode}</b>
                    <small>{request.menhGia || "Đã duyệt"}</small>
                  </div>
                  <button type="button" onClick={revealAndCopy}>
                    {revealed || request.status === "Completed" ? "Copy lại" : "Hiện & copy"}
                  </button>
                </div>
              ) : null}

              {isRejectedSoft ? (
                <div className="pmh-resubmit-note">Admin yêu cầu cập nhật lại hồ sơ. Sửa thông tin/ảnh phía trên rồi bấm gửi lại.</div>
              ) : null}

              {isRejectedHard ? (
                <div className="pmh-resubmit-note hard">Hồ sơ đã bị từ chối. Bấm tạo hồ sơ mới nếu cần gửi lại từ đầu.</div>
              ) : null}

              <button type="button" className="pmh-new-request" onClick={startFresh}>
                Tạo hồ sơ mới
              </button>
            </section>
          ) : null}
        </section>
      </section>

      {toast ? <div className="pmh-request-toast">{toast}</div> : null}
    </main>
  );
}

const STYLE = `
.pincode-page {
  min-height: 100dvh;
  padding: clamp(12px, 1.6vw, 22px);
  background: #eef3f8;
  color: #07111f;
  font-family: Roboto, Arial, sans-serif;
}
.pmh-topbar {
  width: min(100%, 1320px);
  min-height: 70px;
  margin: 0 auto 14px;
  padding: 10px 14px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #07111f;
  border: 1px solid rgba(255,255,255,.14);
  box-shadow: 0 18px 54px rgba(15,23,42,.16);
}
.pmh-brand,
.pmh-back {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}
.pmh-brand {
  gap: 12px;
  color: #fff;
}
.pmh-brand img {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: #ffd400;
  object-fit: contain;
}
.pmh-brand b {
  display: block;
  color: #fff;
  font-size: 24px;
  line-height: 1;
  font-weight: 1000;
}
.pmh-brand small {
  display: block;
  margin-top: 4px;
  color: rgba(255,255,255,.72);
  font-size: 11px;
  font-weight: 900;
}
.pmh-back {
  min-height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  background: rgba(255,255,255,.09);
  color: #fff;
  border: 1px solid rgba(255,255,255,.14);
  font-size: 12px;
  font-weight: 1000;
}
.pmh-request-layout {
  width: min(100%, 1320px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(280px, 390px) minmax(0, 1fr);
  gap: 14px;
}
.pmh-request-side,
.pmh-request-main,
.pmh-result {
  border-radius: 26px;
  background: #fff;
  border: 1px solid #dbe5ef;
  box-shadow: 0 24px 76px rgba(15,23,42,.08);
}
.pmh-request-side {
  min-height: 620px;
  padding: clamp(20px, 2.4vw, 34px);
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, #07111f, #111827 54%, #f8fafc 54%);
}
.pmh-request-side > span {
  width: fit-content;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--pmh-accent);
  color: #07111f;
  font-size: 11px;
  font-weight: 1000;
}
.pmh-request-side h1 {
  margin: 20px 0 0;
  color: #fff;
  font-size: clamp(34px, 4vw, 62px);
  line-height: .96;
  font-weight: 1000;
}
.pmh-request-side p {
  margin: 14px 0 0;
  color: rgba(255,255,255,.76);
  font-size: 15px;
  line-height: 1.45;
  font-weight: 850;
}
.pmh-status-box {
  margin-top: auto;
  padding: 18px;
  border-radius: 22px;
  background: rgba(255,255,255,.94);
  border: 1px solid rgba(255,255,255,.72);
  display: grid;
  gap: 8px;
}
.pmh-status-box small {
  color: #64748b;
  font-size: 10px;
  font-weight: 1000;
  text-transform: uppercase;
}
.pmh-status-box b {
  color: #07111f;
  font-size: 26px;
  line-height: 1;
  font-weight: 1000;
}
.pmh-status-box em {
  color: #64748b;
  font-style: normal;
  font-size: 12px;
  font-weight: 850;
  word-break: break-word;
}
.pmh-status-box.Approved,
.pmh-status-box.Completed {
  background: #ecfdf5;
  border-color: #bbf7d0;
}
.pmh-status-box.Rejected_Soft,
.pmh-status-box.Rejected_Hard {
  background: #fff7ed;
  border-color: #fed7aa;
}
.pmh-request-main {
  padding: clamp(16px, 2vw, 24px);
  display: grid;
  gap: 14px;
}
.pmh-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.pmh-form-grid label {
  display: grid;
  gap: 7px;
}
.pmh-form-grid label.wide {
  grid-column: 1 / -1;
}
.pmh-form-grid span,
.pmh-upload-title b,
.pmh-result-head span,
.pmh-pin-panel span {
  color: #475569;
  font-size: 11px;
  font-weight: 1000;
  text-transform: uppercase;
}
.pmh-form-grid input,
.pmh-form-grid textarea {
  width: 100%;
  border: 1px solid #dbe5ef;
  border-radius: 16px;
  background: #f8fafc;
  color: #07111f;
  outline: none;
  font-size: 15px;
  font-weight: 850;
}
.pmh-form-grid input {
  min-height: 52px;
  padding: 0 14px;
}
.pmh-form-grid textarea {
  min-height: 110px;
  resize: vertical;
  padding: 14px;
}
.pmh-form-grid input:focus,
.pmh-form-grid textarea:focus {
  border-color: #07111f;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(7,17,31,.08);
}
.pmh-upload-panel {
  padding: 14px;
  border-radius: 22px;
  border: 1px solid #dbe5ef;
  background: #f8fafc;
}
.pmh-upload-title {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}
.pmh-upload-title small {
  color: #07111f;
  font-size: 12px;
  font-weight: 1000;
}
.pmh-file-drop {
  margin-top: 12px;
  min-height: 112px;
  border-radius: 18px;
  border: 2px dashed #cbd5e1;
  background: #fff;
  display: grid;
  place-items: center;
  text-align: center;
  cursor: pointer;
}
.pmh-file-drop input {
  display: none;
}
.pmh-file-drop span {
  color: #07111f;
  font-size: 16px;
  font-weight: 1000;
}
.pmh-file-drop em {
  margin-top: -22px;
  color: #64748b;
  font-size: 12px;
  font-style: normal;
  font-weight: 850;
}
.pmh-preview-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(116px, 1fr));
  gap: 10px;
}
.pmh-preview-item {
  position: relative;
  aspect-ratio: 1 / 1.1;
  border-radius: 16px;
  overflow: hidden;
  background: #e2e8f0;
  border: 1px solid #dbe5ef;
}
.pmh-preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pmh-preview-item button {
  position: absolute;
  right: 7px;
  bottom: 7px;
  min-height: 28px;
  border: 0;
  border-radius: 999px;
  padding: 0 10px;
  background: rgba(7,17,31,.88);
  color: #fff;
  font-size: 11px;
  font-weight: 1000;
}
.pmh-submit-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.pmh-submit-row button,
.pmh-pin-panel button,
.pmh-new-request {
  min-height: 48px;
  border: 0;
  border-radius: 16px;
  padding: 0 18px;
  background: #ffd400;
  color: #07111f;
  font-size: 13px;
  font-weight: 1000;
  cursor: pointer;
}
.pmh-submit-row button:disabled {
  opacity: .5;
  cursor: not-allowed;
}
.pmh-submit-row button.secondary,
.pmh-new-request {
  background: #f8fafc;
  border: 1px solid #dbe5ef;
}
.pmh-result {
  padding: 16px;
  display: grid;
  gap: 12px;
  box-shadow: none;
}
.pmh-result-head {
  display: grid;
  gap: 5px;
}
.pmh-result-head b {
  color: #07111f;
  font-size: 21px;
  line-height: 1;
  font-weight: 1000;
}
.pmh-result-head small {
  color: #64748b;
  font-size: 12px;
  font-weight: 850;
}
.pmh-result-note,
.pmh-resubmit-note {
  margin: 0;
  padding: 12px;
  border-radius: 16px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 900;
}
.pmh-resubmit-note.hard {
  background: #fee2e2;
  border-color: #fecaca;
  color: #991b1b;
}
.pmh-waiting {
  min-height: 58px;
  padding: 12px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 900;
}
.pmh-waiting i {
  width: 13px;
  height: 13px;
  border-radius: 999px;
  background: #1d4ed8;
  box-shadow: 0 0 0 8px rgba(29,78,216,.12);
  animation: pmhPulse 1.2s infinite;
}
.pmh-pin-panel {
  padding: 14px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
}
.pmh-pin-panel div {
  min-width: 0;
  display: grid;
  gap: 6px;
}
.pmh-pin-panel b {
  color: #065f46;
  font-size: clamp(24px, 3vw, 38px);
  line-height: 1;
  font-weight: 1000;
  word-break: break-word;
}
.pmh-pin-panel b.blurred {
  filter: blur(8px);
  user-select: none;
}
.pmh-pin-panel small {
  color: #047857;
  font-size: 12px;
  font-weight: 1000;
}
.pmh-request-toast {
  position: fixed;
  left: 50%;
  bottom: 18px;
  z-index: 9999;
  transform: translateX(-50%);
  width: min(calc(100% - 24px), 480px);
  padding: 13px 14px;
  border-radius: 18px;
  background: #07111f;
  color: #fff;
  box-shadow: 0 18px 44px rgba(15,23,42,.22);
  font-size: 13px;
  font-weight: 900;
  text-align: center;
}
@keyframes pmhPulse {
  0%, 100% { opacity: .55; transform: scale(.88); }
  50% { opacity: 1; transform: scale(1.05); }
}
@media (max-width: 920px) {
  .pmh-request-layout,
  .pmh-form-grid {
    grid-template-columns: 1fr;
  }
  .pmh-request-side {
    min-height: 420px;
  }
  .pmh-pin-panel {
    display: grid;
  }
}
@media (max-width: 560px) {
  .pincode-page {
    padding: 10px;
  }
  .pmh-brand small {
    display: none;
  }
  .pmh-request-side,
  .pmh-request-main,
  .pmh-result {
    border-radius: 22px;
  }
  .pmh-submit-row button,
  .pmh-pin-panel button,
  .pmh-new-request {
    width: 100%;
  }
}
`;
