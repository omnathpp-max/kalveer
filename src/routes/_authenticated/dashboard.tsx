import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/permissions";
import { Wallet, Receipt, Fuel, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: typeof Wallet;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const { profile, roles } = useAuth();
  const primaryRole = roles[0] ?? "worker";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Namaste, {profile?.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ROLE_LABELS[primaryRole]} · {new Date().toLocaleDateString("en-IN", { dateStyle: "full" })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Pending petty cash requests" value="—" hint="Coming in Phase 2" icon={Wallet} />
        <StatCard title="Pending payment requirements" value="—" hint="Coming in Phase 3" icon={Receipt} />
        <StatCard title="Diesel consumed today" value="— L" hint="Coming in Phase 4" icon={Fuel} />
        <StatCard title="Paid today" value="₹ —" hint="Coming in Phase 5" icon={ClipboardCheck} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Foundation ready</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Phase 1 is live: sign-in, role-based access, granular permissions, audit logging,
            responsive shell and module scaffolding.
          </p>
          <p>
            Next up: Petty Cash requests, cash-in/out ledger, and denomination sheet — matching
            your uploaded manual register.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
