import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, formatDate, todayISO } from "@/lib/format";
import { Wallet, Receipt, Fuel, ClipboardCheck, ArrowUpRight, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

interface Stats {
  pcPendingCount: number;
  pcPendingAmount: number;
  prPendingCount: number;
  prPendingAmount: number;
  prUrgentCount: number;
  dieselTodayLitres: number;
  dieselTodayStatus: string | null;
  paidTodayAmount: number;
  cashInHand: number;
  recent: Array<{
    id: string;
    module: string;
    action: string;
    created_at: string;
  }>;
  weekly: Array<{ day: string; consumption: number }>;
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  to,
  accent,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: typeof Wallet;
  to?: string;
  accent?: "warn" | "ok";
}) {
  const inner = (
    <Card className="h-full transition-colors hover:border-primary/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon
          className={
            "h-4 w-4 " +
            (accent === "warn"
              ? "text-amber-600"
              : accent === "ok"
                ? "text-emerald-600"
                : "text-muted-foreground")
          }
        />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function DashboardPage() {
  const { profile, roles } = useAuth();
  const primaryRole = roles[0] ?? "worker";
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = todayISO();
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);
      const weekAgoISO = weekAgo.toISOString().slice(0, 10);

      const [pc, pr, dieselToday, dieselWeek, paidPc, paidPr, ledger, audit] =
        await Promise.all([
          supabase
            .from("petty_cash_requests")
            .select("amount,status")
            .in("status", ["submitted", "approved", "processing"]),
          supabase
            .from("payment_requirements")
            .select("amount,approved_amount,status,priority,required_date"),
          supabase
            .from("diesel_daily_reports")
            .select("consumption_litres,status")
            .eq("report_date", today),
          supabase
            .from("diesel_daily_reports")
            .select("report_date,consumption_litres")
            .gte("report_date", weekAgoISO)
            .order("report_date", { ascending: true }),
          supabase
            .from("petty_cash_requests")
            .select("amount,paid_at")
            .eq("status", "paid")
            .gte("paid_at", today),
          supabase
            .from("payment_requirements")
            .select("paid_amount,approved_amount,paid_at")
            .eq("status", "paid")
            .gte("paid_at", today),
          supabase.from("petty_cash_ledger").select("type,amount"),
          supabase
            .from("audit_logs")
            .select("id,module,action,created_at")
            .order("created_at", { ascending: false })
            .limit(8),
        ]);

      const pcRows = (pc.data ?? []) as { amount: number }[];
      const prRows = (pr.data ?? []) as {
        amount: number;
        approved_amount: number | null;
        status: string;
        priority: string;
      }[];
      const prPending = prRows.filter((r) =>
        ["submitted", "approved", "processing"].includes(r.status),
      );

      const dieselTodayRows = (dieselToday.data ?? []) as {
        consumption_litres: number;
        status: string;
      }[];

      const dieselMap = new Map<string, number>();
      for (const r of (dieselWeek.data ?? []) as {
        report_date: string;
        consumption_litres: number;
      }[]) {
        dieselMap.set(r.report_date, (dieselMap.get(r.report_date) ?? 0) + Number(r.consumption_litres));
      }
      const weekly: Array<{ day: string; consumption: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        weekly.push({
          day: d.toLocaleDateString("en-IN", { weekday: "short" }),
          consumption: Math.round((dieselMap.get(iso) ?? 0) * 10) / 10,
        });
      }

      const paidPcAmt = ((paidPc.data ?? []) as { amount: number }[]).reduce(
        (s, r) => s + Number(r.amount),
        0,
      );
      const paidPrAmt = (
        (paidPr.data ?? []) as { paid_amount: number | null; approved_amount: number | null }[]
      ).reduce((s, r) => s + Number(r.paid_amount ?? r.approved_amount ?? 0), 0);

      const ledgerRows = (ledger.data ?? []) as { type: string; amount: number }[];
      const cashIn = ledgerRows
        .filter((r) => r.type === "in")
        .reduce((s, r) => s + Number(r.amount), 0);
      const cashOut = ledgerRows
        .filter((r) => r.type === "out")
        .reduce((s, r) => s + Number(r.amount), 0);

      setStats({
        pcPendingCount: pcRows.length,
        pcPendingAmount: pcRows.reduce((s, r) => s + Number(r.amount), 0),
        prPendingCount: prPending.length,
        prPendingAmount: prPending.reduce(
          (s, r) => s + Number(r.approved_amount ?? r.amount),
          0,
        ),
        prUrgentCount: prPending.filter((r) => r.priority === "urgent").length,
        dieselTodayLitres: dieselTodayRows.reduce(
          (s, r) => s + Number(r.consumption_litres),
          0,
        ),
        dieselTodayStatus: dieselTodayRows[0]?.status ?? null,
        paidTodayAmount: paidPcAmt + paidPrAmt,
        cashInHand: cashIn - cashOut,
        recent: (audit.data ?? []) as Stats["recent"],
        weekly,
      });
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Namaste, {profile?.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ROLE_LABELS[primaryRole]} ·{" "}
          {new Date().toLocaleDateString("en-IN", { dateStyle: "full" })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pending petty cash"
          value={loading ? "…" : String(stats?.pcPendingCount ?? 0)}
          hint={loading ? "" : formatINR(stats?.pcPendingAmount ?? 0)}
          icon={Wallet}
          to="/petty-cash"
        />
        <StatCard
          title="Pending payments"
          value={loading ? "…" : String(stats?.prPendingCount ?? 0)}
          hint={
            loading
              ? ""
              : `${formatINR(stats?.prPendingAmount ?? 0)}${
                  stats?.prUrgentCount ? ` · ${stats.prUrgentCount} urgent` : ""
                }`
          }
          icon={Receipt}
          to="/payment-requirements"
          accent={stats?.prUrgentCount ? "warn" : undefined}
        />
        <StatCard
          title="Diesel consumed today"
          value={loading ? "…" : `${(stats?.dieselTodayLitres ?? 0).toFixed(1)} L`}
          hint={
            loading
              ? ""
              : stats?.dieselTodayStatus
                ? `Status: ${stats.dieselTodayStatus}`
                : "No report yet"
          }
          icon={Fuel}
          to="/diesel"
          accent={!stats?.dieselTodayStatus ? "warn" : undefined}
        />
        <StatCard
          title="Paid today"
          value={loading ? "…" : formatINR(stats?.paidTodayAmount ?? 0)}
          hint={loading ? "" : `Cash in hand: ${formatINR(stats?.cashInHand ?? 0)}`}
          icon={ClipboardCheck}
          accent="ok"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Diesel consumption — last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.weekly ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit=" L" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${v} L`, "Consumption"]}
                  />
                  <Bar
                    dataKey="consumption"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Recent activity</CardTitle>
            <Link
              to="/audit-logs"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : stats?.recent.length === 0 ? (
              <div className="text-sm text-muted-foreground">No activity yet.</div>
            ) : (
              stats?.recent.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{r.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(r.created_at)}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
                    {r.module}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {stats && stats.prUrgentCount > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>
              {stats.prUrgentCount} urgent payment{stats.prUrgentCount > 1 ? "s" : ""}{" "}
              awaiting action.
            </span>
            <Link
              to="/payment-requirements"
              className="ml-auto text-xs font-medium text-primary underline"
            >
              Review now
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
