export const PERMISSION_KEYS = [
  "raise_request",
  "approve_request",
  "process_payment",
  "manage_petty_cash_wallets",
  "manage_diesel_entries",
  "approve_diesel_report",
  "view_reports",
  "export_reports",
  "manage_users",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  raise_request: "Raise payment request",
  approve_request: "Approve payment request",
  process_payment: "Process payment",
  manage_petty_cash_wallets: "Manage other users' petty cash wallets",
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
