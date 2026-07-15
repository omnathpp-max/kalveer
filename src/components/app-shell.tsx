import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  WalletCards,
  Package,
  Fuel,
  FileBarChart,
  Users,
  Settings,
  ShieldCheck,
  Menu,
  LogOut,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/permissions";
import { NotificationBell } from "@/components/notification-bell";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import logoAsset from "@/assets/kalveer-logo.png.asset.json";

import { MODULE_ACCESS, canAccess, type ModuleKey } from "@/lib/access";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  module: ModuleKey;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { to: "/payment-requests", label: "Payment Requests", icon: Receipt, module: "payment_requests" },
  { to: "/my-petty-cash", label: "My Petty Cash", icon: Wallet, module: "my_petty_cash" },
  { to: "/petty-cash-wallets", label: "All Wallets", icon: WalletCards, module: "petty_cash_wallets" },
  { to: "/inventory", label: "Inventory", icon: Package, module: "inventory" },
  { to: "/diesel", label: "Diesel", icon: Fuel, module: "diesel" },
  { to: "/reports", label: "Reports", icon: FileBarChart, module: "reports" },
  { to: "/users", label: "Users & Permissions", icon: Users, module: "users" },
  { to: "/audit-logs", label: "Audit Logs", icon: ShieldCheck, module: "audit_logs" },
  { to: "/settings", label: "Settings", icon: Settings, module: "settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, roles, permissions, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const primaryRole = roles[0] ?? "worker";

  // Close the drawer whenever the route changes so navigation always dismisses it.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const items = NAV.filter((item) =>
    canAccess(MODULE_ACCESS[item.module], { roles, permissions }),
  );

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col">
      <nav
        aria-label="Primary"
        className="flex-1 min-h-0 overflow-y-auto px-2 py-3"
      >
        {items.map((item) => {
          const active =
            location.pathname === item.to ||
            location.pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors min-h-11",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent focus-visible:bg-sidebar-accent",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <Link
          to="/profile"
          className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent focus-visible:bg-sidebar-accent"
        >
          <UserCircle
            className="h-8 w-8 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {profile?.full_name || "User"}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {ROLE_LABELS[primaryRole]}
            </div>
          </div>
        </Link>
        <Button
          variant="outline"
          className="w-full min-h-11"
          onClick={() => signOut()}
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside
        aria-label="Sidebar"
        className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex"
      >
        <div className="flex items-center justify-center border-b px-4 py-3">
          <img
            src={logoAsset.url}
            alt="Kalveer Exports LLP"
            className="h-14 w-auto"
          />
        </div>

        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="flex h-[100dvh] w-72 max-w-[85vw] flex-col bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetHeader className="shrink-0 flex items-center justify-center border-b px-4 py-3">
            <SheetTitle className="sr-only">Kalveer Exports LLP</SheetTitle>
            <SheetDescription className="sr-only">Navigation menu</SheetDescription>
            <img
              src={logoAsset.url}
              alt="Kalveer Exports LLP"
              className="h-14 w-auto"
            />
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-hidden pb-[env(safe-area-inset-bottom)]">
            {sidebarContent}
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-4 md:px-6">
          <button
            className="-ml-1 inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent focus-visible:bg-accent md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-sidebar"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <img
            src={logoAsset.url}
            alt="Kalveer Exports LLP"
            className="h-8 w-auto md:hidden"
          />

          <div className="hidden text-xs text-muted-foreground md:block">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <NotificationBell />
            <Link
              to="/profile"
              className="hidden max-w-[14rem] truncate text-xs text-muted-foreground hover:text-foreground md:block"
            >
              {profile?.full_name}
            </Link>
          </div>
        </header>
        <main
          id="main-content"
          className="flex-1 overflow-x-hidden px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
