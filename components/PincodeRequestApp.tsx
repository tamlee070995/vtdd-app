"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type PincodeFlow = "ChienGia" | "NgoaiDS";
type IdentifierType = "IMEI" | "Serial";
type DeviceCategory = "" | "Điện thoại" | "Máy tính bảng";

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
  doneStatus: string;
  updatedAt: string;
  completedAt: string;
  imageUrls: string[];
};

type StaffLookup = {
  success: boolean;
  valid: boolean;
  message: string;
  staff: {
    maNV: string;
    staffName: string;
    maST: string;
    storeName: string;
    status: string;
  } | null;
  store: {
    maST: string;
    storeName: string;
  } | null;
  query: {
    maST: string;
    maNV: string;
  };
};

type UploadItem = {
  file: File;
  preview: string;
};

type UploadRequirement = {
  id: string;
  title: string;
  driveId?: string;
  fileType?: "image" | "audio";
  icon?: string;
  accept?: string;
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

const RAM_ROM_OPTIONS = [
  "1GB / 8GB",
  "2GB / 16GB",
  "2GB / 32GB",
  "3GB / 32GB",
  "3GB / 64GB",
  "4GB / 64GB",
  "4GB / 128GB",
  "6GB / 64GB",
  "6GB / 128GB",
  "6GB / 256GB",
  "8GB / 128GB",
  "8GB / 256GB",
  "8GB / 512GB",
  "12GB / 128GB",
  "12GB / 256GB",
  "12GB / 512GB",
  "12GB / 1TB",
  "16GB / 256GB",
  "16GB / 512GB",
  "16GB / 1TB",
  "18GB / 512GB",
  "24GB / 1TB",
];

const NGOAI_DS_REQUIREMENTS: UploadRequirement[] = [
  {
    id: "front-imei",
    title: "Mặt trước, mở sáng và thấy được IMEI trên màn hình",
    driveId: "1dDcvWlo-h8ccVbn0dctxZ8lH2JHP7971",
  },
  {
    id: "front-info",
    title: "Mặt trước, mở phần thông tin thiết bị trên màn hình để chụp",
    driveId: "1OIGVgIS67lFz__IvHkooCOk0IIVVEtCm",
  },
  {
    id: "top-right",
    title: "Góc trên bên phải",
    driveId: "1vNX9OAQEEKljhkFAdvAx4Bj5RzQwy3bW",
  },
  {
    id: "bottom-right",
    title: "Góc dưới bên phải",
    driveId: "1vQ7dhiq1llNHlhb7ffQ3RkOYpu43luhp",
  },
  {
    id: "top-left",
    title: "Góc trên bên trái",
    driveId: "1vWLGKdkLDVh-bnOtbUFQXOc9qKkDO7T8",
  },
  {
    id: "bottom-left",
    title: "Góc dưới bên trái",
    driveId: "1vPdoFJeKauT1km9G_syNS1vA55A0enD6",
  },
];

const CHIEN_GIA_REQUIREMENTS: UploadRequirement[] = [
  {
    id: "front-imei",
    title: "Mặt trước sáng màn hình (thấy IMEI)",
    driveId: "1dDcvWlo-h8ccVbn0dctxZ8lH2JHP7971",
  },
  {
    id: "front-info",
    title: "Màn hình thông tin thiết bị",
    driveId: "1OIGVgIS67lFz__IvHkooCOk0IIVVEtCm",
  },
  {
    id: "erp-support",
    title: "Ảnh Tiền xác máy + Trợ giá trên ERP",
    driveId: "1k4X-8md_-i_tLYhGhDeXUXkTXZEhwGma",
  },
  {
    id: "competitor-proof",
    title: "Ảnh xác thực giá đối thủ",
    driveId: "1Vn7pVdHKMJJ7hwX3OgV3aAmBs-P5muWI",
  },
  {
    id: "call-record",
    title: "File ghi âm cuộc gọi/Dò giá",
    fileType: "audio",
    icon: "bi-mic-fill",
    accept: "audio/*,.m4a,.mp3,.wav,.aac,.ogg,.amr",
  },
];

function getUploadRequirements(flow: PincodeFlow): UploadRequirement[] {
  return flow === "ChienGia" ? CHIEN_GIA_REQUIREMENTS : NGOAI_DS_REQUIREMENTS;
}

function clean(value: string) {
  return String(value || "").trim();
}

function onlyDigits(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function normalizeSearch(value: string) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatStatus(status: string) {
  if (status === "Approved") return "Đã cấp PMH";
  if (status === "Completed") return "Đã nhận PMH";
  if (status === "Rejected_Soft") return "Cần cập nhật";
  if (status === "Rejected_Hard") return "Từ chối";
  return "Chờ duyệt";
}

function driveThumbnail(driveId: string) {
  return `https://drive.google.com/thumbnail?id=${driveId}&sz=w640`;
}

function parseReviewFeedback(reason: string, slotCount: number) {
  const raw = clean(reason);
  const match = raw.match(/^\[CHUP_LAI_ANH:([1-6](?:,[1-6])*)\]\s*/);
  const slots = match
    ? match[1].split(",").filter((item) => /^[1-6]$/.test(item))
    : Array.from({ length: slotCount }, (_, index) => String(index + 1));

  return {
    slots,
    message: match ? raw.replace(match[0], "").trim() : raw,
  };
}

function isValidImei(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{15}$/.test(digits)) return false;

  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  return sum % 10 === 0;
}

function isValidSerialNumber(value: string) {
  return /^[A-Z0-9]{11}$/.test(clean(value).toUpperCase());
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

function makeFileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Không đọc được file ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

export default function PincodeRequestApp({ flow, title, subtitle }: PincodeRequestAppProps) {
  const meta = FLOW_META[flow];
  const storageKey = `vtdd_pincode_request_${flow}`;
  const [maST, setMaST] = useState("");
  const [maNV, setMaNV] = useState("");
  const [staffLookup, setStaffLookup] = useState<StaffLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [identifierType, setIdentifierType] = useState<IdentifierType>("IMEI");
  const [identifier, setIdentifier] = useState("");
  const [modelCu, setModelCu] = useState("");
  const [oldModelOptions, setOldModelOptions] = useState<string[]>([]);
  const [oldModelQuery, setOldModelQuery] = useState("");
  const [oldModelMenuOpen, setOldModelMenuOpen] = useState(false);
  const [loadingOldModels, setLoadingOldModels] = useState(false);
  const [oldModelError, setOldModelError] = useState("");
  const [oldRamRom, setOldRamRom] = useState("");
  const [deviceCategory, setDeviceCategory] = useState<DeviceCategory>("");
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelMoi, setModelMoi] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState("");
  const [uploads, setUploads] = useState<Record<string, UploadItem | undefined>>({});
  const [request, setRequest] = useState<PincodeRequest | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitPhase, setSubmitPhase] = useState<"" | "uploading" | "waiting">("");
  const [followUpPrompt, setFollowUpPrompt] = useState<PincodeRequest | null>(null);
  const [dismissedFollowUpId, setDismissedFollowUpId] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; title: string; type: "image" | "audio" } | null>(null);
  const [toast, setToast] = useState("");

  const lookupIsFresh = staffLookup?.query.maST === clean(maST) && staffLookup?.query.maNV === clean(maNV);
  const storeText = lookupIsFresh && staffLookup?.store?.storeName ? staffLookup.store.storeName : "";
  const staffText = lookupIsFresh && staffLookup?.staff?.staffName ? staffLookup.staff.staffName : "";
  const pairError = lookupIsFresh && staffLookup?.message ? staffLookup.message : "";
  const staffReady = Boolean(clean(maST) && clean(maNV) && lookupIsFresh && staffLookup?.valid);
  const currentRequirements = useMemo(() => getUploadRequirements(flow), [flow]);
  const identifierValid = identifierType === "IMEI" ? isValidImei(identifier) : isValidSerialNumber(identifier);
  const identifierError =
    clean(identifier) && !identifierValid
      ? identifierType === "IMEI"
        ? "Lỗi cú pháp IMEI, nhập lại"
        : "Lỗi cú pháp Serial Number, nhập lại"
      : "";
  const selectedImagesCount = currentRequirements.filter((item) => uploads[item.id]?.file).length;
  const oldModelValid = flow === "ChienGia" ? Boolean(modelCu && oldModelOptions.includes(modelCu)) : Boolean(clean(modelCu));
  const filteredOldModelOptions = useMemo(() => {
    const query = normalizeSearch(oldModelQuery);
    const source = query
      ? oldModelOptions.filter((item) => normalizeSearch(item).includes(query))
      : oldModelOptions;

    return source.slice(0, 100);
  }, [oldModelOptions, oldModelQuery]);
  const modelMoiValid = Boolean(modelMoi && modelOptions.includes(modelMoi));
  const filteredModelOptions = useMemo(() => {
    const query = normalizeSearch(modelQuery);
    const source = query
      ? modelOptions.filter((item) => normalizeSearch(item).includes(query))
      : modelOptions;

    return source.slice(0, 80);
  }, [modelOptions, modelQuery]);
  const formReady = Boolean(
    staffReady &&
      identifierValid &&
      oldModelValid &&
      (flow === "ChienGia" || clean(oldRamRom)) &&
      deviceCategory &&
      modelMoiValid &&
      selectedImagesCount === currentRequirements.length
  );

  const canSubmit = formReady && !submitting;

  const selectedIdentifier = useMemo(() => {
    if (identifierType === "Serial") return `SN:${clean(identifier).toUpperCase()}`;
    return identifier.replace(/\D/g, "");
  }, [identifier, identifierType]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function copyText(value: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // Thử cách copy dự phòng bên dưới.
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
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
      if (!options?.silent) showToast(err?.message || "Không kiểm tra được trạng thái.");
    }
  }

  useEffect(() => {
    if (!request?.requestId) return;
    if (request.status !== "Pending" && request.status !== "Approved") return;

    const timer = window.setInterval(() => {
      loadStatus(request.requestId, { silent: true });
    }, 5000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.requestId, request?.status]);

  useEffect(() => {
    const targetStore = clean(maST);
    const targetStaff = clean(maNV);
    const hasEnoughStoreCode = targetStore.length >= 4;
    const hasEnoughStaffCode = targetStaff.length >= 5;

    if (!targetStore && !targetStaff) {
      setStaffLookup(null);
      setLookupLoading(false);
      return;
    }

    if ((targetStore && !hasEnoughStoreCode) || (targetStaff && !hasEnoughStaffCode)) {
      setLookupLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLookupLoading(true);
        const params = new URLSearchParams({ maST: targetStore, maNV: targetStaff });
        const res = await fetch(`/api/tools/pincode/lookup?${params.toString()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(data?.message || "Không kiểm tra được mã nhân viên.");
        setStaffLookup(data);
        setLookupLoading(false);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setStaffLookup({
          success: false,
          valid: false,
          message: err?.message || "Không kiểm tra được mã siêu thị / nhân viên.",
          staff: null,
          store: null,
          query: { maST: targetStore, maNV: targetStaff },
        });
        setLookupLoading(false);
      }
    }, 650);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [maST, maNV]);

  useEffect(() => {
    if (!staffReady || submitting || submitPhase === "uploading") return;
    if (request?.requestId && (request.status === "Pending" || request.status === "Approved" || request.status === "Completed")) return;
    if (followUpPrompt) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ maST: clean(maST), maNV: clean(maNV), flow });
        const res = await fetch(`/api/tools/pincode/status?${params.toString()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success || !data.request) return;

        const found = data.request as PincodeRequest;
        if (found.requestId === dismissedFollowUpId) return;

        setRevealed(false);
        if (found.status === "Pending") {
          setRequest(found);
          setSubmitPhase("waiting");
          if (found.requestId) window.localStorage.setItem(storageKey, found.requestId);
          return;
        }

        if (found.status === "Approved") {
          setFollowUpPrompt(found);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          // Chỉ kiểm tra ngầm, không làm gián đoạn thao tác nhập liệu.
        }
      }
    }, 420);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    dismissedFollowUpId,
    flow,
    followUpPrompt,
    maNV,
    maST,
    request?.requestId,
    request?.status,
    staffReady,
    storageKey,
    submitting,
    submitPhase,
  ]);

  useEffect(() => {
    setOldModelOptions([]);
    setOldModelError("");
    setOldModelMenuOpen(false);

    if (flow !== "ChienGia") return;

    const controller = new AbortController();

    async function loadOldModels() {
      try {
        setLoadingOldModels(true);
        const res = await fetch("/api/tools/pincode/models?type=old", {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(data?.message || "Không tải được danh sách máy cũ.");
        setOldModelOptions(Array.isArray(data.models) ? data.models : []);
        setLoadingOldModels(false);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setOldModelError(err?.message || "Không tải được danh sách máy cũ.");
        setLoadingOldModels(false);
      }
    }

    loadOldModels();

    return () => controller.abort();
  }, [flow]);

  useEffect(() => {
    setModelMoi("");
    setModelQuery("");
    setModelMenuOpen(false);
    setModelOptions([]);
    setModelError("");

    if (!deviceCategory) return;

    const controller = new AbortController();

    async function loadModels() {
      try {
        setLoadingModels(true);
        const params = new URLSearchParams({ category: deviceCategory });
        const res = await fetch(`/api/tools/pincode/models?${params.toString()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(data?.message || "Không tải được danh sách máy mới.");
        setModelOptions(Array.isArray(data.models) ? data.models : []);
        setLoadingModels(false);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setModelError(err?.message || "Không tải được danh sách máy mới.");
        setLoadingModels(false);
      }
    }

    loadModels();

    return () => controller.abort();
  }, [deviceCategory]);

  function updateIdentifierType(nextType: IdentifierType) {
    setIdentifierType(nextType);
    setIdentifier("");
  }

  function updateIdentifier(value: string) {
    if (identifierType === "IMEI") {
      setIdentifier(onlyDigits(value, 15));
      return;
    }

    setIdentifier(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11));
  }

  function changeSlotImage(slotId: string, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const requirement = currentRequirements.find((item) => item.id === slotId);
    const isAudioSlot = requirement?.fileType === "audio";
    const isAudioFile = file.type.startsWith("audio/") || /\.(m4a|mp3|wav|aac|ogg|amr)$/i.test(file.name);

    if (isAudioSlot && !isAudioFile) {
      showToast("Ô này chỉ nhận file ghi âm.");
      return;
    }

    if (!isAudioSlot && !file.type.startsWith("image/")) {
      showToast("Chỉ nhận file hình ảnh.");
      return;
    }

    setUploads((current) => {
      const oldItem = current[slotId];
      if (oldItem) URL.revokeObjectURL(oldItem.preview);

      return {
        ...current,
        [slotId]: {
          file,
          preview: URL.createObjectURL(file),
        },
      };
    });
  }

  function removeSlotImage(slotId: string) {
    setUploads((current) => {
      const oldItem = current[slotId];
      if (oldItem) URL.revokeObjectURL(oldItem.preview);

      return {
        ...current,
        [slotId]: undefined,
      };
    });
  }

  async function submitRequest() {
    let progressTimer = 0;

    try {
      if (!formReady) {
        showToast("Nhập đủ và đúng toàn bộ thông tin để gửi duyệt PMH.");
        return;
      }

      setSubmitting(true);
      setSubmitPhase("uploading");
      setSubmitProgress(4);
      setFollowUpPrompt(null);
      progressTimer = window.setInterval(() => {
        setSubmitProgress((current) => Math.min(94, current + Math.max(1, Math.round((100 - current) * 0.12))));
      }, 220);

      const imagePayload = await Promise.all(
        currentRequirements.map((item) =>
          item.fileType === "audio"
            ? makeFileDataUrl(uploads[item.id]!.file)
            : makeImageDataUrl(uploads[item.id]!.file)
        )
      );
      const res = await fetch("/api/tools/pincode/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: JSON.stringify({
          flow,
          maST,
          maNV,
          imei: selectedIdentifier,
          identifierType,
          modelCu,
          oldRamRom,
          modelMoi,
          deviceCategory,
          note: `Ngành hàng máy cũ: ${deviceCategory}`,
          images: imagePayload.map((dataUrl) => ({ dataUrl })),
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) throw new Error(data?.message || "Không gửi được hồ sơ.");

      if (progressTimer) window.clearInterval(progressTimer);
      setSubmitProgress(100);
      setRequest(data.request);
      setRevealed(false);
      if (data.request?.requestId) window.localStorage.setItem(storageKey, data.request.requestId);
      if (data.request?.status !== "Pending") showToast(data.message || "Đã gửi hồ sơ.");
      setSubmitting(false);
      window.setTimeout(() => {
        setSubmitPhase(data.request?.status === "Pending" ? "waiting" : "");
        setSubmitProgress(0);
      }, 450);
    } catch (err: any) {
      if (progressTimer) window.clearInterval(progressTimer);
      setSubmitting(false);
      setSubmitPhase("");
      setSubmitProgress(0);
      showToast(err?.message || "Không gửi được hồ sơ.");
    }
  }

  async function markRequestViewed(target: PincodeRequest) {
    if (!target.pinCode) return;

    setRevealed(true);
    const copied = await copyText(target.pinCode);

    try {
      await fetch("/api/tools/pincode/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: JSON.stringify({ requestId: target.requestId, action: "DONE" }),
      });
      await loadStatus(target.requestId, { silent: true });
      showToast(copied ? "Đã copy mã PMH." : "PMH đã hiển thị, hãy copy thủ công nếu cần.");
    } catch {
      showToast("PMH đã hiển thị, nhưng chưa ghi nhận được trạng thái Done.");
    }
  }

  async function revealAndCopy() {
    if (!request?.pinCode) return;
    await markRequestViewed(request);
  }

  async function viewFollowUpRequest() {
    if (!followUpPrompt) return;
    const target = followUpPrompt;

    setRequest(target);
    setFollowUpPrompt(null);
    await markRequestViewed(target);
  }

  async function skipFollowUpRequest() {
    if (!followUpPrompt) return;
    const target = followUpPrompt;

    try {
      await fetch("/api/tools/pincode/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: JSON.stringify({ requestId: target.requestId, action: "SKIP" }),
      });
      setDismissedFollowUpId(target.requestId);
      setFollowUpPrompt(null);
      if (request?.requestId === target.requestId) setRequest(null);
      showToast("Đã bỏ qua PMH cũ, có thể tạo yêu cầu mới.");
    } catch {
      showToast("Chưa ghi nhận được lựa chọn tạo yêu cầu mới.");
    }
  }

  async function submitRecaptureRequest() {
    let progressTimer = 0;

    try {
      if (!request || !isRejectedSoft) return;
      if (!recaptureReady) {
        showToast("Vui lòng chụp/chọn đủ ảnh được yêu cầu chụp lại.");
        return;
      }

      setSubmitting(true);
      setSubmitPhase("uploading");
      setSubmitProgress(4);
      progressTimer = window.setInterval(() => {
        setSubmitProgress((current) => Math.min(94, current + Math.max(1, Math.round((100 - current) * 0.12))));
      }, 220);

      const recaptureSlots = new Set(reviewFeedback.slots);
      const imagePayload = await Promise.all(
        currentRequirements.map(async (item, index) => {
          const slotNumber = String(index + 1);
          if (recaptureSlots.has(slotNumber)) {
            return {
              dataUrl: item.fileType === "audio"
                ? await makeFileDataUrl(uploads[item.id]!.file)
                : await makeImageDataUrl(uploads[item.id]!.file),
            };
          }

          return { url: request.imageUrls?.[index] || "" };
        })
      );

      const res = await fetch("/api/tools/pincode/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: JSON.stringify({
          requestId: request.requestId,
          flow,
          maST: request.maST,
          maNV: request.maNV,
          imei: request.imei,
          images: imagePayload,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) throw new Error(data?.message || "Không gửi được ảnh chụp lại.");

      if (progressTimer) window.clearInterval(progressTimer);
      setSubmitProgress(100);
      setRequest(data.request);
      setRevealed(false);
      setSubmitting(false);
      window.setTimeout(() => {
        setSubmitPhase(data.request?.status === "Pending" ? "waiting" : "");
        setSubmitProgress(0);
      }, 450);
    } catch (err: any) {
      if (progressTimer) window.clearInterval(progressTimer);
      setSubmitting(false);
      setSubmitPhase("");
      setSubmitProgress(0);
      showToast(err?.message || "Không gửi được ảnh chụp lại.");
    }
  }

  function closeToSupportHome() {
    window.location.href = "/cong-cu-ho-tro";
  }

  function startFresh() {
    setRequest(null);
    setRevealed(false);
    setSubmitPhase("");
    setSubmitProgress(0);
    setFollowUpPrompt(null);
    window.localStorage.removeItem(storageKey);
  }

  const isRejectedSoft = request?.status === "Rejected_Soft";
  const isRejectedHard = request?.status === "Rejected_Hard";
  const isApproved = request?.status === "Approved" || request?.status === "Completed";
  const isPending = request?.status === "Pending";
  const shouldShowProgress = submitPhase === "uploading";
  const shouldLockScreen = (isPending && submitPhase === "waiting") || isApproved;
  const reviewFeedback = parseReviewFeedback(request?.reason || "", currentRequirements.length);
  const recaptureRequirements = isRejectedSoft
    ? currentRequirements.filter((_, index) => reviewFeedback.slots.includes(String(index + 1)))
    : [];
  const recaptureReady = recaptureRequirements.length > 0 && recaptureRequirements.every((item) => uploads[item.id]?.file);

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

        </aside>

        <section className="pmh-request-main">
          <div className="pmh-form-grid">
            <label>
              <span>Mã siêu thị</span>
              <input value={maST} onChange={(event) => setMaST(onlyDigits(event.target.value, 8))} inputMode="numeric" placeholder="VD: 1234" />
              {lookupLoading && maST ? <small className="field-note">Đang kiểm tra...</small> : null}
              {!lookupLoading && storeText ? <small className="field-note ok">{storeText}</small> : null}
              {!lookupLoading && maST && lookupIsFresh && !staffLookup?.store ? <small className="field-note error">{pairError || "Mã siêu thị không tồn tại."}</small> : null}
            </label>

            <label>
              <span>Mã nhân viên</span>
              <input value={maNV} onChange={(event) => setMaNV(onlyDigits(event.target.value, 10))} inputMode="numeric" placeholder="VD: 100123" />
              {lookupLoading && maNV ? <small className="field-note">Đang kiểm tra...</small> : null}
              {!lookupLoading && staffText ? <small className="field-note ok">{staffText}</small> : null}
              {!lookupLoading && maNV && lookupIsFresh && !staffLookup?.staff ? <small className="field-note error">{pairError || "Mã nhân viên không tồn tại."}</small> : null}
            </label>

            {pairError && staffLookup?.store && staffLookup?.staff ? <div className="form-wide-error">{pairError}</div> : null}

            <label className="wide">
              <span>IMEI / Serial Number</span>
              <div className="identifier-switch" role="group" aria-label="Chọn IMEI hoặc Serial Number">
                <button type="button" className={identifierType === "IMEI" ? "active" : ""} onClick={() => updateIdentifierType("IMEI")}>
                  IMEI
                </button>
                <button type="button" className={identifierType === "Serial" ? "active" : ""} onClick={() => updateIdentifierType("Serial")}>
                  Serial Number
                </button>
              </div>
              <input
                value={identifier}
                onChange={(event) => updateIdentifier(event.target.value)}
                inputMode={identifierType === "IMEI" ? "numeric" : "text"}
                placeholder={identifierType === "IMEI" ? "Nhập đúng 15 số IMEI" : "Nhập đúng 11 ký tự Serial Number"}
                maxLength={identifierType === "IMEI" ? 15 : 11}
              />
              {identifierError ? <small className="field-note error">{identifierError}</small> : null}
            </label>

            <div className={`old-device-row ${flow === "ChienGia" ? "single" : ""}`}>
              <label>
                <span>Máy cũ</span>
                {flow === "ChienGia" ? (
                  <div className="model-combobox">
                    <input
                      value={oldModelQuery}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        const exact = oldModelOptions.find((item) => normalizeSearch(item) === normalizeSearch(nextValue));

                        setOldModelQuery(nextValue);
                        setModelCu(exact || "");
                        setOldModelMenuOpen(true);
                      }}
                      onFocus={() => setOldModelMenuOpen(Boolean(!loadingOldModels && !oldModelError))}
                      onBlur={() => window.setTimeout(() => setOldModelMenuOpen(false), 140)}
                      disabled={loadingOldModels || !!oldModelError}
                      placeholder={loadingOldModels ? "Đang tải danh sách máy cũ..." : "Nhập để tìm máy cũ"}
                    />
                    {oldModelMenuOpen ? (
                      <div className="model-options" role="listbox">
                        {filteredOldModelOptions.length > 0 ? (
                          filteredOldModelOptions.map((item) => (
                            <button
                              type="button"
                              key={item}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setModelCu(item);
                                setOldModelQuery(item);
                                setOldModelMenuOpen(false);
                              }}
                            >
                              {item}
                            </button>
                          ))
                        ) : (
                          <em>Không tìm thấy máy cũ phù hợp</em>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <input value={modelCu} onChange={(event) => setModelCu(event.target.value)} placeholder="Tên model máy cũ" />
                )}
                {oldModelError ? <small className="field-note error">{oldModelError}</small> : null}
                {flow === "ChienGia" && oldModelQuery && !oldModelValid ? <small className="field-note error">Vui lòng chọn máy cũ trong danh sách Data_Cu / Data_Cu_Tablet.</small> : null}
              </label>
              {flow === "ChienGia" ? null : (
                <label>
                  <span>RAM/ROM</span>
                  <select value={oldRamRom} onChange={(event) => setOldRamRom(event.target.value)}>
                    <option value="">Chọn RAM/ROM</option>
                    {RAM_ROM_OPTIONS.map((item) => (
                      <option value={item} key={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <>
                <label>
                  <span>Ngành hàng máy cũ</span>
                  <select value={deviceCategory} onChange={(event) => setDeviceCategory(event.target.value as DeviceCategory)}>
                    <option value="">Chọn ngành hàng</option>
                    <option value="Điện thoại">Điện thoại</option>
                    <option value="Máy tính bảng">Máy tính bảng</option>
                  </select>
                </label>

                <label>
                  <span>Máy mới</span>
                  <div className="model-combobox">
                    <input
                      value={modelQuery}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        const exact = modelOptions.find((item) => normalizeSearch(item) === normalizeSearch(nextValue));

                        setModelQuery(nextValue);
                        setModelMoi(exact || "");
                        setModelMenuOpen(true);
                      }}
                      onFocus={() => setModelMenuOpen(Boolean(deviceCategory && !loadingModels && !modelError))}
                      onBlur={() => window.setTimeout(() => setModelMenuOpen(false), 140)}
                      disabled={!deviceCategory || loadingModels || !!modelError}
                      placeholder={loadingModels ? "Đang tải danh sách..." : "Nhập để tìm máy mới"}
                    />
                    {modelMenuOpen ? (
                      <div className="model-options" role="listbox">
                        {filteredModelOptions.length > 0 ? (
                          filteredModelOptions.map((item) => (
                            <button
                              type="button"
                              key={item}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setModelMoi(item);
                                setModelQuery(item);
                                setModelMenuOpen(false);
                              }}
                            >
                              {item}
                            </button>
                          ))
                        ) : (
                          <em>Không tìm thấy máy phù hợp</em>
                        )}
                      </div>
                    ) : null}
                  </div>
                  {modelError ? <small className="field-note error">{modelError}</small> : null}
                  {modelQuery && !modelMoiValid ? <small className="field-note error">Vui lòng chọn máy mới trong danh sách Data_Moi.</small> : null}
                  {deviceCategory && !loadingModels && !modelError && modelOptions.length === 0 ? <small className="field-note error">Chưa có máy mới phù hợp trong Data_Moi.</small> : null}
                </label>
            </>
          </div>

          <div className="pmh-upload-panel">
            <div className="pmh-upload-title">
              <b>{flow === "ChienGia" ? "Hồ sơ chiến giá" : "Ảnh hồ sơ"}</b>
              <small>{selectedImagesCount}/{currentRequirements.length} file</small>
            </div>

            <div className="pmh-required-images">
              {currentRequirements.map((item, index) => {
                const upload = uploads[item.id];
                const cameraInputId = `pmh-camera-${item.id}`;
                const libraryInputId = `pmh-image-${item.id}`;
                const isAudio = item.fileType === "audio";
                const sampleUrl = item.driveId ? driveThumbnail(item.driveId) : "";

                return (
                  <div className={`pmh-image-row ${isAudio ? "audio" : ""}`} key={item.id}>
                    <div className="pmh-image-index">{String(index + 1).padStart(2, "0")}</div>
                    <div className="pmh-image-copy">
                      <b>{item.title}</b>
                      <small>{upload ? upload.file.name : isAudio ? "Chưa chọn file ghi âm" : "Chưa chọn ảnh"}</small>
                    </div>
                    {isAudio ? (
                      <div className="pmh-audio-sample" aria-hidden="true">
                        <i className={item.icon || ""} />
                        <span>Audio</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="pmh-sample-button"
                        onClick={() => setPreviewFile({ url: sampleUrl, title: item.title, type: "image" })}
                        aria-label={`Xem ảnh mẫu ${index + 1}`}
                      >
                        <img className="pmh-sample-image" src={sampleUrl} alt={`Ảnh mẫu ${index + 1}`} />
                      </button>
                    )}
                    <div className="pmh-slot-actions">
                      {isAudio ? null : (
                        <label className="pmh-slot-picker camera" htmlFor={cameraInputId}>
                          Chụp ảnh
                        </label>
                      )}
                      <label className="pmh-slot-picker" htmlFor={libraryInputId}>
                        {isAudio ? "Chọn file" : "Chọn ảnh"}
                      </label>
                    </div>
                    {isAudio ? null : (
                      <input
                        id={cameraInputId}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event) => {
                          changeSlotImage(item.id, event.target.files);
                          event.currentTarget.value = "";
                        }}
                      />
                    )}
                    <input
                      id={libraryInputId}
                      type="file"
                      accept={item.accept || "image/png,image/jpeg,image/webp,image/heic,image/heif"}
                      onChange={(event) => {
                        changeSlotImage(item.id, event.target.files);
                        event.currentTarget.value = "";
                      }}
                    />
                    {upload ? (
                      <div className="pmh-selected-preview">
                        {isAudio ? (
                          <audio src={upload.preview} controls />
                        ) : (
                          <button
                            type="button"
                            className="pmh-selected-view"
                            onClick={() => setPreviewFile({ url: upload.preview, title: item.title, type: "image" })}
                            aria-label={`Xem ${item.title}`}
                          >
                            <img src={upload.preview} alt={item.title} />
                          </button>
                        )}
                        <button type="button" onClick={() => removeSlotImage(item.id)} aria-label="Xóa ảnh">
                          Xóa
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pmh-submit-row">
            {formReady ? (
              <button type="button" onClick={submitRequest} disabled={!canSubmit}>
                {submitting ? "Đang gửi..." : isRejectedSoft ? "Gửi lại hồ sơ" : "Gửi duyệt PMH"}
              </button>
            ) : (
              <div className="pmh-submit-guard">Nhập đủ và đúng toàn bộ thông tin để hiện nút gửi duyệt PMH.</div>
            )}

            {request ? (
              <button type="button" className="secondary" onClick={() => loadStatus(request.requestId)} disabled={loadingStatus}>
                {loadingStatus ? "Đang kiểm tra..." : "Kiểm tra trạng thái"}
              </button>
            ) : null}
          </div>

          {request && !isRejectedSoft && !isRejectedHard ? (
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

              <button type="button" className="pmh-new-request" onClick={startFresh}>
                Tạo hồ sơ mới
              </button>
            </section>
          ) : null}
        </section>
      </section>

      {shouldShowProgress ? (
        <div className="pmh-pending-lock" role="alert" aria-live="assertive">
          <div className="pmh-pending-box progress">
            <span>Đang gửi yêu cầu</span>
            <h2>Đang tải hồ sơ thẩm định</h2>
            <div className="pmh-progress-track" aria-label={`Đã gửi ${submitProgress}%`}>
              <i style={{ width: `${submitProgress}%` }} />
            </div>
            <small>{submitProgress}% hoàn thành</small>
          </div>
        </div>
      ) : null}

      {followUpPrompt ? (
        <div className="pmh-pending-lock" role="alert" aria-live="assertive">
          <div className="pmh-pending-box followup">
            <span>PMH đã cấp</span>
            <h2>Bạn có yêu cầu trước đó đã hoàn tất cấp PMH nhưng chưa xem</h2>
            <small>Hồ sơ {followUpPrompt.flowLabel} · NV {followUpPrompt.maNV} · ST {followUpPrompt.maST}</small>
            <div className="pmh-lock-actions">
              <button type="button" onClick={viewFollowUpRequest}>
                Xem
              </button>
              <button type="button" className="secondary" onClick={skipFollowUpRequest}>
                Đóng, tạo yêu cầu mới
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isRejectedSoft && request && !shouldShowProgress ? (
        <div className="pmh-pending-lock" role="alert" aria-live="assertive">
          <div className="pmh-pending-box recapture">
            <span>Yêu cầu chụp lại</span>
            <h2>Hồ sơ cần bổ sung ảnh</h2>
            {reviewFeedback.message ? <p className="pmh-lock-message">{reviewFeedback.message}</p> : null}
            <small>Chỉ chụp/chọn lại các ảnh được yêu cầu bên dưới.</small>

            <div className="pmh-recapture-list">
              {recaptureRequirements.map((item, index) => {
                const originalIndex = currentRequirements.findIndex((target) => target.id === item.id);
                const slotNumber = originalIndex >= 0 ? originalIndex + 1 : index + 1;
                const upload = uploads[item.id];
                const cameraInputId = `pmh-recapture-camera-${item.id}`;
                const libraryInputId = `pmh-recapture-image-${item.id}`;
                const isAudio = item.fileType === "audio";

                return (
                  <div className={`pmh-recapture-row ${isAudio ? "audio" : ""}`} key={item.id}>
                    <div className="pmh-image-index">{String(slotNumber).padStart(2, "0")}</div>
                    <div className="pmh-image-copy">
                      <b>{item.title}</b>
                      <small>{upload ? upload.file.name : isAudio ? "Chưa chọn file mới" : "Chưa chọn ảnh mới"}</small>
                    </div>
                    <div className="pmh-slot-actions">
                      {isAudio ? null : (
                        <label className="pmh-slot-picker camera" htmlFor={cameraInputId}>
                          Chụp ảnh
                        </label>
                      )}
                      <label className="pmh-slot-picker" htmlFor={libraryInputId}>
                        {isAudio ? "Chọn file" : "Chọn ảnh"}
                      </label>
                    </div>
                    {isAudio ? null : (
                      <input
                        id={cameraInputId}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event) => {
                          changeSlotImage(item.id, event.target.files);
                          event.currentTarget.value = "";
                        }}
                      />
                    )}
                    <input
                      id={libraryInputId}
                      type="file"
                      accept={item.accept || "image/png,image/jpeg,image/webp,image/heic,image/heif"}
                      onChange={(event) => {
                        changeSlotImage(item.id, event.target.files);
                        event.currentTarget.value = "";
                      }}
                    />
                    {upload ? (
                      <div className="pmh-selected-preview compact">
                        {isAudio ? (
                          <audio src={upload.preview} controls />
                        ) : (
                          <button
                            type="button"
                            className="pmh-selected-view"
                            onClick={() => setPreviewFile({ url: upload.preview, title: item.title, type: "image" })}
                            aria-label={`Xem ${item.title}`}
                          >
                            <img src={upload.preview} alt={item.title} />
                          </button>
                        )}
                        <button type="button" onClick={() => removeSlotImage(item.id)} aria-label="Xóa ảnh">
                          Xóa
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <button type="button" onClick={submitRecaptureRequest} disabled={!recaptureReady || submitting}>
              {submitting ? "Đang gửi..." : "Gửi lại ảnh"}
            </button>
          </div>
        </div>
      ) : null}

      {isRejectedHard && request && !shouldShowProgress ? (
        <div className="pmh-pending-lock" role="alert" aria-live="assertive">
          <div className="pmh-pending-box rejected">
            <span>Hồ sơ bị từ chối</span>
            <h2>Không thể cấp PMH cho hồ sơ này</h2>
            {reviewFeedback.message ? <p className="pmh-lock-message">{reviewFeedback.message}</p> : null}
            <button type="button" onClick={startFresh}>
              Tạo yêu cầu mới
            </button>
          </div>
        </div>
      ) : null}

      {shouldLockScreen ? (
        <div className="pmh-pending-lock" role="alert" aria-live="assertive">
          <div className={`pmh-pending-box ${isPending ? "pending-review" : ""} ${isApproved ? "approved" : ""}`}>
            {isPending ? (
              <div className="pmh-wait-card">
                <div className="pmh-wait-head">
                  <div>
                    <span>Kiểm duyệt yêu cầu</span>
                    <h2>Hồ sơ đã gửi, đang chờ cấp PMH</h2>
                    <p>Trang sẽ tự cập nhật khi admin hoàn tất duyệt hồ sơ.</p>
                  </div>
                  <div className="pmh-wait-rings" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>

                <div className="pmh-wait-steps" aria-label="Trạng thái hồ sơ">
                  <div className="pmh-wait-step done">
                    <b>1</b>
                    <span>Đã nhận hồ sơ</span>
                  </div>
                  <div className="pmh-wait-step active">
                    <b>2</b>
                    <span>Đang kiểm duyệt</span>
                  </div>
                  <div className="pmh-wait-step">
                    <b>3</b>
                    <span>Cấp PMH</span>
                  </div>
                </div>

                <div className="pmh-wait-meta">
                  <span>{request?.flowLabel || meta.badge}</span>
                  <span>ST {request?.maST || maST}</span>
                  <span>NV {request?.maNV || maNV}</span>
                </div>

                <div className="pmh-wait-note">
                  Vui lòng không đóng hoặc tắt trình duyệt trong lúc chờ PMH.
                </div>
              </div>
            ) : (
              <>
                <span>PMH đã được duyệt</span>
                <h2>Mã PMH của hồ sơ</h2>
                <b className={`pmh-lock-code ${revealed || request?.status === "Completed" ? "" : "blurred"}`}>
                  {request?.pinCode || "Đang tải"}
                </b>
                <small>{request?.menhGia || "Đã cấp PMH"}</small>
                <div className="pmh-lock-actions">
                  <button type="button" onClick={revealAndCopy}>
                    {revealed || request?.status === "Completed" ? "Copy lại PMH" : "Xem PMH"}
                  </button>
                  {revealed || request?.status === "Completed" ? (
                    <button type="button" className="secondary" onClick={closeToSupportHome}>
                      Đóng
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {previewFile ? (
        <div className="pmh-preview-modal" role="dialog" aria-modal="true" aria-label={previewFile.title}>
          <div className="pmh-preview-box">
            <button type="button" className="pmh-preview-close" onClick={() => setPreviewFile(null)} aria-label="Đóng xem file">
              X
            </button>
            <div className="pmh-preview-head">
              <span>Xem hồ sơ</span>
              <b>{previewFile.title}</b>
            </div>
            {previewFile.type === "audio" ? (
              <audio src={previewFile.url} controls />
            ) : (
              <img src={previewFile.url} alt={previewFile.title} />
            )}
          </div>
        </div>
      ) : null}

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
  min-width: 0;
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
  background: #ffd400;
  color: #07111f;
  border: 1px solid #ffd400;
  font-size: 12px;
  font-weight: 1000;
  text-transform: uppercase;
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
  background: linear-gradient(180deg, #07111f 0%, #101827 100%);
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
.pmh-form-grid label.wide,
.old-device-row,
.form-wide-error {
  grid-column: 1 / -1;
}
.old-device-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, .45fr);
  gap: 12px;
}
.old-device-row.single {
  grid-template-columns: 1fr;
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
.pmh-form-grid textarea,
.pmh-form-grid select {
  width: 100%;
  border: 1px solid #dbe5ef;
  border-radius: 16px;
  background: #f8fafc;
  color: #07111f;
  outline: none;
  font-size: 15px;
  font-weight: 850;
}
.pmh-form-grid input,
.pmh-form-grid select {
  min-height: 52px;
  padding: 0 14px;
}
.pmh-form-grid textarea {
  min-height: 110px;
  resize: vertical;
  padding: 14px;
}
.pmh-form-grid input:focus,
.pmh-form-grid textarea:focus,
.pmh-form-grid select:focus {
  border-color: #07111f;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(7,17,31,.08);
}
.pmh-form-grid select:disabled {
  cursor: not-allowed;
  opacity: .64;
}
.model-combobox {
  position: relative;
}
.model-options {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  z-index: 20;
  max-height: 280px;
  overflow: auto;
  padding: 6px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #dbe5ef;
  box-shadow: 0 18px 44px rgba(15,23,42,.16);
}
.model-options button,
.model-options em {
  width: 100%;
  min-height: 42px;
  padding: 9px 10px;
  border: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  background: transparent;
  color: #07111f;
  text-align: left;
  font-size: 13px;
  font-style: normal;
  font-weight: 900;
}
.model-options button {
  cursor: pointer;
}
.model-options button:hover {
  background: #f1f5f9;
}
.model-options em {
  color: #64748b;
}
.field-note {
  min-height: 16px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 850;
}
.field-note.ok {
  color: #047857;
}
.field-note.error,
.form-wide-error {
  color: #b91c1c;
}
.form-wide-error {
  padding: 10px 12px;
  border-radius: 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  font-size: 12px;
  font-weight: 900;
}
.identifier-switch {
  padding: 5px;
  border-radius: 16px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  background: #e8eef5;
  border: 1px solid #dbe5ef;
}
.identifier-switch button {
  min-height: 42px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #475569;
  font-size: 12px;
  font-weight: 1000;
  cursor: pointer;
}
.identifier-switch button.active {
  background: #07111f;
  color: #ffd400;
  box-shadow: 0 10px 24px rgba(15,23,42,.16);
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
.pmh-required-images {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}
.pmh-image-row {
  min-height: 108px;
  padding: 10px;
  border-radius: 18px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 96px minmax(190px, .5fr) 112px;
  gap: 10px;
  align-items: center;
  background: #fff;
  border: 1px solid #dbe5ef;
}
.pmh-image-index {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: #07111f;
  color: #ffd400;
  font-size: 12px;
  font-weight: 1000;
}
.pmh-image-copy {
  min-width: 0;
  display: grid;
  gap: 6px;
}
.pmh-image-copy b {
  color: #07111f;
  font-size: 14px;
  line-height: 1.25;
  font-weight: 1000;
}
.pmh-image-copy small {
  color: #64748b;
  font-size: 12px;
  font-weight: 850;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pmh-sample-button,
.pmh-audio-sample,
.pmh-selected-preview {
  width: 96px;
  height: 82px;
  border-radius: 14px;
  background: #e2e8f0;
  border: 1px solid #dbe5ef;
}
.pmh-sample-button {
  padding: 0;
  overflow: hidden;
  cursor: zoom-in;
}
.pmh-sample-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.pmh-audio-sample {
  display: grid;
  place-items: center;
  gap: 4px;
  background: #ecfdf5;
  color: #047857;
  font-size: 11px;
  font-weight: 1000;
  text-align: center;
}
.pmh-audio-sample i {
  font-size: 22px;
}
.pmh-image-row.audio {
  grid-template-columns: 42px minmax(0, 1fr) 96px minmax(140px, .36fr) 112px;
}
.pmh-slot-picker {
  min-height: 42px;
  padding: 0 14px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #ffd400;
  color: #07111f;
  font-size: 12px;
  font-weight: 1000;
  cursor: pointer;
  white-space: nowrap;
}
.pmh-slot-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.pmh-slot-picker.camera {
  background: #07111f;
  color: #ffd400;
}
.pmh-image-row > input {
  display: none;
}
.pmh-selected-preview {
  position: relative;
  overflow: hidden;
}
.pmh-selected-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pmh-selected-preview audio {
  width: 100%;
  height: 100%;
  padding: 6px;
}
.pmh-selected-view {
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  display: block;
  background: transparent;
  cursor: zoom-in;
}
.pmh-selected-preview > button:not(.pmh-selected-view) {
  position: absolute;
  right: 6px;
  bottom: 6px;
  min-height: 26px;
  border: 0;
  border-radius: 999px;
  padding: 0 9px;
  background: rgba(7,17,31,.9);
  color: #fff;
  font-size: 10px;
  font-weight: 1000;
  cursor: pointer;
}
.pmh-submit-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
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
.pmh-submit-row > button:first-child {
  min-width: min(100%, 320px);
}
.pmh-submit-row button.secondary,
.pmh-new-request {
  background: #f8fafc;
  border: 1px solid #dbe5ef;
}
.pmh-submit-guard {
  min-height: 48px;
  padding: 0 16px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 12px;
  font-weight: 1000;
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
  font-weight: 850;
}
.pmh-resubmit-note.hard {
  background: #fef2f2;
  border-color: #fecaca;
  color: #991b1b;
}
.pmh-waiting {
  padding: 12px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 850;
}
.pmh-waiting i {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0 7px rgba(37,99,235,.12);
}
.pmh-pin-panel {
  padding: 14px;
  border-radius: 18px;
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
}
.pmh-pin-panel div {
  min-width: 0;
  display: grid;
  gap: 5px;
}
.pmh-pin-panel b {
  color: #047857;
  font-size: 30px;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: .04em;
}
.pmh-pin-panel b.blurred {
  filter: blur(7px);
  user-select: none;
}
.pmh-pin-panel small {
  color: #047857;
  font-size: 12px;
  font-weight: 900;
}
.pmh-new-request {
  width: fit-content;
}
.pmh-pending-lock {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 22px;
  background: rgba(7,17,31,.72);
  backdrop-filter: blur(12px);
}
.pmh-pending-box {
  width: min(100%, 460px);
  padding: 26px;
  border-radius: 24px;
  background: #fff;
  border: 1px solid #dbe5ef;
  box-shadow: 0 30px 90px rgba(15,23,42,.3);
  text-align: center;
}
.pmh-pending-box.approved {
  width: min(100%, 520px);
}
.pmh-pending-box.pending-review {
  width: min(100%, 560px);
  padding: 0;
  overflow: hidden;
  border-radius: 28px;
  background: #fff;
  text-align: left;
}
.pmh-pending-box.recapture {
  width: min(100%, 620px);
  max-height: calc(100dvh - 36px);
  overflow: auto;
  text-align: left;
}
.pmh-pending-box.rejected {
  width: min(100%, 520px);
}
.pmh-pending-box > span {
  width: fit-content;
  margin: 0 auto 12px;
  padding: 8px 12px;
  border-radius: 999px;
  display: inline-flex;
  background: #07111f;
  color: #ffd400;
  font-size: 11px;
  font-weight: 1000;
  text-transform: uppercase;
}
.pmh-wait-card {
  display: grid;
  gap: 14px;
  padding: 18px;
}
.pmh-wait-head {
  min-height: 164px;
  padding: 22px;
  border-radius: 24px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px;
  gap: 18px;
  align-items: center;
  background:
    radial-gradient(circle at 92% 10%, rgba(255,212,0,.34), transparent 34%),
    linear-gradient(135deg, #07111f 0%, #10213a 100%);
  color: #fff;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
}
.pmh-wait-head span {
  width: fit-content;
  padding: 8px 12px;
  border-radius: 999px;
  display: inline-flex;
  background: #ffd400;
  color: #07111f;
  font-size: 11px;
  font-weight: 1000;
  text-transform: uppercase;
}
.pmh-wait-head h2 {
  margin: 14px 0 0;
  color: #fff;
  font-size: clamp(24px, 5.6vw, 34px);
  line-height: 1.02;
  font-weight: 1000;
  text-align: left;
  text-shadow: 0 2px 14px rgba(0,0,0,.34);
}
.pmh-wait-head p {
  margin: 10px 0 0;
  max-width: 360px;
  color: rgba(255,255,255,.88);
  font-size: 13px;
  line-height: 1.45;
  font-weight: 850;
  text-shadow: 0 1px 10px rgba(0,0,0,.28);
}
.pmh-wait-rings {
  position: relative;
  width: 86px;
  height: 86px;
  border-radius: 28px;
  display: grid;
  place-items: center;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.16);
}
.pmh-wait-rings i {
  position: absolute;
  border-radius: 999px;
}
.pmh-wait-rings i:nth-child(1) {
  width: 18px;
  height: 18px;
  background: #ffd400;
  box-shadow: 0 0 0 9px rgba(255,212,0,.14);
}
.pmh-wait-rings i:nth-child(2),
.pmh-wait-rings i:nth-child(3) {
  inset: 18px;
  border: 2px solid rgba(255,212,0,.62);
  animation: pmh-wait-pulse 1.8s ease-out infinite;
}
.pmh-wait-rings i:nth-child(3) {
  animation-delay: .6s;
}
.pmh-wait-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.pmh-wait-step {
  min-width: 0;
  padding: 12px 10px;
  border-radius: 18px;
  display: grid;
  justify-items: center;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #dbe5ef;
  color: #64748b;
  text-align: center;
}
.pmh-wait-step b {
  width: 30px;
  height: 30px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: #e2e8f0;
  color: #07111f;
  font-size: 12px;
  font-weight: 1000;
}
.pmh-wait-step span {
  font-size: 11px;
  line-height: 1.25;
  font-weight: 1000;
}
.pmh-wait-step.done,
.pmh-wait-step.active {
  background: #fffbea;
  border-color: rgba(255,212,0,.56);
  color: #07111f;
}
.pmh-wait-step.done b,
.pmh-wait-step.active b {
  background: #07111f;
  color: #ffd400;
}
.pmh-wait-step.active {
  box-shadow: 0 14px 34px rgba(255,212,0,.18);
}
.pmh-wait-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.pmh-wait-meta span,
.pmh-wait-note {
  min-width: 0;
  padding: 11px 12px;
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid #dbe5ef;
  color: #07111f;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 1000;
  text-align: center;
}
.pmh-wait-note {
  background: #ecfdf5;
  border-color: #bbf7d0;
  color: #047857;
}
@keyframes pmh-wait-pulse {
  0% {
    transform: scale(.72);
    opacity: .9;
  }
  100% {
    transform: scale(1.45);
    opacity: 0;
  }
}
.pmh-pending-box.recapture > span {
  margin-left: 0;
}
.pmh-pending-box h2 {
  margin: 0;
  color: #07111f;
  font-size: 24px;
  line-height: 1.08;
  font-weight: 1000;
  text-align: center;
}
.pmh-pending-box.pending-review .pmh-wait-head h2 {
  margin: 14px 0 0;
  color: #fff;
  font-size: clamp(24px, 5.6vw, 34px);
  line-height: 1.02;
  text-align: left;
}
.pmh-pending-box.recapture h2,
.pmh-pending-box.recapture .pmh-lock-message {
  text-align: left;
}
.pmh-lock-message {
  margin: 12px 0 0;
  padding: 12px;
  border-radius: 16px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 900;
}
.pmh-recapture-list {
  margin-top: 14px;
  display: grid;
  gap: 10px;
}
.pmh-recapture-row {
  padding: 12px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #dbe5ef;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: start;
}
.pmh-recapture-row .pmh-slot-actions,
.pmh-recapture-row .pmh-selected-preview {
  grid-column: 1 / -1;
}
.pmh-recapture-row input[type="file"] {
  display: none;
}
.pmh-selected-preview.compact img {
  max-height: 160px;
}
.pmh-lock-code {
  width: 100%;
  margin-top: 18px;
  padding: 18px;
  border-radius: 18px;
  display: block;
  background: #07111f;
  color: #ffd400;
  border: 1px solid rgba(255,212,0,.34);
  font-family: "Roboto Mono", "Cascadia Mono", "Consolas", monospace;
  font-size: clamp(26px, 6vw, 48px);
  line-height: 1.05;
  font-weight: 1000;
  letter-spacing: .08em;
  word-break: break-word;
  font-variant-numeric: tabular-nums slashed-zero;
  font-feature-settings: "zero" 1;
}
.pmh-lock-code.blurred {
  filter: blur(9px);
  user-select: none;
}
.pmh-pending-box small {
  display: block;
  margin-top: 10px;
  color: #64748b;
  font-size: 13px;
  font-weight: 900;
}
.pmh-pending-box button {
  min-height: 48px;
  margin-top: 16px;
  padding: 0 20px;
  border: 0;
  border-radius: 16px;
  background: #ffd400;
  color: #07111f;
  font-size: 13px;
  font-weight: 1000;
  cursor: pointer;
}
.pmh-progress-track {
  width: 100%;
  height: 14px;
  margin-top: 20px;
  overflow: hidden;
  border-radius: 999px;
  background: #e2e8f0;
}
.pmh-progress-track i {
  height: 100%;
  display: block;
  border-radius: inherit;
  background: #ffd400;
  transition: width .22s ease;
}
.pmh-lock-actions {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  gap: 10px;
}
.pmh-lock-actions button {
  flex: 1;
  margin-top: 0;
}
.pmh-lock-actions button.secondary {
  background: #f8fafc;
  color: #07111f;
  border: 1px solid #dbe5ef;
}
.pmh-pending-box.followup small {
  line-height: 1.45;
}
.pmh-preview-modal {
  position: fixed;
  inset: 0;
  z-index: 130;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(7,17,31,.78);
  backdrop-filter: blur(10px);
}
.pmh-preview-box {
  position: relative;
  width: min(100%, 720px);
  max-height: calc(100dvh - 36px);
  padding: 18px;
  border-radius: 24px;
  display: grid;
  gap: 14px;
  background: #fff;
  border: 1px solid #dbe5ef;
  box-shadow: 0 32px 90px rgba(15,23,42,.34);
}
.pmh-preview-head {
  display: grid;
  gap: 4px;
  padding-right: 54px;
}
.pmh-preview-head span {
  color: #475569;
  font-size: 11px;
  font-weight: 1000;
  text-transform: uppercase;
}
.pmh-preview-head b {
  color: #07111f;
  font-size: 18px;
  line-height: 1.15;
  font-weight: 1000;
}
.pmh-preview-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: #07111f;
  color: #ffd400;
  font-size: 16px;
  font-weight: 1000;
  cursor: pointer;
}
.pmh-preview-box img {
  width: 100%;
  max-height: 72dvh;
  border-radius: 18px;
  object-fit: contain;
  background: #f1f5f9;
  border: 1px solid #dbe5ef;
}
.pmh-preview-box audio {
  width: 100%;
}
.pmh-request-toast {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 120;
  max-width: min(92vw, 560px);
  padding: 13px 16px;
  border-radius: 999px;
  background: #07111f;
  color: #fff;
  box-shadow: 0 20px 64px rgba(15,23,42,.24);
  font-size: 13px;
  font-weight: 900;
}
@media (max-width: 980px) {
  .pmh-request-layout {
    grid-template-columns: 1fr;
  }
  .pmh-request-side {
    min-height: auto;
  }
}
@media (max-width: 720px) {
  .pincode-page {
    padding: 10px;
  }
  .pmh-topbar {
    border-radius: 22px;
  }
  .pmh-brand small {
    display: none;
  }
  .pmh-request-side,
  .pmh-request-main {
    border-radius: 24px;
  }
  .pmh-form-grid,
  .old-device-row {
    grid-template-columns: 1fr;
  }
  .pmh-pending-lock {
    padding: 10px;
  }
  .pmh-pending-box.pending-review {
    width: min(100%, 370px);
    border-radius: 24px;
  }
  .pmh-wait-card {
    padding: 12px;
    gap: 10px;
  }
  .pmh-wait-head {
    min-height: 154px;
    padding: 18px;
    grid-template-columns: 1fr 62px;
    gap: 10px;
    border-radius: 20px;
  }
  .pmh-wait-head h2 {
    margin-top: 12px;
    font-size: 24px;
  }
  .pmh-wait-head p {
    font-size: 12px;
  }
  .pmh-wait-rings {
    width: 58px;
    height: 58px;
    border-radius: 20px;
  }
  .pmh-wait-rings i:nth-child(1) {
    width: 14px;
    height: 14px;
  }
  .pmh-wait-rings i:nth-child(2),
  .pmh-wait-rings i:nth-child(3) {
    inset: 13px;
  }
  .pmh-wait-steps,
  .pmh-wait-meta {
    gap: 6px;
  }
  .pmh-wait-step {
    padding: 10px 6px;
    border-radius: 16px;
  }
  .pmh-wait-step span,
  .pmh-wait-meta span,
  .pmh-wait-note {
    font-size: 10px;
  }
  .pmh-wait-note {
    padding: 10px;
  }
  .pmh-pending-box.recapture {
    width: min(100%, 360px);
    max-height: calc(100dvh - 20px);
    padding: 18px;
    border-radius: 22px;
    overflow-x: hidden;
  }
  .pmh-pending-box.recapture h2 {
    font-size: 20px;
    line-height: 1.12;
  }
  .pmh-pending-box.recapture > small {
    font-size: 12px;
    line-height: 1.35;
  }
  .pmh-recapture-list {
    gap: 8px;
  }
  .pmh-recapture-row {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px;
    padding: 10px;
    border-radius: 16px;
  }
  .pmh-recapture-row .pmh-image-copy {
    min-width: 0;
  }
  .pmh-recapture-row .pmh-image-copy b {
    font-size: 12px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .pmh-recapture-row .pmh-slot-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .pmh-recapture-row .pmh-slot-picker {
    min-height: 42px;
    padding: 0 8px;
    justify-content: center;
    text-align: center;
    font-size: 11px;
  }
  .pmh-selected-preview.compact img {
    max-height: 130px;
  }
  .pmh-pending-box.recapture > button {
    width: 100%;
  }
  .pmh-lock-actions {
    flex-direction: column;
  }
  .pmh-image-row {
    grid-template-columns: 38px minmax(0, 1fr);
  }
  .pmh-image-index {
    width: 38px;
    height: 38px;
  }
  .pmh-sample-button,
  .pmh-audio-sample,
  .pmh-selected-preview {
    width: 100%;
    height: 150px;
    grid-column: 1 / -1;
  }
  .pmh-image-row.audio {
    grid-template-columns: 38px minmax(0, 1fr);
  }
  .pmh-slot-actions {
    grid-column: 1 / -1;
  }
  .pmh-preview-modal {
    padding: 10px;
  }
  .pmh-preview-box {
    max-height: calc(100dvh - 20px);
    padding: 14px;
    border-radius: 20px;
  }
  .pmh-preview-box img {
    max-height: 68dvh;
    border-radius: 16px;
  }
  .pmh-pin-panel {
    align-items: stretch;
    flex-direction: column;
  }
}
`;
