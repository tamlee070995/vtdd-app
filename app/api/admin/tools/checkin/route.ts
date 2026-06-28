import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { appendAdminAudit } from "@/lib/system-store";
import {
  CHECKIN_TABLE_MISSING_MESSAGE,
  exportCheckinCsv,
  getCheckinDashboard,
  importCheckinCustomers,
  isCheckinTableMissingError,
  normalizeCheckinErrorMessage,
  setCustomerCheckin,
} from "@/lib/checkin-store";

export const dynamic = "force-dynamic";

function noStoreHeaders(extra?: HeadersInit) {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    ...(extra || {}),
  };
}

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("forwarded") || "";
  const forwardedFor = forwarded.match(/for="?([^;,"]+)/i)?.[1] || "";

  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("true-client-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-client-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    forwardedFor ||
    ""
  );
}

export async function GET(req: NextRequest) {
  const { response } = await requireAdminApi(req, { action: "tools-checkin" });
  if (response) return response;

  try {
    if (req.nextUrl.searchParams.get("export") === "csv") {
      const exported = await exportCheckinCsv();
      return new NextResponse(exported.body, {
        status: 200,
        headers: noStoreHeaders({
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(exported.fileName)}"`,
        }),
      });
    }

    const result = await getCheckinDashboard();
    return NextResponse.json(
      {
        success: true,
        ...result,
        message: result.tableMissing && result.rows.length === 0 ? CHECKIN_TABLE_MISSING_MESSAGE : "",
      },
      { headers: noStoreHeaders() }
    );
  } catch (err: any) {
    console.error("ADMIN_CHECKIN_GET_ERROR:", err?.message || err);
    if (isCheckinTableMissingError(err)) {
      return NextResponse.json(
        {
          success: true,
          rows: [],
          dashboard: {
            total: 0,
            checkedIn: 0,
            waiting: 0,
            firstCheckin: "",
            latestCheckin: "",
          },
          message: normalizeCheckinErrorMessage(err, "Chưa có dữ liệu Check-in."),
        },
        { headers: noStoreHeaders() }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: normalizeCheckinErrorMessage(err, "Không tải được dashboard Check-in."),
      },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}

export async function POST(req: NextRequest) {
  const { admin, response } = await requireAdminApi(req, { action: "tools-checkin" });
  if (response) return response;

  try {
    const contentType = req.headers.get("content-type") || "";
    const adminName = admin?.name || admin?.maNV || "Admin";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const replace = String(form.get("replace") || "") === "1";

      if (!(file instanceof File)) {
        return NextResponse.json(
          { success: false, message: "Chưa chọn file CSV Check-in." },
          { status: 400, headers: noStoreHeaders() }
        );
      }

      const csvText = await file.text();
      const result = await importCheckinCustomers(csvText, { replace });

      try {
        await appendAdminAudit({
          admin: adminName,
          action: "CHECKIN_IMPORT",
          target: "checkin_customers",
          newValue: JSON.stringify(result),
          ip: getClientIp(req),
          note: file.name,
        });
      } catch (auditError: any) {
        console.warn("CHECKIN_IMPORT_AUDIT_ERROR:", auditError?.message || auditError);
      }

      return NextResponse.json(
        {
          success: true,
          result,
          message:
            result.storage === "settings"
              ? `Đã import ${result.imported} khách hàng vào kho dự phòng. Nên chạy SQL tạo bảng checkin_customers sau.`
              : `Đã import ${result.imported} khách hàng.`,
        },
        { headers: noStoreHeaders() }
      );
    }

    const body = await req.json().catch(() => null);
    const action = String(body?.action || "").trim();

    if (action === "TOGGLE_CHECKIN") {
      const customer = await setCustomerCheckin(String(body?.id || ""), Boolean(body?.checkedIn));

      try {
        await appendAdminAudit({
          admin: adminName,
          action: Boolean(body?.checkedIn) ? "CHECKIN_CUSTOMER" : "CHECKIN_UNDO",
          target: customer.sdt || customer.maSO || customer.id,
          newValue: JSON.stringify(customer),
          ip: getClientIp(req),
        });
      } catch (auditError: any) {
        console.warn("CHECKIN_TOGGLE_AUDIT_ERROR:", auditError?.message || auditError);
      }

      return NextResponse.json(
        {
          success: true,
          customer,
          message: Boolean(body?.checkedIn) ? "Đã check-in khách hàng." : "Đã bỏ check-in khách hàng.",
        },
        { headers: noStoreHeaders() }
      );
    }

    return NextResponse.json(
      { success: false, message: "Thao tác Check-in không hợp lệ." },
      { status: 400, headers: noStoreHeaders() }
    );
  } catch (err: any) {
    console.error("ADMIN_CHECKIN_POST_ERROR:", err?.message || err);
    return NextResponse.json(
      {
        success: false,
        message: normalizeCheckinErrorMessage(err, "Không xử lý được dữ liệu Check-in."),
      },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
