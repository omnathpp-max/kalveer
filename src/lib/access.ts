import type { AppRole, PermissionKey } from "@/lib/permissions";

export interface AccessRule {
  anyRole?: AppRole[];
  anyPermission?: PermissionKey[];
}

export const MODULE_ACCESS = {
  dashboard: {} as AccessRule,
  payment_requests: {} as AccessRule, // everyone signed in can view; raise/approve/pay gated in-page
  my_petty_cash: {} as AccessRule, // every user has their own wallet
  petty_cash_wallets: {
    anyRole: ["admin", "accounts_admin"],
    anyPermission: ["manage_petty_cash_wallets"],
  },
  inventory: {} as AccessRule,
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
