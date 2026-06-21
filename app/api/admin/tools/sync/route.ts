import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { ensureAutoBackupScheduler, getAutoBackupStatus } from "@/lib/auto-backup";
import { appendAdminAudit } from "@/lib/system-store";
import {
  exportSyncTarget,
  getDataQualityReport,
  getSyncSummary,
  importSyncCsv,
  previewSyncCsv,
} from "@/lib/data-sync-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADMIN_ONLY_EXPORT_TARGETS = new Set(["staff", "system_settings", "admin_audit", "backup"]);
const ADMIN_ONLY_IMPORT_TARGETS = new Set(["staff"]);

function noStoreHeaders(extra?: HeadersInit) {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    ...(extra || {}),
  };
}

export async function GET(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req, { action: "tools-report" });
  if (response) return response;
  ensureAutoBackupScheduler();

  try {
    const target = String(req.nextUrl.searchParams.get("target") || "summary").trim();

    if (target === "summary") {
      const summary = await getSyncSummary();
      return NextResponse.json(
        {
          success: true,
          summary,
        },
        { headers: noStoreHeaders() }
      );
    }

    if (target === "quality") {
      if (admin?.permission !== "admin") {
        return NextResponse.json(
          { success: false, message: "Chỉ Admin được kiểm tra chất lượng dữ liệu tổng." },
          { status: 403, headers: noStoreHeaders() }
        );
      }

      const quality = await getDataQualityReport();
      return NextResponse.json(
        {
          success: true,
          quality,
        },
        { headers: noStoreHeaders() }
      );
    }

    if (target === "backup-status") {
      if (admin?.permission !== "admin") {
        return NextResponse.json(
          { success: false, message: "Chỉ Admin được xem trạng thái backup tự động." },
          { status: 403, headers: noStoreHeaders() }
        );
      }

      const backup = await getAutoBackupStatus();
      return NextResponse.json(
        {
          success: true,
          backup,
        },
        { headers: noStoreHeaders() }
      );
    }

    if (ADMIN_ONLY_EXPORT_TARGETS.has(target) && admin?.permission !== "admin") {
      return NextResponse.json(
        { success: false, message: "Chỉ Admin được xuất dữ liệu nhạy cảm." },
        { status: 403, headers: noStoreHeaders() }
      );
    }

    const exported = await exportSyncTarget(target);

    return new NextResponse(exported.body, {
      status: 200,
      headers: noStoreHeaders({
        "Content-Type": exported.contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(exported.fileName)}"`,
      }),
    });
  } catch (err: any) {
    console.error("ADMIN_SYNC_EXPORT_ERROR:", err?.message || err);
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Không xử lý được dữ liệu đồng bộ.",
      },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}

export async function POST(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req, { action: "tools-report" });
  if (response) return response;
  ensureAutoBackupScheduler();

  try {
    const form = await req.formData();
    const target = String(form.get("target") || "").trim();
    const file = form.get("file");
    const preview = String(form.get("preview") || "") === "1";

    if (ADMIN_ONLY_IMPORT_TARGETS.has(target) && admin?.permission !== "admin") {
      return NextResponse.json(
        { success: false, message: "Chỉ Admin được import dữ liệu nhân viên." },
        { status: 403, headers: noStoreHeaders() }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Chưa chọn file CSV." },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const csvText = await file.text();

    if (preview) {
      const result = await previewSyncCsv(target, csvText);
      return NextResponse.json(
        {
          success: true,
          preview: result,
        },
        { headers: noStoreHeaders() }
      );
    }

    const result = await importSyncCsv(target, csvText);

    await appendAdminAudit({
      admin: admin?.name || admin?.maNV || "Admin",
      action: "DATA_SYNC_IMPORT",
      target,
      newValue: JSON.stringify(result),
      note: file.name,
    });

    return NextResponse.json(
      {
        success: true,
        result,
        message: `Đã import ${result.imported || 0} dòng.`,
      },
      { headers: noStoreHeaders() }
    );
  } catch (err: any) {
    console.error("ADMIN_SYNC_IMPORT_ERROR:", err?.message || err);
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Không import được dữ liệu.",
      },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
