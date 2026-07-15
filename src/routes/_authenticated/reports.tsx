import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, formatDate, todayISO, toCSV, downloadFile } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { Receipt, Fuel, Download, Printer, Wallet } from "lucide-react";
import { StatusBadge, type Status } from "@/components/status-badge";
import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/_authenticated/reports")({
  component: () => (
    <AccessGuard module="reports">
      <ReportsPage />
    </AccessGuard>
  ),
});

const CATEGORY_LABELS: Record<string, string> = {
  petty_cash: "Petty Cash",
  vendor_payment: "Vendor Payment",
  diesel: "Diesel",
  other: "Other",
};

interface RequestRow {
  id: string;
  request_no: string;
  category: string;
  amount: number;
  approved_amount: number | null;
  paid_amount: number | null;
  status: string;
  priority: string;
  vendor_name: string | null;
  payment_mode: string | null;
  created_at: string;
  paid_at: string | null;
  requester_id: string;
}

function ReportsPage() {
  const { hasPermission } = useAuth();
  const canExport = hasPermission("export_reports");

  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [category, setCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [diesel, setDiesel] = useState<{ consumption: number; received: number; count: number }>({
    consumption: 0,
    received: 0,
    count: 0,
  });
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const toEnd = to + "T23:59:59";
      const [req, d, profs] = await Promise.all([
        supabase
          .from("payment_requests")
          .select(
            "id,request_no,category,amount,approved_amount,paid_amount,status,priority,vendor_name,payment_mode,created_at,paid_at,requester_id",
          )
          .gte("created_at", from)
          .lte("created_at", toEnd)
          .order("created_at", { ascending: false }),
        supabase
          .from("diesel_daily_reports")
          .select("consumption_litres,received_litres")
          .gte("report_date", from)
          .lte("report_date", to),
        supabase.from("profiles").select("id,full_name"),
      ]);
      const reqRows = (req.data ?? []) as RequestRow[];
      setRows(reqRows);
      const dRows = (d.data ?? []) as Array<{
        consumption_litres: number;
        received_litres: number;
      }>;
      setDiesel({
        consumption: dRows.reduce((s, r) => s + Number(r.consumption_litres || 0), 0),
        received: dRows.reduce((s, r) => s + Number(r.received_litres || 0), 0),
        count: dRows.length,
      });
      const nm: Record<string, string> = {};
      for (const p of (profs.data ?? []) as Array<{ id: string; full_name: string }>) {
        nm[p.id] = p.full_name;
      }
      setNames(nm);
      setLoading(false);
    })();
  }, [from, to]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, category, statusFilter]);

  const summary = useMemo(() => {
    const byCat: Record<string, { count: number; approved: number; paid: number; pending: number }> = {};
    for (const r of filtered) {
      const c = r.category;
      const b = (byCat[c] ??= { count: 0, approved: 0, paid: 0, pending: 0 });
      b.count++;
      if (["approved", "processing", "paid"].includes(r.status)) {
        b.approved += Number(r.approved_amount ?? r.amount);
      }
      if (r.status === "paid") {
        b.paid += Number(r.paid_amount ?? r.approved_amount ?? r.amount);
      }
      if (["submitted", "approved", "processing"].includes(r.status)) {
        b.pending += Number(r.approved_amount ?? r.amount);
      }
    }
    return byCat;
  }, [filtered]);

  const totals = useMemo(() => {
    const t = { count: 0, approved: 0, paid: 0, pending: 0 };
    for (const b of Object.values(summary)) {
      t.count += b.count;
      t.approved += b.approved;
      t.paid += b.paid;
      t.pending += b.pending;
    }
    return t;
  }, [summary]);

  const rangeLabel = `${from} to ${to}`;

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
    const csvRows = filtered.map((r) => ({
      request_no: r.request_no,
      category: CATEGORY_LABELS[r.category] ?? r.category,
      requester: names[r.requester_id] ?? "",
      vendor: r.vendor_name ?? "",
      amount: r.amount,
      approved: r.approved_amount ?? "",
      paid: r.paid_amount ?? "",
      status: r.status,
      payment_mode: r.payment_mode ?? "",
      created_at: r.created_at,
      paid_at: r.paid_at ?? "",
    }));
    downloadFile(
      `kalveer-expenses-${from}_to_${to}.csv`,
      toCSV(csvRows, [
        "request_no",
        "category",
        "requester",
        "vendor",
        "amount",
        "approved",
        "paid",
        "status",
        "payment_mode",
        "created_at",
        "paid_at",
      ]),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            All expenses across categories with filters and export.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print / PDF
          </Button>
          {canExport && (
            <Button size="sm" onClick={exportCsv} disabled={loading || filtered.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="grid gap-1">
            <Label htmlFor="from" className="text-xs">From</Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to" className="text-xs">To</Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="petty_cash">Petty Cash</SelectItem>
                <SelectItem value="vendor_payment">Vendor Payment</SelectItem>
                <SelectItem value="diesel">Diesel</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button variant="outline" size="sm" onClick={() => setPreset(1)}>Today</Button>
            <Button variant="outline" size="sm" onClick={() => setPreset(7)}>7 days</Button>
            <Button variant="outline" size="sm" onClick={() => setPreset(30)}>30 days</Button>
            <Button variant="outline" size="sm" onClick={setMonth}>This month</Button>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print:mb-4 print:block">
        <div className="text-lg font-semibold">Kalveer Quarry — Expenses report</div>
        <div className="text-sm text-muted-foreground">Period: {rangeLabel}</div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {(["petty_cash", "vendor_payment", "diesel", "other"] as const).map((cat) => {
          const s = summary[cat] ?? { count: 0, approved: 0, paid: 0, pending: 0 };
          return (
            <Card key={cat}>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                {cat === "petty_cash" && <Wallet className="h-4 w-4 text-muted-foreground" />}
                {cat === "vendor_payment" && <Receipt className="h-4 w-4 text-muted-foreground" />}
                {cat === "diesel" && <Fuel className="h-4 w-4 text-muted-foreground" />}
                {cat === "other" && <Receipt className="h-4 w-4 text-muted-foreground" />}
                <CardTitle className="text-sm">{CATEGORY_LABELS[cat]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Requests</span><span>{s.count}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="font-medium">{formatINR(s.paid)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Pending</span><span>{formatINR(s.pending)}</span></div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Totals — {rangeLabel}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Approved</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Pending</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(["petty_cash", "vendor_payment", "diesel", "other"] as const).map((cat) => {
                const s = summary[cat] ?? { count: 0, approved: 0, paid: 0, pending: 0 };
                return (
                  <TableRow key={cat}>
                    <TableCell className="font-medium">{CATEGORY_LABELS[cat]}</TableCell>
                    <TableCell className="text-right">{s.count}</TableCell>
                    <TableCell className="text-right">{formatINR(s.approved)}</TableCell>
                    <TableCell className="text-right">{formatINR(s.paid)}</TableCell>
                    <TableCell className="text-right">{formatINR(s.pending)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{totals.count}</TableCell>
                <TableCell className="text-right">{formatINR(totals.approved)}</TableCell>
                <TableCell className="text-right">{formatINR(totals.paid)}</TableCell>
                <TableCell className="text-right">{formatINR(totals.pending)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All expenses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No records match the filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request #</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.request_no}</TableCell>
                      <TableCell>{CATEGORY_LABELS[r.category] ?? r.category}</TableCell>
                      <TableCell>{names[r.requester_id] ?? "—"}</TableCell>
                      <TableCell>{r.vendor_name ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatINR(r.amount)}</TableCell>
                      <TableCell className="text-right">
                        {r.paid_amount != null ? formatINR(r.paid_amount) : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status as Status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(r.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {diesel.count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Diesel activity</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-sm">
            <div><div className="text-muted-foreground">Reports</div><div className="text-lg font-semibold">{diesel.count}</div></div>
            <div><div className="text-muted-foreground">Consumption</div><div className="text-lg font-semibold">{diesel.consumption.toFixed(1)} L</div></div>
            <div><div className="text-muted-foreground">Received</div><div className="text-lg font-semibold">{diesel.received.toFixed(1)} L</div></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
