import { useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  Fuel,
  FileBarChart,
  Users,
  Settings,
  ShieldCheck,
  Menu,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/permissions";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/petty-cash", label: "Petty Cash", icon: Wallet },
  { to: "/payment-requirements", label: "Payment Requirements", icon: Receipt },
  { to: "/diesel", label: "Diesel", icon: Fuel },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/users", label: "Users & Permissions", icon: Users, superAdminOnly: true },
  { to: "/audit-logs", label: "Audit Logs", icon: ShieldCheck, adminOnly: true },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, roles, signOut, isAnyAdmin, hasRole } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const primaryRole = roles[0] ?? "worker";

  const items = NAV.filter((item) => {
    if (item.superAdminOnly) return hasRole("super_admin");
    if (item.adminOnly) return isAnyAdmin;
    return true;
  });

  const Sidebar = (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <div className="text-sm font-semibold tracking-tight">Kalveer Quarry</div>
          <div className="text-xs text-muted-foreground">Operations</div>
        </div>
        <button
          className="rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {items.map((item) => {
          const active =
            location.pathname === item.to || location.pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="mb-2 px-2">
          <div className="truncate text-sm font-medium">{profile?.full_name || "User"}</div>
          <div className="truncate text-xs text-muted-foreground">
            {ROLE_LABELS[primaryRole]}
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={() => signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden md:block">{Sidebar}</div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">{Sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-background px-4 md:px-6">
          <button
            className="rounded-md p-2 hover:bg-accent md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-sm font-medium md:hidden">Kalveer Quarry</div>
          <div className="hidden text-xs text-muted-foreground md:block">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            {profile?.full_name}
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
