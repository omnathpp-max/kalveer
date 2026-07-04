import type { AppRole, PermissionKey } from "@/lib/permissions";

/**
 * Central access rules. A user can access a module if they:
 *  - are a super_admin (always), OR
 *  - hold one of the listed `anyRole` roles, OR
 *  - hold one of the listed `anyPermission` permissions.
 *
 * Workers get NOTHING by default beyond the dashboard/profile.
 * Anything they should access must be granted via permissions.
 */
export interface AccessRule {
  anyRole?: AppRole[];
  anyPermission?: PermissionKey[];
}

export const MODULE_ACCESS = {
  dashboard: {} as AccessRule, // everyone signed in
  petty_cash: {
    anyRole: ["admin", "accounts_admin"],
    anyPermission: [
      "raise_petty_cash_request",
      "add_petty_cash_ledger",
      "approve_petty_cash",
      "process_petty_cash_payment",
    ],
  },
  payment_requirements: {
    anyRole: ["admin", "accounts_admin"],
    anyPermission: [
      "raise_payment_requirement",
      "approve_payment_requirement",
      "process_payment_requirement",
    ],
  },
  diesel: {
    anyRole: ["admin", "accounts_admin"],
    anyPermission: ["manage_diesel_entries", "approve_diesel_report"],
  },
  reports: {
    anyRole: ["admin", "accounts_admin"],
    anyPermission: ["view_reports", "export_reports"],
  },
  users: { anyRole: [] }, // super_admin only
  audit_logs: { anyRole: ["admin", "accounts_admin"] },
  settings: { anyRole: [] }, // super_admin only
} as const satisfies Record<string, AccessRule>;

export type ModuleKey = keyof typeof MODULE_ACCESS;

export function canAccess(
  rule: AccessRule,
  ctx: { roles: AppRole[]; permissions: PermissionKey[] },
): boolean {
  if (ctx.roles.includes("super_admin")) return true;
  if (rule.anyRole && rule.anyRole.some((r) => ctx.roles.includes(r))) return true;
  if (rule.anyPermission && rule.anyPermission.some((p) => ctx.permissions.includes(p)))
    return true;
  return false;
}
