import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, todayISO, toCSV, downloadFile } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { Wallet, Receipt, Fuel, Download, Printer } from "lucide-react";

import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/_authenticated/reports")({
  component: () => (
    <AccessGuard module="reports">
      <ReportsPage />
    </AccessGuard>
  ),
});

interface Summary {
  pcApproved: number;
  pcPaid: number;
  pcPending: number;
  pcRequestCount: number;
  prApproved: number;
  prPaid: number;
  prPending: number;
  prRequestCount: number;
  dieselConsumption: number;
  dieselReceived: number;
  dieselReportCount: number;
  cashIn: number;
  cashOut: number;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function ReportsPage() {
  const { hasPermission } = useAuth();
  const canExport = hasPermission("export_reports");

  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const toEnd = to + "T23:59:59";
      const [pc, pr, diesel, ledger] = await Promise.all([
        supabase
          .from("petty_cash_requests")
          .select("amount,status,created_at")
          .gte("created_at", from)
          .lte("created_at", toEnd),
        supabase
          .from("payment_requirements")
          .select("amount,approved_amount,paid_amount,status,created_at")
          .gte("created_at", from)
          .lte("created_at", toEnd),
        supabase
          .from("diesel_daily_reports")
          .select("consumption_litres,received_litres,report_date")
          .gte("report_date", from)
          .lte("report_date", to),
        supabase
          .from("petty_cash_ledger")
          .select("type,amount,entry_date")
          .gte("entry_date", from)
          .lte("entry_date", to),
      ]);

      const pcRows = (pc.data ?? []) as { amount: number; status: string }[];
      const prRows = (pr.data ?? []) as {
        amount: number;
        approved_amount: number | null;
        paid_amount: number | null;
        status: string;
      }[];
      const dRows = (diesel.data ?? []) as {
        consumption_litres: number;
        received_litres: number;
      }[];
      const lRows = (ledger.data ?? []) as { type: string; amount: number }[];

      const sum = (arr: number[]) => arr.reduce((s, n) => s + Number(n || 0), 0);

      setSummary({
        pcRequestCount: pcRows.length,
        pcApproved: sum(
          pcRows.filter((r) => ["approved", "processing", "paid"].includes(r.status)).map(
            (r) => r.amount,
          ),
        ),
        pcPaid: sum(pcRows.filter((r) => r.status === "paid").map((r) => r.amount)),
        pcPending: sum(
          pcRows
            .filter((r) => ["submitted", "approved", "processing"].includes(r.status))
            .map((r) => r.amount),
        ),
        prRequestCount: prRows.length,
        prApproved: sum(
          prRows
            .filter((r) => ["approved", "processing", "paid"].includes(r.status))
            .map((r) => r.approved_amount ?? r.amount),
        ),
        prPaid: sum(
          prRows
            .filter((r) => r.status === "paid")
            .map((r) => r.paid_amount ?? r.approved_amount ?? r.amount),
        ),
        prPending: sum(
          prRows
            .filter((r) => ["submitted", "approved", "processing"].includes(r.status))
            .map((r) => r.approved_amount ?? r.amount),
        ),
        dieselReportCount: dRows.length,
        dieselConsumption: sum(dRows.map((r) => r.consumption_litres)),
        dieselReceived: sum(dRows.map((r) => r.received_litres)),
        cashIn: sum(lRows.filter((r) => r.type === "in").map((r) => r.amount)),
        cashOut: sum(lRows.filter((r) => r.type === "out").map((r) => r.amount)),
      });
      setLoading(false);
    })();
  }, [from, to]);

  const rangeLabel = useMemo(() => `${from} to ${to}`, [from, to]);

  const setPreset = (days: number) => {
    const d = new Date();
    const toIso = d.toISOString().slice(0, 10);
    d.setDate(d.getDate() - (days - 1));
    setFrom(d.toISOString().slice(0, 10));
    setTo(toIso);
  };
  const setMonth = () => {
    setFrom(monthStart);
    setTo(today);
  };

  const exportCsv = () => {
    if (!summary) return;
    const rows = [
      { section: "Petty Cash", metric: "Requests", value: summary.pcRequestCount },
      { section: "Petty Cash", metric: "Approved amount", value: summary.pcApproved },
      { section: "Petty Cash", metric: "Paid amount", value: summary.pcPaid },
      { section: "Petty Cash", metric: "Pending amount", value: summary.pcPending },
      { section: "Petty Cash", metric: "Cash in (ledger)", value: summary.cashIn },
      { section: "Petty Cash", metric: "Cash out (ledger)", value: summary.cashOut },
      { section: "Payments", metric: "Requests", value: summary.prRequestCount },
      { section: "Payments", metric: "Approved amount", value: summary.prApproved },
      { section: "Payments", metric: "Paid amount", value: summary.prPaid },
      { section: "Payments", metric: "Pending amount", value: summary.prPending },
      { section: "Diesel", metric: "Reports", value: summary.dieselReportCount },
      { section: "Diesel", metric: "Consumption (L)", value: summary.dieselConsumption },
      { section: "Diesel", metric: "Received (L)", value: summary.dieselReceived },
    ];
    downloadFile(
      `kalveer-summary-${from}_to_${to}.csv`,
      toCSV(rows, ["section", "metric", "value"]),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Consolidated summary across every module. Filter by date range and export.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print / PDF
          </Button>
          {canExport && (
            <Button size="sm" onClick={exportCsv} disabled={!summary}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="grid gap-1">
            <Label htmlFor="from" className="text-xs">
              From
            </Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to" className="text-xs">
              To
            </Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <Button variant="outline" size="sm" onClick={() => setPreset(1)}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset(7)}>
              7 days
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset(30)}>
              30 days
            </Button>
            <Button variant="outline" size="sm" onClick={setMonth}>
              This month
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print:mb-4 print:block">
        <div className="text-lg font-semibold">Kalveer Quarry — Consolidated Report</div>
        <div className="text-sm text-muted-foreground">Period: {rangeLabel}</div>
      </div>

      {loading || !summary ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Loading summary…
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Petty Cash</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <StatRow label="Requests" value={String(summary.pcRequestCount)} />
                <StatRow label="Approved" value={formatINR(summary.pcApproved)} />
                <StatRow label="Paid" value={formatINR(summary.pcPaid)} />
                <StatRow label="Pending" value={formatINR(summary.pcPending)} />
                <StatRow label="Ledger cash in" value={formatINR(summary.cashIn)} />
                <StatRow label="Ledger cash out" value={formatINR(summary.cashOut)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Payment Requirements</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <StatRow label="Requests" value={String(summary.prRequestCount)} />
                <StatRow label="Approved" value={formatINR(summary.prApproved)} />
                <StatRow label="Paid" value={formatINR(summary.prPaid)} />
                <StatRow label="Pending" value={formatINR(summary.prPending)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                <Fuel className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Diesel</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <StatRow label="Daily reports" value={String(summary.dieselReportCount)} />
                <StatRow
                  label="Consumption"
                  value={`${summary.dieselConsumption.toFixed(1)} L`}
                />
                <StatRow
                  label="Received"
                  value={`${summary.dieselReceived.toFixed(1)} L`}
                />
                <StatRow
                  label="Net stock change"
                  value={`${(summary.dieselReceived - summary.dieselConsumption).toFixed(1)} L`}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Totals — {rangeLabel}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Petty Cash</TableCell>
                    <TableCell className="text-right">{formatINR(summary.pcApproved)}</TableCell>
                    <TableCell className="text-right">{formatINR(summary.pcPaid)}</TableCell>
                    <TableCell className="text-right">{formatINR(summary.pcPending)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Payments</TableCell>
                    <TableCell className="text-right">{formatINR(summary.prApproved)}</TableCell>
                    <TableCell className="text-right">{formatINR(summary.prPaid)}</TableCell>
                    <TableCell className="text-right">{formatINR(summary.prPending)}</TableCell>
                  </TableRow>
                  <TableRow className="font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">
                      {formatINR(summary.pcApproved + summary.prApproved)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatINR(summary.pcPaid + summary.prPaid)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatINR(summary.pcPending + summary.prPending)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="print:hidden">
            <CardHeader>
              <CardTitle>Detailed module reports</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Link
                to="/petty-cash"
                className="rounded-md border p-4 text-sm transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <div className="font-medium">Petty Cash reports</div>
                <div className="text-xs text-muted-foreground">
                  Requests, ledger, denomination sheet
                </div>
              </Link>
              <Link
                to="/payment-requirements"
                className="rounded-md border p-4 text-sm transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <div className="font-medium">Payment reports</div>
                <div className="text-xs text-muted-foreground">Per-vendor rollups & exports</div>
              </Link>
              <Link
                to="/diesel"
                className="rounded-md border p-4 text-sm transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <div className="font-medium">Diesel reports</div>
                <div className="text-xs text-muted-foreground">
                  Machine-wise consumption & operator usage
                </div>
              </Link>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
