export const PERMISSION_KEYS = [
  "raise_petty_cash_request",
  "add_petty_cash_ledger",
  "approve_petty_cash",
  "process_petty_cash_payment",
  "raise_payment_requirement",
  "approve_payment_requirement",
  "process_payment_requirement",
  "manage_diesel_entries",
  "approve_diesel_report",
  "view_reports",
  "export_reports",
  "manage_users",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  raise_petty_cash_request: "Raise petty cash request",
  add_petty_cash_ledger: "Add petty cash ledger entry",
  approve_petty_cash: "Approve petty cash",
  process_petty_cash_payment: "Process petty cash payment",
  raise_payment_requirement: "Raise payment requirement",
  approve_payment_requirement: "Approve payment requirement",
  process_payment_requirement: "Process payment requirement",
  manage_diesel_entries: "Manage diesel entries",
  approve_diesel_report: "Approve diesel report",
  view_reports: "View reports",
  export_reports: "Export reports",
  manage_users: "Manage users",
};

export type AppRole = "super_admin" | "admin" | "accounts_admin" | "worker";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin / Owner",
  admin: "Admin / Manager",
  accounts_admin: "Accounts Admin",
  worker: "Worker / Staff",
};

export const ROLE_ORDER: AppRole[] = ["super_admin", "admin", "accounts_admin", "worker"];
