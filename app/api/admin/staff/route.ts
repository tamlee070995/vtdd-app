import { NextRequest, NextResponse } from "next/server";
import { adminHasAction, normalizeAdminAccess, requireAdminApi, type AdminActionKey } from "@/lib/admin-auth";
import {
  adminResetStaffOtpCount,
  adminResetStaffSecurity,
  ensureStaffAdminHeaders,
  findStaffByMaNV,
  getAdminStaffPage,
  updateStaffAdminAccess,
  updateStaffStatus,
} from "@/lib/staff-store";
import { hashPassword, normalizeCode } from "@/lib/staff-security";

export const dynamic = "force-dynamic";

function normalizePermission(value: any): "admin" | "mod" | "" {
  const v = String(value || "").trim().toLowerCase();
  if (v === "admin") return "admin";
  if (v === "mod" || v === "moderator") return "mod";
  return "";
}

async function isFullAdmin(admin: any) {
  if (normalizePermission(admin?.permission) === "admin") return true;

  // Chống lỗi cookie cũ: kiểm tra lại quyền Admin trực tiếp từ Google Sheet.
  const maNV = normalizeCode(admin?.maNV || "");
  if (!maNV) return false;

  try {
    const staff = await findStaffByMaNV(maNV);
    return normalizePermission(staff?.permission) === "admin";
  } catch {
    return false;
  }
}

function normalizeModules(value: any) {
  return normalizeAdminAccess(value);
}

function canRunAction(admin: any, action: AdminActionKey) {
  return adminHasAction(admin, action, "tcdm");
}

export async function GET(req: NextRequest) {
  const { response } = await requireAdminApi(req, { module: "tcdm", action: "staff-manage" });
  if (response) return response;

  try {
    await ensureStaffAdminHeaders();

    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 50);
    const status = url.searchParams.get("status") || "ALL";
    const q = url.searchParams.get("q") || "";

    const data = await getAdminStaffPage({ page, pageSize, status, q });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không tải được danh sách nhân viên." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req, { module: "tcdm" });
  if (response) return response;

  try {
    await ensureStaffAdminHeaders();

    const body = await req.json();
    const action = String(body.action || "").trim().toUpperCase();
    const maNV = normalizeCode(body.maNV);

    if (!maNV) {
      return NextResponse.json({ success: false, message: "Thiếu mã nhân viên." }, { status: 400 });
    }

    const target = await findStaffByMaNV(maNV);

    if (!target) {
      return NextResponse.json({ success: false, message: "Không tìm thấy nhân viên." }, { status: 404 });
    }

    if (action === "UPDATE_PERMISSION") {
      if (!(await isFullAdmin(admin))) {
        return NextResponse.json(
          { success: false, message: "Chỉ Admin mới được cấp/xóa quyền Admin hoặc Mod." },
          { status: 403 }
        );
      }

      const permission = normalizePermission(body.permission);
      const modules = permission === "mod" ? normalizeModules(body.modules) : "";

      await updateStaffAdminAccess(target.rowNumber, { permission, modules });

      const message =
        permission === "admin"
          ? `Đã cấp quyền Admin cho NV ${target.maNV}.`
          : permission === "mod"
            ? `Đã cấp quyền Mod cho NV ${target.maNV}. Hạng mục: ${modules || "chưa chọn"}.`
            : `Đã xóa quyền Admin/Mod của NV ${target.maNV}. Tài khoản trở về user thường.`;

      return NextResponse.json({ success: true, message });
    }

    if (action === "ACTIVE") {
      if (!canRunAction(admin, "staff-manage")) {
        return NextResponse.json({ success: false, message: "Không có quyền quản lý trạng thái nhân viên." }, { status: 403 });
      }

      await updateStaffStatus(target.rowNumber, "Active");
      return NextResponse.json({ success: true, message: `Đã Active tài khoản NV ${target.maNV}.` });
    }

    if (action === "STANDBY") {
      if (!canRunAction(admin, "staff-manage")) {
        return NextResponse.json({ success: false, message: "Không có quyền quản lý trạng thái nhân viên." }, { status: 403 });
      }

      await updateStaffStatus(target.rowNumber, "Standby");
      return NextResponse.json({ success: true, message: `Đã chuyển NV ${target.maNV} về Standby.` });
    }

    if (action === "RESET_SECURITY") {
      if (!(await isFullAdmin(admin)) && !canRunAction(admin, "staff-security")) {
        return NextResponse.json(
          { success: false, message: "Không có quyền reset bảo mật tài khoản." },
          { status: 403 }
        );
      }

      const defaultPassword = process.env.DEFAULT_STAFF_PASSWORD || "123123";
      const passwordHash = hashPassword(defaultPassword);
      await adminResetStaffSecurity(target.rowNumber, { passwordHash });

      return NextResponse.json({
        success: true,
        message: `Đã reset bảo mật NV ${target.maNV}. Mật khẩu mặc định: ${defaultPassword}.`,
      });
    }

    if (action === "RESET_OTP_COUNT") {
      if (!canRunAction(admin, "staff-security")) {
        return NextResponse.json({ success: false, message: "Không có quyền reset OTP nhân viên." }, { status: 403 });
      }

      await adminResetStaffOtpCount(target.rowNumber);
      return NextResponse.json({ success: true, message: `Đã reset số lượt OTP của NV ${target.maNV}.` });
    }

    return NextResponse.json({ success: false, message: "Action không hợp lệ." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Không xử lý được yêu cầu nhân viên." },
      { status: 500 }
    );
  }
}
