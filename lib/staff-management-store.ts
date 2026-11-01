import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { deleteRows, insertRows, isSupabaseConfigured, selectAllRows, selectRows } from "./supabase-rest";
import { hashPassword, normalizeText } from "./staff-security";
import { validateNewStaffRows } from "./staff-import";
import { quoteStaffFilter } from "./staff-query";

export class StaffManagementError extends Error { constructor(message: string, public status = 400) { super(message); } }
export type StaffRole = "admin" | "mod" | "user";
type ManagedRow = { ma_nv: string; staff_name: string; permission: string | null; status: string | null; source_row: string | number | null };
export function staffRole(value: unknown): StaffRole { const role = String(value || "").trim().toLowerCase(); return role === "admin" ? "admin" : role === "mod" || role === "moderator" ? "mod" : "user"; }
function storage() { if (!isSupabaseConfigured()) throw new StaffManagementError("Chức năng này cần kết nối cơ sở dữ liệu Supabase.", 503); }
async function rows() { storage(); return selectAllRows<ManagedRow>("staff", { select: "ma_nv,staff_name,permission,status,source_row", order: "ma_nv.asc" }); }
export async function createManagedStaff(input: unknown, password: unknown, status: unknown) {
  storage();
  let entries;
  try { entries = validateNewStaffRows(input); } catch (error) { throw new StaffManagementError((error as Error).message); }
  if (typeof password !== "string" || normalizeText(password).length < 6 || password.length > 128) throw new StaffManagementError("Mật khẩu tạm cần từ 6 đến 128 ký tự.");
  if (status !== "Active" && status !== "Standby") throw new StaffManagementError("Xin chọn Active hoặc Standby.");
  const existing = new Set((await selectRows<{ma_nv:string}>("staff", {select:"ma_nv",filters:{ma_nv:`in.(${entries.map(row=>row.maNV).join(",")})`}})).map(row => row.ma_nv));
  const skipped = entries.filter(row => existing.has(row.maNV)).map(row => row.maNV);
  const fresh = entries.filter(row => !existing.has(row.maNV));
  const base = Date.now();
  const records = fresh.map((row, index) => ({ ma_nv: row.maNV, staff_name: row.staffName, ma_st: row.maST, store_name: "", department: "", password_hash: hashPassword(normalizeText(password)), security_question: "", security_answer: "", gmail: "", status, need_setup: "1", permission: "", module_permissions: "", reset_otp_hash: "", reset_otp_expires: "", reset_otp_day: "", reset_otp_count: "0", source_row: String(base + index) }));
  try { await insertRows("staff", records, { returning: "minimal" }); }
  catch (error) { if (/23505|duplicate/i.test(String(error))) throw new StaffManagementError("Có mã vừa được thêm ở phiên khác. Xin tải lại danh sách trước khi thử lại.", 409); throw error; }
  return { created: fresh.map(row => row.maNV), skipped };
}
function normalizeRoles(input: unknown): StaffRole[] {
  if (!Array.isArray(input) || !input.length || input.some(role => !["admin", "mod", "user"].includes(role))) throw new StaffManagementError("Xin chọn nhóm Admin, Mod hoặc Nhân viên.");
  return [...new Set(input)] as StaffRole[];
}
function candidates(all: ManagedRow[], roles: StaffRole[], actor: string) { return all.filter(row => roles.includes(staffRole(row.permission)) && row.ma_nv !== actor).sort((a,b) => a.ma_nv.localeCompare(b.ma_nv)); }
function digest(list: ManagedRow[]) { return createHash("sha256").update(JSON.stringify(list)).digest("hex"); }
function sign(body: string) {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.AUTH_SECRET || process.env.SESSION_SECRET || process.env.FIELD_ENCRYPTION_KEY || "";
  if (secret.length < 16) throw new StaffManagementError("Chưa có khóa xác nhận thao tác quản trị.", 503);
  return createHmac("sha256", secret).update("staff-delete-preview:v1:" + body).digest("base64url");
}
export async function previewStaffDeletion(input: unknown, actor: string) {
  const roles = normalizeRoles(input), all = await rows();
  const selected = candidates(all, roles, actor);
  if (selected.length > 30_000) throw new StaffManagementError("Mỗi lần xem trước tối đa 30 ngàn tài khoản. Xin chọn từng nhóm quyền.");
  const expiresAt = Date.now() + 10 * 60_000;
  const body = Buffer.from(JSON.stringify({ purpose: "delete-staff", actor, roles, digest: digest(selected), expiresAt })).toString("base64url");
  return { token: body + "." + sign(body), expiresAt, count: selected.length, skippedSelf: all.some(row => row.ma_nv === actor && roles.includes(staffRole(row.permission))), staff: selected.map(row => ({ maNV: row.ma_nv, staffName: row.staff_name, role: staffRole(row.permission), status: row.status })) };
}
export async function deletePreviewedStaff(token: unknown, actor: string) {
  if (typeof token !== "string" || token.length > 4096) throw new StaffManagementError("Xin xem trước danh sách cần xóa.");
  const [body, signature, extra] = token.split(".");
  const expected = sign(body || ""), supplied = signature || "";
  if (extra || expected.length !== supplied.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) throw new StaffManagementError("Phiếu xác nhận chưa hợp lệ. Xin xem trước lại.");
  let payload;
  try { payload = JSON.parse(Buffer.from(body,"base64url").toString("utf8")); } catch { throw new StaffManagementError("Phiếu xác nhận chưa hợp lệ."); }
  if (payload.purpose !== "delete-staff" || payload.actor !== actor || !Number.isFinite(payload.expiresAt) || Date.now() > payload.expiresAt) throw new StaffManagementError("Phiếu xác nhận đã hết hạn hoặc không thuộc tài khoản này. Xin xem trước lại.", 409);
  const roles = normalizeRoles(payload.roles), selected = candidates(await rows(), roles, actor);
  if (selected.length > 30_000 || digest(selected) !== payload.digest) throw new StaffManagementError("Danh sách đã đổi. Xin xem trước lại trước khi xóa.", 409);
  const deleted: string[] = [], skipped: string[] = [], failed: string[] = [];
  const startedAt = Date.now();
  for (let offset = 0; offset < selected.length; offset += 200) {
    // Bound concurrent requests and leave time to return partial results before the function expires.
    if (Date.now() - startedAt > 40_000) break;
    const batch = selected.slice(offset, offset + 200);
    const groups = Array.from({length:Math.ceil(batch.length/25)},(_,index)=>batch.slice(index*25,index*25+25));
    await Promise.all(groups.map(async group => {
      try {
        const clauses = group.map(row => "and(" + ["ma_nv","permission","source_row","status"].map(key => {
          const value = row[key as keyof ManagedRow];
          return value == null ? `${key}.is.null` : `${key}.eq.${quoteStaffFilter(value)}`;
        }).join(",") + ")");
        const changed = await deleteRows<{ma_nv:string}>("staff", {or:`(${clauses.join(",")})`,select:"ma_nv"}, {returning:"representation"});
        const codes = new Set((changed || []).map(row=>row.ma_nv));
        group.forEach(row=>(codes.has(row.ma_nv)?deleted:skipped).push(row.ma_nv));
      } catch { failed.push(...group.map(row=>row.ma_nv)); }
    }));
    if (failed.length) break;
  }
  const processed = new Set([...deleted,...skipped,...failed]);
  return { deleted, skipped, failed, unprocessed: selected.filter(row => !processed.has(row.ma_nv)).map(row => row.ma_nv) };
}
