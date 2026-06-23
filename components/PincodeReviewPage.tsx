"use client";

import { useEffect, useMemo, useState } from "react";

type PmhStat = {
  menhGia: string;
  count: number;
};

type PincodeRequest = {
  requestId: string;
  createdAt: string;
  flow: "ChienGia" | "NgoaiDS";
  flowLabel: string;
  maST: string;
  maNV: string;
  imei: string;
  modelCu: string;
  modelMoi: string;
  status: string;
  pinCode: string;
  menhGia: string;
  reason: string;
  admin: string;
  claimedBy?: string;
  claimedAt?: string;
  imageUrls: string[];
};

type Props = {
  request: PincodeRequest;
  pmhStats: PmhStat[];
  adminName: string;
};

function statusText(status: string) {
  if (status === "Approved" || status === "Approve") return "Đã cấp PMH";
  if (status === "Rejected_Soft") return "Yêu cầu chụp lại";
  if (status === "Rejected_Hard") return "Từ chối";
  if (status === "Completed") return "Hoàn tất";
  return "Chờ duyệt";
}

const IMAGE_NUMBERS = ["1", "2", "3", "4", "5", "6"];

function cleanMenhGiaLabel(value: string) {
  return String(value || "").replace(/\s+(TCDM|ALL)$/i, "").trim() || value;
}

export default function PincodeReviewPage({ request, pmhStats, adminName }: Props) {
  const [mounted, setMounted] = useState(false);
  const [menhGia, setMenhGia] = useState("");
  const [reason, setReason] = useState(request.reason || "");
  const [actionMode, setActionMode] = useState<"" | "soft" | "hard">("");
  const [rejectPanelOpen, setRejectPanelOpen] = useState(false);
  const [selectedImageSlots, setSelectedImageSlots] = useState<string[]>(IMAGE_NUMBERS);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [done, setDone] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [zoom, setZoom] = useState(1);

  const stockText = useMemo(() => {
    return pmhStats.map((item) => `${item.menhGia}: ${item.count}`).join(" | ") || "Chưa có PMH đúng luồng";
  }, [pmhStats]);
  const autoMenhGiaText = pmhStats[0]?.menhGia ? cleanMenhGiaLabel(pmhStats[0].menhGia) : "chưa có mã";
  const activeImageUrl = request.imageUrls[activeImage] || request.imageUrls[0] || "";

  useEffect(() => {
    setMounted(true);
  }, []);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function toggleImageSlot(slot: string) {
    if (slot === "All") {
      setSelectedImageSlots((current) => (current.length === IMAGE_NUMBERS.length ? [] : IMAGE_NUMBERS));
      return;
    }

    setSelectedImageSlots((current) => {
      if (current.includes(slot)) return current.filter((item) => item !== slot);
      return [...current, slot].sort((a, b) => Number(a) - Number(b));
    });
  }

  function notifyParent(status: string) {
    try {
      window.opener?.postMessage(
        {
          type: "PINCODE_REVIEW_DONE",
          requestId: request.requestId,
          status,
        },
        window.location.origin
      );
    } catch {
      // Cửa sổ cha có thể đã đóng, thao tác sheet vẫn đã xong.
    }
  }

  function finish(status: string, message: string) {
    setDone(true);
    showToast(message);
    notifyParent(status);
    window.setTimeout(() => {
      window.close();
    }, 900);
  }

  async function postAction(body: any) {
    const res = await fetch("/api/admin/tools/pincode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) throw new Error(data?.message || "Không xử lý được thao tác.");
    return data;
  }

  async function approve() {
    try {
      setBusy("approve");
      const data = await postAction({ action: "APPROVE", requestId: request.requestId, menhGia });
      setBusy("");
      finish("Approved", data.message || "Đã duyệt PMH.");
    } catch (err: any) {
      setBusy("");
      showToast(err?.message || "Không duyệt được hồ sơ.");
    }
  }

  async function reject(soft: boolean) {
    try {
      if (!reason.trim()) {
        showToast("Vui lòng nhập nội dung phản hồi.");
        return;
      }

      if (soft && selectedImageSlots.length === 0) {
        showToast("Vui lòng chọn ít nhất 1 ảnh cần chụp lại.");
        return;
      }

      setBusy(soft ? "soft" : "hard");
      const data = await postAction({
        action: soft ? "REQUEST_UPDATE" : "REJECT",
        requestId: request.requestId,
        reason,
        imageSlots: soft ? selectedImageSlots : [],
      });
      setBusy("");
      finish(soft ? "Rejected_Soft" : "Rejected_Hard", data.message || "Đã cập nhật hồ sơ.");
    } catch (err: any) {
      setBusy("");
      showToast(err?.message || "Không cập nhật được hồ sơ.");
    }
  }

  const claimedByOther = Boolean(request.claimedBy && request.claimedBy !== adminName);
  const disabled = Boolean(busy || done || request.status !== "Pending" || claimedByOther);
  const rejectBusy = busy === "soft" || busy === "hard";
  const rejectButtonText = rejectBusy
    ? actionMode === "soft"
      ? "Đang gửi..."
      : "Đang từ chối..."
    : actionMode === "soft"
      ? "Gửi yêu cầu chụp lại"
      : actionMode === "hard"
        ? "Xác nhận từ chối"
        : rejectPanelOpen
          ? "Chọn hình thức từ chối"
          : "Từ chối";

  function handleRejectButton() {
    if (!rejectPanelOpen) {
      setRejectPanelOpen(true);
      return;
    }

    if (actionMode === "soft") {
      reject(true);
      return;
    }

    if (actionMode === "hard") {
      reject(false);
      return;
    }

    showToast("Vui lòng chọn Từ chối hoàn toàn hoặc Yêu cầu chụp lại.");
  }

  if (!mounted) {
    return (
      <main className="review-page" suppressHydrationWarning>
        <style>{STYLE}</style>
        <section className="review-shell">
          <div className="review-loading-card">
            <span>Kiểm duyệt yêu cầu</span>
            <b>Đang tải hồ sơ...</b>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="review-page" suppressHydrationWarning>
      <style>{STYLE}</style>

      <section className="review-shell">
        <header className="review-head">
          <div>
            <span>Kiểm duyệt yêu cầu</span>
            <h1>{request.flowLabel}</h1>
            <p>Admin: {adminName}</p>
            {request.claimedBy ? <p>Đang xử lý: {request.claimedBy}{request.claimedAt ? ` · ${request.claimedAt}` : ""}</p> : null}
            {claimedByOther ? <p>Hồ sơ này đã được người khác nhận xử lý.</p> : null}
          </div>
          <b className={`review-status ${request.status}`}>{statusText(request.status)}</b>
        </header>

        <section className="review-info">
          <div className="review-summary-card">
            <span>IMEI/SN</span>
            <b>{request.imei || "-"}</b>
            <p>NV {request.maNV || "-"} · ST {request.maST || "-"} · {request.createdAt || "-"}</p>
          </div>
          <div className="review-model-pair">
            <div>
              <span>Máy cũ</span>
              <b>{request.modelCu || "-"}</b>
            </div>
            <div>
              <span>Máy mới</span>
              <b>{request.modelMoi || "-"}</b>
            </div>
          </div>
        </section>

        <section className="review-images">
          <button
            type="button"
            className="review-image-button"
            onClick={() => {
              setActiveImage(0);
              setZoom(1);
              setGalleryOpen(true);
            }}
            disabled={request.imageUrls.length === 0}
          >
            <span>Ảnh hồ sơ</span>
            <b>Xem {request.imageUrls.length || 0} ảnh</b>
            <small>Bấm để xem trong trang, không mở tab mới</small>
          </button>
        </section>

        <section className="review-actions">
          <div className="review-stock">
            <span>Kho PMH đúng luồng</span>
            <p>{stockText}</p>
          </div>

          <label>
            <span>Mệnh giá cần cấp</span>
            <select value={menhGia} onChange={(event) => setMenhGia(event.target.value)} disabled={disabled}>
              <option value="">Tự động lấy mã PMH thấp nhất: {autoMenhGiaText}</option>
              {pmhStats.map((item) => (
                <option value={item.menhGia} key={item.menhGia}>
                  {item.menhGia} ({item.count})
                </option>
              ))}
            </select>
          </label>

          {rejectPanelOpen ? (
            <div className="review-feedback-panel">
              <div className="review-reject-options">
                <button
                  type="button"
                  className={actionMode === "hard" ? "active" : ""}
                  onClick={() => setActionMode("hard")}
                  disabled={disabled}
                >
                  Từ chối hoàn toàn
                </button>
                <button
                  type="button"
                  className={actionMode === "soft" ? "active" : ""}
                  onClick={() => setActionMode("soft")}
                  disabled={disabled}
                >
                  Yêu cầu chụp lại
                </button>
              </div>

              {actionMode ? (
                <>
                  {actionMode === "soft" ? (
                    <div className="review-slot-picker">
                      <span>Ảnh cần chụp lại</span>
                      <div>
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedImageSlots.length === IMAGE_NUMBERS.length}
                            onChange={() => toggleImageSlot("All")}
                            disabled={disabled}
                          />
                          All
                        </label>
                        {IMAGE_NUMBERS.map((slot) => (
                          <label key={slot}>
                            <input
                              type="checkbox"
                              checked={selectedImageSlots.includes(slot)}
                              onChange={() => toggleImageSlot(slot)}
                              disabled={disabled}
                            />
                            {slot}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <label>
                    <span>{actionMode === "soft" ? "Nội dung yêu cầu chụp lại" : "Nội dung từ chối"}</span>
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      disabled={disabled}
                      placeholder={actionMode === "soft" ? "Nhập nội dung cần nhân viên chụp lại..." : "Nhập lý do từ chối hồ sơ..."}
                    />
                  </label>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="review-buttons">
            <button type="button" className="approve" onClick={approve} disabled={disabled || busy === "approve"}>
              {busy === "approve" ? "Đang duyệt..." : "Duyệt & cấp PMH"}
            </button>
            <button
              type="button"
              className={`reject ${rejectPanelOpen ? "active-hard" : ""}`}
              onClick={handleRejectButton}
              disabled={disabled || rejectBusy}
            >
              {rejectButtonText}
            </button>
          </div>
        </section>
      </section>

      {galleryOpen ? (
        <div className="review-gallery-modal" role="dialog" aria-modal="true">
          <div className="review-gallery-panel">
            <div className="review-gallery-head">
              <div>
                <span>Ảnh {activeImage + 1}/{request.imageUrls.length}</span>
                <b>Hồ sơ thẩm định</b>
              </div>
              <button type="button" onClick={() => setGalleryOpen(false)}>Đóng</button>
            </div>

            <div className="review-gallery-stage">
              {activeImageUrl ? (
                <img
                  src={activeImageUrl}
                  alt={`Ảnh hồ sơ ${activeImage + 1}`}
                  style={{
                    width: `${zoom * 100}%`,
                    maxWidth: zoom === 1 ? "100%" : "none",
                    maxHeight: zoom === 1 ? "62dvh" : "none",
                  }}
                />
              ) : (
                <p>Chưa có ảnh hồ sơ.</p>
              )}
            </div>

            <div className="review-gallery-controls">
              <button type="button" onClick={() => setZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))}>
                Thu nhỏ
              </button>
              <b>{Math.round(zoom * 100)}%</b>
              <button type="button" onClick={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))}>
                Phóng to
              </button>
            </div>

            <div className="review-gallery-thumbs">
              {request.imageUrls.map((url, index) => (
                <button
                  type="button"
                  key={`${url}-${index}`}
                  className={index === activeImage ? "active" : ""}
                  onClick={() => {
                    setActiveImage(index);
                    setZoom(1);
                  }}
                >
                  <img src={url} alt={`Ảnh nhỏ ${index + 1}`} />
                  <span>{index + 1}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="review-toast">{toast}</div> : null}
    </main>
  );
}

const STYLE = `
.review-page {
  min-height: 100dvh;
  padding: 18px;
  background: #eef3f8;
  color: #07111f;
  font-family: Roboto, Arial, sans-serif;
}
.review-shell {
  width: min(100%, 760px);
  margin: 0 auto;
  display: grid;
  gap: 14px;
}
.review-loading-card {
  min-height: 180px;
  padding: 22px;
  border-radius: 24px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  background: #fff;
  border: 1px solid #dbe5ef;
  box-shadow: 0 18px 54px rgba(15,23,42,.07);
  text-align: center;
}
.review-loading-card span {
  width: fit-content;
  padding: 8px 12px;
  border-radius: 999px;
  background: #07111f;
  color: #ffd400;
  font-size: 11px;
  font-weight: 1000;
  text-transform: uppercase;
}
.review-loading-card b {
  color: #07111f;
  font-size: 24px;
  line-height: 1.05;
  font-weight: 1000;
}
.review-head,
.review-info,
.review-images,
.review-actions {
  border-radius: 24px;
  background: #fff;
  border: 1px solid #dbe5ef;
  box-shadow: 0 18px 54px rgba(15,23,42,.07);
}
.review-head {
  min-height: 118px;
  padding: 18px;
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: start;
  background: #07111f;
}
.review-head span {
  color: #ffd400;
  font-size: 11px;
  font-weight: 1000;
  letter-spacing: .14em;
  text-transform: uppercase;
}
.review-head h1 {
  margin: 10px 0 0;
  color: #fff;
  font-size: clamp(28px, 6vw, 42px);
  line-height: .95;
  font-weight: 1000;
}
.review-head p {
  margin: 10px 0 0;
  color: rgba(255,255,255,.72);
  font-size: 13px;
  font-weight: 850;
}
.review-status {
  padding: 9px 12px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 1000;
}
.review-status.Approved,
.review-status.Approve {
  background: #dcfce7;
  color: #15803d;
}
.review-status.Rejected_Soft,
.review-status.Rejected_Hard {
  background: #fee2e2;
  color: #991b1b;
}
.review-info {
  padding: 12px;
  display: grid;
  grid-template-columns: 1.05fr .95fr;
  gap: 8px;
}
.review-summary-card,
.review-model-pair > div,
.review-stock {
  padding: 12px;
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.review-model-pair {
  display: grid;
  gap: 8px;
}
.review-info span,
.review-actions label span,
.review-stock span,
.review-slot-picker > span {
  display: block;
  color: #64748b;
  font-size: 10px;
  font-weight: 1000;
  text-transform: uppercase;
}
.review-info b {
  display: block;
  margin-top: 7px;
  color: #07111f;
  font-size: 14px;
  line-height: 1.25;
  font-weight: 1000;
}
.review-summary-card b {
  font-size: 22px;
  line-height: 1.05;
  word-break: break-word;
}
.review-summary-card p {
  margin: 10px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 900;
}
.review-images {
  padding: 12px;
}
.review-image-button {
  width: 100%;
  min-height: 74px;
  border: 1px dashed #94a3b8;
  border-radius: 18px;
  background: #f8fafc;
  color: #07111f;
  display: grid;
  place-items: center;
  gap: 4px;
  cursor: pointer;
}
.review-image-button span {
  color: #64748b;
  font-size: 10px;
  font-weight: 1000;
  text-transform: uppercase;
}
.review-image-button b {
  font-size: 18px;
  font-weight: 1000;
}
.review-image-button small {
  color: #64748b;
  font-size: 11px;
  font-weight: 850;
}
.review-image-button:disabled {
  opacity: .55;
  cursor: not-allowed;
}
.review-actions {
  padding: 14px;
  display: grid;
  gap: 12px;
}
.review-stock p {
  margin: 7px 0 0;
  color: #07111f;
  font-size: 13px;
  font-weight: 900;
}
.review-actions label {
  display: grid;
  gap: 7px;
}
.review-feedback-panel {
  display: grid;
  gap: 10px;
}
.review-reject-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.review-reject-options button {
  min-height: 44px;
  border: 1px solid #dbe5ef;
  border-radius: 16px;
  background: #f8fafc;
  color: #07111f;
  font-size: 13px;
  font-weight: 1000;
  cursor: pointer;
}
.review-reject-options button.active {
  background: #07111f;
  border-color: #07111f;
  color: #ffd400;
}
.review-slot-picker {
  padding: 12px;
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.review-slot-picker > div {
  margin-top: 9px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.review-slot-picker label {
  min-height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: #fff;
  border: 1px solid #dbe5ef;
  color: #07111f;
  font-size: 12px;
  font-weight: 1000;
}
.review-slot-picker input {
  width: 16px;
  height: 16px;
  accent-color: #ffd400;
}
.review-actions select,
.review-actions textarea {
  width: 100%;
  border: 1px solid #dbe5ef;
  border-radius: 16px;
  background: #f8fafc;
  color: #07111f;
  outline: none;
  font-size: 14px;
  font-weight: 850;
}
.review-actions select {
  min-height: 48px;
  padding: 0 12px;
}
.review-actions textarea {
  min-height: 94px;
  padding: 12px;
  resize: vertical;
}
.review-buttons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.review-buttons button {
  min-height: 50px;
  border: 0;
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid #dbe5ef;
  color: #07111f;
  font-size: 13px;
  font-weight: 1000;
  cursor: pointer;
}
.review-buttons button.approve {
  background: #07111f;
  border-color: #07111f;
  color: #ffd400;
}
.review-buttons button.active-soft {
  background: #07111f;
  border-color: #07111f;
  color: #ffd400;
}
.review-buttons button.reject {
  background: #fee2e2;
  border-color: #fecaca;
  color: #991b1b;
}
.review-buttons button.reject.active-hard {
  background: #991b1b;
  border-color: #991b1b;
  color: #fff;
}
.review-buttons button:disabled {
  opacity: .55;
  cursor: not-allowed;
}
.review-gallery-modal {
  position: fixed;
  inset: 0;
  z-index: 30;
  padding: 12px;
  display: grid;
  place-items: center;
  background: rgba(7,17,31,.72);
  backdrop-filter: blur(10px);
}
.review-gallery-panel {
  width: min(100%, 720px);
  max-height: calc(100dvh - 24px);
  overflow: hidden;
  border-radius: 22px;
  background: #fff;
  border: 1px solid #dbe5ef;
  box-shadow: 0 28px 90px rgba(15,23,42,.32);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
}
.review-gallery-head {
  padding: 12px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
}
.review-gallery-head span {
  color: #64748b;
  font-size: 10px;
  font-weight: 1000;
  text-transform: uppercase;
}
.review-gallery-head b {
  display: block;
  margin-top: 2px;
  color: #07111f;
  font-size: 16px;
  font-weight: 1000;
}
.review-gallery-head button,
.review-gallery-controls button {
  min-height: 40px;
  border: 0;
  border-radius: 14px;
  padding: 0 14px;
  background: #ffd400;
  color: #07111f;
  font-size: 12px;
  font-weight: 1000;
  cursor: pointer;
}
.review-gallery-stage {
  min-height: 280px;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  background: #0f172a;
  touch-action: pan-x pan-y;
  overscroll-behavior: contain;
}
.review-gallery-stage img {
  flex: 0 0 auto;
  object-fit: contain;
  transition: width .18s ease;
}
.review-gallery-stage p {
  color: #fff;
  font-weight: 900;
}
.review-gallery-controls {
  padding: 10px 12px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: center;
  border-top: 1px solid #e2e8f0;
}
.review-gallery-controls b {
  color: #07111f;
  font-size: 13px;
  font-weight: 1000;
}
.review-gallery-thumbs {
  padding: 10px 12px 12px;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}
.review-gallery-thumbs button {
  position: relative;
  min-width: 0;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 12px;
  overflow: hidden;
  background: #e2e8f0;
  cursor: pointer;
}
.review-gallery-thumbs button.active {
  border-color: #ffd400;
}
.review-gallery-thumbs img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}
.review-gallery-thumbs span {
  position: absolute;
  left: 5px;
  top: 5px;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #07111f;
  color: #ffd400;
  font-size: 10px;
  font-weight: 1000;
}
.review-toast {
  position: fixed;
  left: 50%;
  bottom: 18px;
  z-index: 20;
  transform: translateX(-50%);
  max-width: min(92vw, 480px);
  padding: 13px 16px;
  border-radius: 999px;
  background: #07111f;
  color: #fff;
  font-size: 13px;
  font-weight: 900;
}
@media (max-width: 820px) {
  .review-head,
  .review-info,
  .review-buttons,
  .review-reject-options {
    grid-template-columns: 1fr;
  }
  .review-head {
    display: grid;
  }
  .review-gallery-thumbs {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
`;
