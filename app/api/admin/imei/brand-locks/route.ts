import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { imeiAccess, ImeiError } from "@/lib/imei";
import { getImeiBrandLocks, writeImeiBrandLocks } from "@/lib/imei-brand-lock-store";
import { isSameOriginRequest } from "@/lib/request-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
function failure(error: unknown) {
  return json({ success: false, code: error instanceof ImeiError ? error.code : "IMEI_LOCKS_UNAVAILABLE", message: error instanceof ImeiError ? error.message : "Chưa đọc hoặc lưu được tình trạng khóa hãng. Xin thử lại." }, error instanceof ImeiError ? error.status : 503);
}
export async function GET(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req);
  if (response) return response;
  const access = imeiAccess(admin!);
  if (!access.canView) return json({ success: false, message: "Bạn chưa được cấp quyền xem sổ mã." }, 403);
  try { return json({ success: true, policy: await getImeiBrandLocks(), access }); }
  catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req);
  if (response) return response;
  if (!isSameOriginRequest(req)) return json({ success: false, message: "Yêu cầu chưa đúng nguồn." }, 403);
  if (!imeiAccess(admin!).canManageBrandLocks) return json({ success: false, message: "Bạn chưa được cấp quyền Khóa tạo IMEI máy cũ theo hãng." }, 403);
  try {
    const raw = await req.text();
    if (raw.length > 2048) throw new ImeiError("Yêu cầu quá dài.", 413);
    let input;
    try { input = JSON.parse(raw); } catch { throw new ImeiError("Yêu cầu chưa đúng dạng."); }
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ImeiError("Yêu cầu chưa đúng dạng.");
    return json({ success: true, policy: await writeImeiBrandLocks(input, admin!.maNV), message: "Đã lưu tình trạng khóa hãng." });
  } catch (error) { return failure(error); }
}
