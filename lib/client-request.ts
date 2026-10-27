export function clientErrorMessage(error: unknown, fallback = "Không thực hiện được thao tác.") {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "Mất kết nối mạng. Kiểm tra Wi-Fi hoặc dữ liệu di động rồi thử lại.";
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") return "Kết nối mất quá lâu. Vui lòng kiểm tra trạng thái rồi thử lại.";
    if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) return "Không kết nối được máy chủ. Vui lòng kiểm tra mạng rồi thử lại.";
    return error.message || fallback;
  }
  return fallback;
}

export async function requestJson<T extends { success?: boolean; message?: string }>(url: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", ...init, signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (data?.code === "STAFF_SETUP_REQUIRED" && typeof window !== "undefined") {
      window.location.assign("/admin/setup");
      throw new Error(data.message || "Vui lòng cập nhật thông tin bảo mật.");
    }
    if (!response.ok || !data?.success) throw new Error(data?.message || (response.status === 401 ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." : "Máy chủ chưa trả về kết quả. Vui lòng thử lại."));
    return data as T;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", abort);
  }
}
