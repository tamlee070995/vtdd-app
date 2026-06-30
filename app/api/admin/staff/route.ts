import { NextRequest, NextResponse } from "next/server";
import { adminHasAction, normalizeAdminAccess, requireAdminApi, type AdminActionKey } from "@/lib/admin-auth";
import {
  adminResetStaffOtpCount,
  adminResetStaffSecurity,
  bulkStandbyStaffByPermission,
  deleteStaffAccount,
  ensureStaffAdminHeaders,
  findStaffByMaNV,
  getAdminStaffPage,
  standbyStaffByCodes,
  updateStaffAdminAccess,
  updateStaffCheckinToolAccess,
  updateStaffStatus,
} from "@/lib/staff-store";
import { decryptText, hashPassword, normalizeCode, verifyPassword } from "@/lib/staff-security";
import { getPublicMailError, sendStaffActivatedMail, sendStaffDeletedMail } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  return adminHasAction(admin, action, "people");
}

function denyModTouchingAdmin(admin: any, target: any) {
  const actorPermission = normalizePermission(admin?.permission);
  const targetPermission = normalizePermission(target?.permission);

  if (actorPermission === "admin" || targetPermission !== "admin") return null;

  return NextResponse.json(
    { success: false, message: "Tài khoản Mod không được thao tác với tài khoản quyền Admin." },
    { status: 403 }
  );
}

function safeDecrypt(value: any) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const decrypted = decryptText(raw);
    if (decrypted) return decrypted;
    return raw.startsWith("enc:v1:") ? "" : raw;
  } catch {
    return raw.startsWith("enc:v1:") ? "" : raw;
  }
}

function maskEmail(email: string) {
  const [name, domain] = String(email || "").split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
}

function normalizeEmail(value: any) {
  const email = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^mailto:/i, "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

function getStaffNotificationEmail(staff: any) {
  const raw = safeDecrypt(staff?.gmail);
  return normalizeEmail(raw);
}

function getLoginUrl(req: NextRequest) {
  const baseUrl = String(process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/+$/, "");
  return `${baseUrl}/login`;
}

function normalizeImportStaffCode(value: any) {
  return normalizeCode(value)
    .replace(/^(NV|MA_NV|MA-NV)/i, "")
    .replace(/\D/g, "");
}

export async function GET(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req);
  if (response) return response;

  if (
    !canRunAction(admin, "staff-manage") &&
    !canRunAction(admin, "staff-security") &&
    !canRunAction(admin, "staff-delete")
  ) {
    return NextResponse.json({ success: false, message: "Không có quyền xem danh sách nhân viên." }, { status: 403 });
  }

  try {
    await ensureStaffAdminHeaders();

    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 50);
    const status = url.searchParams.get("status") || "ALL";
    const q = url.searchParams.get("q") || "";

    const data = await getAdminStaffPage({ page, pageSize, status, q });
    const query = String(q || "").trim().toLowerCase();
    const adminCode = normalizeCode(admin?.maNV || "");
    const statusAllowsCurrentAdmin = status === "ALL" || status === "Active";
    const currentAdminMatchesQuery =
      Boolean(adminCode) &&
      statusAllowsCurrentAdmin &&
      Boolean(query) &&
      [adminCode, admin?.name, admin?.permission]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);

    if (
      currentAdminMatchesQuery &&
      !data.staff.some((item: any) => normalizeCode(item.maNV) === adminCode)
    ) {
      data.staff.push({
        rowNumber: 0,
        maNV: adminCode,
        staffName: String(admin?.name || adminCode),
        maST: "",
        storeName: "",
        department: "",
        status: "Active",
        resetOtpCount: "0",
        needSetup: "0",
        gmail: "",
        permission: normalizePermission(admin?.permission),
        modulePermissions: normalizePermission(admin?.permission) === "admin" ? "ALL" : (admin?.modules || []).join(","),
      });

      data.staff.sort((a: any, b: any) => normalizeCode(a.maNV).localeCompare(normalizeCode(b.maNV), "vi"));
      data.meta.total = Number(data.meta.total || 0) + 1;
      data.meta.pages = Math.max(1, Math.ceil(Number(data.meta.total || 0) / Number(data.meta.pageSize || pageSize)));
    }

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    console.error("ADMIN_STAFF_LIST_ERROR:", err?.message || err);
    return NextResponse.json(
      { success: false, message: "Không tải được danh sách nhân viên." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req);
  if (response) return response;

  try {
    await ensureStaffAdminHeaders();

    const body = await req.json();
    const action = String(body.action || "").trim().toUpperCase();

    if (action === "STANDBY_BULK") {
      if (!(await isFullAdmin(admin))) {
        return NextResponse.json(
          { success: false, message: "Chỉ Admin mới được chuyển Standby hàng loạt." },
          { status: 403 }
        );
      }

      if (!canRunAction(admin, "staff-manage")) {
        return NextResponse.json({ success: false, message: "Không có quyền quản lý trạng thái nhân viên." }, { status: 403 });
      }

      const adminPassword = String(body.adminPassword || "").trim();
      if (!adminPassword) {
        return NextResponse.json(
          { success: false, message: "Vui lòng nhập mật khẩu Admin để xác nhận thao tác Standby hàng loạt." },
          { status: 400 }
        );
      }

      const adminCode = normalizeCode(admin?.maNV || "");
      const currentAdmin = adminCode ? await findStaffByMaNV(adminCode) : null;
      if (
        !currentAdmin ||
        normalizePermission(currentAdmin.permission) !== "admin" ||
        String(currentAdmin.status || "").trim().toLowerCase() !== "active"
      ) {
        return NextResponse.json(
          { success: false, message: "Tài khoản Admin hiện tại không còn hợp lệ. Vui lòng đăng nhập lại." },
          { status: 403 }
        );
      }

      if (!verifyPassword(adminPassword, currentAdmin.password)) {
        return NextResponse.json(
          { success: false, message: "Mật khẩu Admin không đúng. Vui lòng kiểm tra lại." },
          { status: 401 }
        );
      }

      const roles = Array.isArray(body.roles)
        ? body.roles
            .map((role: any) => String(role || "").trim().toLowerCase())
            .filter((role: string): role is "user" | "mod" => role === "user" || role === "mod")
        : [];

      if (roles.length === 0) {
        return NextResponse.json({ success: false, message: "Vui lòng chọn cấp bậc cần chuyển Standby." }, { status: 400 });
      }

      const result = await bulkStandbyStaffByPermission(roles);
      const labels = Array.from(new Set(roles))
        .map((role) => (role === "mod" ? "Mod" : "Nhân viên"))
        .join(", ");

      return NextResponse.json({
        success: true,
        updated: result.updated,
        message: `Đã chuyển Standby ${result.updated} tài khoản thuộc cấp bậc: ${labels}.`,
      });
    }

    if (action === "STANDBY_IMPORT") {
      if (!(await isFullAdmin(admin))) {
        return NextResponse.json(
          { success: false, message: "Chỉ Admin mới được import file Standby nhân viên." },
          { status: 403 }
        );
      }

      if (!canRunAction(admin, "staff-manage")) {
        return NextResponse.json({ success: false, message: "Không có quyền quản lý trạng thái nhân viên." }, { status: 403 });
      }

      const codes = Array.isArray(body.codes)
        ? body.codes
            .map(normalizeImportStaffCode)
            .filter(Boolean)
        : [];

      if (codes.length === 0) {
        return NextResponse.json({ success: false, message: "File import chưa có mã nhân viên hợp lệ." }, { status: 400 });
      }

      if (codes.length > 5000) {
        return NextResponse.json(
          { success: false, message: "Mỗi lần import tối đa 5.000 mã nhân viên." },
          { status: 400 }
        );
      }

      const result = await standbyStaffByCodes(codes);
      const detailParts = [
        `Đã chuyển Standby ${result.updated} tài khoản`,
        result.alreadyStandby.length ? `${result.alreadyStandby.length} tài khoản đã Standby sẵn` : "",
        result.skippedAdmin.length ? `${result.skippedAdmin.length} tài khoản Admin được bỏ qua` : "",
        result.missing.length ? `${result.missing.length} mã không tồn tại` : "",
        result.duplicates.length ? `${result.duplicates.length} dòng trùng trong file` : "",
      ].filter(Boolean);

      return NextResponse.json({
        success: true,
        result,
        message: `${detailParts.join(", ")}.`,
      });
    }

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

      await updateStaffAdminAccess(target.rowNumber, { maNV: target.maNV, permission, modules });

      const message =
        permission === "admin"
          ? `Đã cấp quyền Admin cho NV ${target.maNV}.`
          : permission === "mod"
            ? `Đã cấp quyền Mod cho NV ${target.maNV}. Hạng mục: ${modules || "chưa chọn"}.`
            : `Đã xóa quyền Admin/Mod của NV ${target.maNV}. Tài khoản trở về user thường.`;

      return NextResponse.json({ success: true, message });
    }

    if (action === "UPDATE_CHECKIN_ACCESS") {
      if (!(await isFullAdmin(admin))) {
        return NextResponse.json(
          { success: false, message: "Chỉ Admin mới được cấp hoặc thu hồi quyền Check-in." },
          { status: 403 }
        );
      }

      if (normalizePermission(target.permission) === "admin") {
        return NextResponse.json({
          success: true,
          message: `Tài khoản Admin ${target.maNV} mặc định có quyền truy cập Check-in.`,
        });
      }

      const enabled = Boolean(body.enabled);
      await updateStaffCheckinToolAccess(target.rowNumber, { maNV: target.maNV, enabled });

      return NextResponse.json({
        success: true,
        message: enabled
          ? `Đã cấp quyền Check-in cho NV ${target.maNV}.`
          : `Đã thu hồi quyền Check-in của NV ${target.maNV}.`,
      });
    }

    if (action === "ACTIVE") {
      if (!canRunAction(admin, "staff-manage")) {
        return NextResponse.json({ success: false, message: "Không có quyền quản lý trạng thái nhân viên." }, { status: 403 });
      }

      const guard = denyModTouchingAdmin(admin, target);
      if (guard) return guard;

      const wasAlreadyActive = String(target.status || "").trim().toLowerCase() === "active";

      await updateStaffStatus(target.rowNumber, "Active", target.maNV);

      const refreshedTarget = (await findStaffByMaNV(maNV)) || target;
      const gmail = getStaffNotificationEmail(refreshedTarget) || getStaffNotificationEmail(target);
      const staffName = refreshedTarget.staffName || target.staffName;

      if (!gmail) {
        return NextResponse.json({
          success: true,
          mailSent: false,
          message: `Đã Active tài khoản NV ${target.maNV}, nhưng tài khoản chưa có Gmail hợp lệ để gửi thông báo.`,
        });
      }

      try {
        await sendStaffActivatedMail({
          to: gmail,
          staffName,
          maNV: target.maNV,
          loginUrl: getLoginUrl(req),
        });

        return NextResponse.json({
          success: true,
          mailSent: true,
          message: wasAlreadyActive
            ? `Đã gửi lại Gmail thông báo Active cho NV ${target.maNV} đến ${maskEmail(gmail)}.`
            : `Đã Active tài khoản NV ${target.maNV} và gửi Gmail thông báo đến ${maskEmail(gmail)}.`,
        });
      } catch (mailErr: any) {
        console.error("SEND_STAFF_ACTIVATED_MAIL_ERROR:", {
          maNV: target.maNV,
          message: mailErr?.message || mailErr,
        });

        return NextResponse.json({
          success: true,
          mailSent: false,
          message: `Đã Active tài khoản NV ${target.maNV}, nhưng chưa gửi được Gmail thông báo. ${getPublicMailError(mailErr)}`,
        });
      }
    }

    if (action === "STANDBY") {
      if (!canRunAction(admin, "staff-manage")) {
        return NextResponse.json({ success: false, message: "Không có quyền quản lý trạng thái nhân viên." }, { status: 403 });
      }

      const guard = denyModTouchingAdmin(admin, target);
      if (guard) return guard;

      await updateStaffStatus(target.rowNumber, "Standby", target.maNV);
      return NextResponse.json({ success: true, message: `Đã chuyển NV ${target.maNV} về Standby.` });
    }

    if (action === "RESET_SECURITY") {
      if (!(await isFullAdmin(admin)) && !canRunAction(admin, "staff-security")) {
        return NextResponse.json(
          { success: false, message: "Không có quyền reset bảo mật tài khoản." },
          { status: 403 }
        );
      }

      const guard = denyModTouchingAdmin(admin, target);
      if (guard) return guard;

      const defaultPassword = process.env.DEFAULT_STAFF_PASSWORD || "123123";
      const passwordHash = hashPassword(defaultPassword);
      await adminResetStaffSecurity(target.rowNumber, { maNV: target.maNV, passwordHash });

      return NextResponse.json({
        success: true,
        message: `Đã reset bảo mật NV ${target.maNV}. Nhân viên cần đăng nhập và thiết lập lại bảo mật.`,
      });
    }

    if (action === "RESET_OTP_COUNT") {
      if (!canRunAction(admin, "staff-security") && !canRunAction(admin, "staff-manage")) {
        return NextResponse.json({ success: false, message: "Không có quyền reset OTP nhân viên." }, { status: 403 });
      }

      await adminResetStaffOtpCount(target.rowNumber, target.maNV);
      return NextResponse.json({ success: true, message: `Đã reset số lượt OTP của NV ${target.maNV}.` });
    }

    if (action === "DELETE") {
      if (!canRunAction(admin, "staff-delete")) {
        return NextResponse.json({ success: false, message: "Không có quyền xóa nhân viên." }, { status: 403 });
      }

      const guard = denyModTouchingAdmin(admin, target);
      if (guard) return guard;

      if (normalizeCode(admin?.maNV || "") === target.maNV) {
        return NextResponse.json(
          { success: false, message: "Không thể xóa chính tài khoản đang đăng nhập." },
          { status: 400 }
        );
      }

      const notifyDeleteStaff = Boolean(body.notifyDeleteStaff);
      const deleteMailTitle =
        String(body.deleteMailTitle || "").trim() || "Thông báo tài khoản đã bị xóa";
      const deleteMailMessage =
        String(body.deleteMailMessage || "").trim() ||
        "Tài khoản của bạn đã được Admin xóa khỏi hệ thống. Nếu cần hỗ trợ, vui lòng liên hệ quản trị viên.";
      let mailResultMessage = "";

      if (notifyDeleteStaff) {
        const gmail = getStaffNotificationEmail(target);

        if (!gmail) {
          mailResultMessage = " Tài khoản chưa có Gmail hợp lệ nên không gửi được mail thông báo.";
        } else {
          try {
            await sendStaffDeletedMail({
              to: gmail,
              staffName: target.staffName,
              maNV: target.maNV,
              title: deleteMailTitle,
              message: deleteMailMessage,
            });
            mailResultMessage = ` Đã gửi mail thông báo đến ${maskEmail(gmail)}.`;
          } catch (mailErr: any) {
            console.error("SEND_STAFF_DELETED_MAIL_ERROR:", {
              maNV: target.maNV,
              message: mailErr?.message || mailErr,
            });
            mailResultMessage = ` Chưa gửi được mail thông báo. ${getPublicMailError(mailErr)}`;
          }
        }
      }

      await deleteStaffAccount(target.rowNumber, target.maNV);
      return NextResponse.json({ success: true, message: `Đã xóa tài khoản NV ${target.maNV}.${mailResultMessage}` });
    }

    return NextResponse.json({ success: false, message: "Action không hợp lệ." }, { status: 400 });
  } catch (err: any) {
    console.error("ADMIN_STAFF_ACTION_ERROR:", err?.message || err);
    return NextResponse.json(
      { success: false, message: "Không xử lý được yêu cầu nhân viên." },
      { status: 500 }
    );
  }
}
