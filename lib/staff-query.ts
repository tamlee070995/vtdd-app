// PostgREST values inside logical filters must be quoted and escaped.
export function quoteStaffFilter(value: unknown) { return JSON.stringify(String(value)); }

export function staffRoleFilters(role: string): Record<string, string> {
  if (role === "admin") return { permission: "imatch.^\\s*admin\\s*$" };
  if (role === "mod") return { permission: "imatch.^\\s*(mod|moderator)\\s*$" };
  if (role === "user") return { or: `(permission.is.null,permission.not.imatch.${quoteStaffFilter("^\\s*(admin|mod|moderator)\\s*$")})` };
  return {};
}

export const STAFF_DIRECTORY_COLUMNS = "ma_nv,staff_name,ma_st,store_name,department,status,reset_otp_count,need_setup,gmail,permission,module_permissions,source_row";
