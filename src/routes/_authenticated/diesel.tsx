import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AccessGuard } from "@/components/access-guard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDate, todayISO, toCSV, downloadFile } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { StatusBadge, type Status } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Fuel,
  Plus,
  FileDown,
  Printer,
  Loader2,
  Truck,
  Users,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/diesel")({
  component: DieselPage,
});

type Category = "excavator" | "compressor" | "vehicle" | "other";
type Shift = "day" | "night" | "full";
type RptStatus = "draft" | "submitted" | "approved" | "rejected";

const CATEGORY_LABEL: Record<Category, string> = {
  excavator: "Excavator",
  compressor: "Compressor / Generator",
  vehicle: "Vehicle",
  other: "Other",
};

type Machine = {
  id: string;
  name: string;
  category: Category;
  tank_capacity: number | null;
  service_hours_interval: number | null;
  notes: string | null;
  active: boolean;
};

type Operator = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  active: boolean;
};

type DailyReport = {
  id: string;
  report_date: string;
  shift: Shift;
  opening_litres: number;
  received_litres: number;
  consumption_litres: number;
  closing_litres: number;
  remarks: string | null;
  status: RptStatus;
  prepared_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

type MachineEntry = {
  id: string;
  daily_report_id: string;
  machine_id: string | null;
  operator_id: string | null;
  category: Category;
  machine_name: string;
  operator_name: string | null;
  consumption_litres: number;
  hour_start: number | null;
  hour_close: number | null;
  total_hours: number | null;
  average_lph: number | null;
  nature_of_work: string | null;
  tank_details: string | null;
  tank_capacity: number | null;
  service_hours: number | null;
  remarks: string | null;
};

const rptStatusToStatus = (s: RptStatus): Status =>
  s === "draft" ? "pending" : s === "submitted" ? "processing" : (s as Status);

function DieselPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage_diesel_entries");
  const canApprove = hasPermission("approve_diesel_report");
  const canExport = hasPermission("export_reports");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Fuel className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Diesel</h1>
          <p className="text-sm text-muted-foreground">
            Daily stock, machine-wise consumption and operator usage.
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reports">Daily Reports</TabsTrigger>
          <TabsTrigger value="machines">Machines</TabsTrigger>
          <TabsTrigger value="operators">Operators</TabsTrigger>
          <TabsTrigger value="analytics">Reports & Charts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Overview />
        </TabsContent>
        <TabsContent value="reports">
          <DailyReports canManage={canManage} canApprove={canApprove} />
        </TabsContent>
        <TabsContent value="machines">
          <Machines canManage={canManage} />
        </TabsContent>
        <TabsContent value="operators">
          <Operators canManage={canManage} />
        </TabsContent>
        <TabsContent value="analytics">
          <Analytics canExport={canExport} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Overview ---------------- */

function Overview() {
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState({ received: 0, consumed: 0, closing: 0, entries: 0 });
  const [weekly, setWeekly] = useState<{ date: string; consumed: number; received: number }[]>([]);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const t = todayISO();
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);
      const weekStart = weekAgo.toISOString().slice(0, 10);

      const [{ data: todays }, { data: week }, { data: entriesToday }, { count: pend }] =
        await Promise.all([
          supabase
            .from("diesel_daily_reports")
            .select("received_litres,consumption_litres,closing_litres")
            .eq("report_date", t),
          supabase
            .from("diesel_daily_reports")
            .select("report_date,received_litres,consumption_litres")
            .gte("report_date", weekStart)
            .order("report_date"),
          supabase
            .from("diesel_machine_entries")
            .select("id, diesel_daily_reports!inner(report_date)")
            .eq("diesel_daily_reports.report_date", t),
          supabase
            .from("diesel_daily_reports")
            .select("id", { count: "exact", head: true })
            .eq("status", "submitted"),
        ]);

      const rec = (todays ?? []).reduce((s, r) => s + Number(r.received_litres ?? 0), 0);
      const con = (todays ?? []).reduce((s, r) => s + Number(r.consumption_litres ?? 0), 0);
      const clo = (todays ?? []).reduce((s, r) => s + Number(r.closing_litres ?? 0), 0);
      setToday({ received: rec, consumed: con, closing: clo, entries: entriesToday?.length ?? 0 });

      // Roll up week
      const byDay = new Map<string, { consumed: number; received: number }>();
      (week ?? []).forEach((r) => {
        const prev = byDay.get(r.report_date) ?? { consumed: 0, received: 0 };
        byDay.set(r.report_date, {
          consumed: prev.consumed + Number(r.consumption_litres ?? 0),
          received: prev.received + Number(r.received_litres ?? 0),
        });
      });
      const days: { date: string; consumed: number; received: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const v = byDay.get(key) ?? { consumed: 0, received: 0 };
        days.push({ date: key.slice(5), ...v });
      }
      setWeekly(days);
      setPending(pend ?? 0);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Received today (L)" value={today.received.toFixed(2)} />
        <KpiCard label="Consumed today (L)" value={today.consumed.toFixed(2)} />
        <KpiCard label="Closing stock (L)" value={today.closing.toFixed(2)} />
        <KpiCard label="Pending approvals" value={pending.toString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last 7 days</CardTitle>
          <CardDescription>Diesel received vs consumed (litres)</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} />
              <RTooltip />
              <Legend />
              <Line type="monotone" dataKey="received" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line type="monotone" dataKey="consumed" stroke="hsl(var(--destructive))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

/* ---------------- Daily Reports ---------------- */

function DailyReports({ canManage, canApprove }: { canManage: boolean; canApprove: boolean }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("diesel_daily_reports")
      .select("*")
      .order("report_date", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setRows((data as DailyReport[]) ?? []);
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Daily diesel reports</CardTitle>
          <CardDescription>Opening, received, consumed, closing per day / shift.</CardDescription>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> New report
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No reports yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Consumed</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.report_date)}</TableCell>
                    <TableCell className="capitalize">{r.shift}</TableCell>
                    <TableCell className="text-right">{Number(r.opening_litres).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(r.received_litres).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(r.consumption_litres).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(r.closing_litres).toFixed(2)}</TableCell>
                    <TableCell><StatusBadge status={rptStatusToStatus(r.status)} /></TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setDetailId(r.id)}>
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {creating && (
        <NewReportDialog
          userId={user?.id ?? null}
          onClose={() => setCreating(false)}
          onSaved={async (id) => {
            setCreating(false);
            await load();
            setDetailId(id);
          }}
        />
      )}
      {detailId && (
        <ReportDetailDialog
          reportId={detailId}
          canManage={canManage}
          canApprove={canApprove}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
    </Card>
  );
}

function NewReportDialog({
  userId,
  onClose,
  onSaved,
}: {
  userId: string | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [shift, setShift] = useState<Shift>("full");
  const [opening, setOpening] = useState("0");
  const [received, setReceived] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("diesel_daily_reports")
      .insert({
        report_date: date,
        shift,
        opening_litres: Number(opening) || 0,
        received_litres: Number(received) || 0,
        consumption_litres: 0,
        closing_litres: (Number(opening) || 0) + (Number(received) || 0),
        remarks: remarks || null,
        status: "draft",
        prepared_by: userId,
        created_by: userId,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit("diesel", "create_report", data.id, { date, shift });
    toast.success("Report created");
    onSaved(data.id);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New daily diesel report</DialogTitle>
          <DialogDescription>Add opening and received stock; enter machine consumption after.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Shift</Label>
              <Select value={shift} onValueChange={(v) => setShift(v as Shift)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full day</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="night">Night</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Opening (L)</Label>
              <Input type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} />
            </div>
            <div>
              <Label>Received (L)</Label>
              <Input type="number" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportDetailDialog({
  reportId,
  canManage,
  canApprove,
  onClose,
  onChanged,
}: {
  reportId: string;
  canManage: boolean;
  canApprove: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [entries, setEntries] = useState<MachineEntry[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [adding, setAdding] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const load = async () => {
    const [{ data: r }, { data: e }, { data: m }, { data: o }] = await Promise.all([
      supabase.from("diesel_daily_reports").select("*").eq("id", reportId).maybeSingle(),
      supabase.from("diesel_machine_entries").select("*").eq("daily_report_id", reportId).order("created_at"),
      supabase.from("machines").select("*").eq("active", true).order("name"),
      supabase.from("operators").select("*").eq("active", true).order("name"),
    ]);
    setReport((r as DailyReport) ?? null);
    setEntries((e as MachineEntry[]) ?? []);
    setMachines((m as Machine[]) ?? []);
    setOperators((o as Operator[]) ?? []);
  };

  useEffect(() => { void load(); }, [reportId]);

  const recalcTotals = async (list: MachineEntry[], base: DailyReport) => {
    const consumption = list.reduce((s, e) => s + Number(e.consumption_litres ?? 0), 0);
    const closing = Number(base.opening_litres) + Number(base.received_litres) - consumption;
    await supabase
      .from("diesel_daily_reports")
      .update({ consumption_litres: consumption, closing_litres: closing })
      .eq("id", base.id);
    setReport({ ...base, consumption_litres: consumption, closing_litres: closing });
  };

  const submitForApproval = async () => {
    if (!report) return;
    const { error } = await supabase.from("diesel_daily_reports").update({ status: "submitted" }).eq("id", report.id);
    if (error) return toast.error(error.message);
    await logAudit("diesel", "submit_report", report.id);
    toast.success("Submitted for approval");
    onChanged();
    void load();
  };

  const approve = async () => {
    if (!report || !user) return;
    const { error } = await supabase
      .from("diesel_daily_reports")
      .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("id", report.id);
    if (error) return toast.error(error.message);
    await logAudit("diesel", "approve_report", report.id);
    toast.success("Approved");
    onChanged();
    void load();
  };

  const reject = async () => {
    if (!report || !user) return;
    const { error } = await supabase
      .from("diesel_daily_reports")
      .update({ status: "rejected", approved_by: user.id, approved_at: new Date().toISOString(), rejection_reason: rejectReason })
      .eq("id", report.id);
    if (error) return toast.error(error.message);
    await logAudit("diesel", "reject_report", report.id, { reason: rejectReason });
    setShowReject(false);
    toast.success("Rejected");
    onChanged();
    void load();
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from("diesel_machine_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    if (report) await recalcTotals(next, report);
  };

  if (!report) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent><div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div></DialogContent>
      </Dialog>
    );
  }

  const editable = canManage && (report.status === "draft" || report.status === "rejected");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Diesel report — {formatDate(report.report_date)} ({report.shift})</DialogTitle>
          <DialogDescription>
            Status: <StatusBadge status={rptStatusToStatus(report.status)} />
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-3 rounded-md border p-3 text-sm">
          <div><div className="text-muted-foreground">Opening</div><div className="font-medium">{Number(report.opening_litres).toFixed(2)} L</div></div>
          <div><div className="text-muted-foreground">Received</div><div className="font-medium">{Number(report.received_litres).toFixed(2)} L</div></div>
          <div><div className="text-muted-foreground">Consumed</div><div className="font-medium">{Number(report.consumption_litres).toFixed(2)} L</div></div>
          <div><div className="text-muted-foreground">Closing</div><div className="font-medium">{Number(report.closing_litres).toFixed(2)} L</div></div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Machine-wise entries ({entries.length})</h3>
          {editable && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add entry
            </Button>
          )}
        </div>

        <div className="max-h-72 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Machine</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead className="text-right">Litres</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Avg L/h</TableHead>
                <TableHead>Work</TableHead>
                {editable && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow><TableCell colSpan={editable ? 8 : 7} className="py-6 text-center text-sm text-muted-foreground">No entries.</TableCell></TableRow>
              ) : entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{CATEGORY_LABEL[e.category]}</TableCell>
                  <TableCell>{e.machine_name}</TableCell>
                  <TableCell>{e.operator_name ?? "—"}</TableCell>
                  <TableCell className="text-right">{Number(e.consumption_litres).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{e.total_hours != null ? Number(e.total_hours).toFixed(2) : "—"}</TableCell>
                  <TableCell className="text-right">{e.average_lph != null ? Number(e.average_lph).toFixed(2) : "—"}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{e.nature_of_work ?? "—"}</TableCell>
                  {editable && (
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => deleteEntry(e.id)}>Delete</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {report.rejection_reason && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <strong>Rejection reason:</strong> {report.rejection_reason}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {editable && (
            <Button onClick={submitForApproval}>Submit for approval</Button>
          )}
          {canApprove && report.status === "submitted" && (
            <>
              <Button variant="outline" onClick={() => setShowReject(true)}>
                <XCircle className="mr-1 h-4 w-4" /> Reject
              </Button>
              <Button onClick={approve}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
              </Button>
            </>
          )}
        </DialogFooter>

        {adding && (
          <AddEntryDialog
            reportId={reportId}
            machines={machines}
            operators={operators}
            userId={user?.id ?? null}
            onClose={() => setAdding(false)}
            onSaved={async () => {
              setAdding(false);
              const { data: e } = await supabase.from("diesel_machine_entries").select("*").eq("daily_report_id", reportId).order("created_at");
              const list = (e as MachineEntry[]) ?? [];
              setEntries(list);
              if (report) await recalcTotals(list, report);
            }}
          />
        )}

        {showReject && (
          <Dialog open onOpenChange={() => setShowReject(false)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Reject report</DialogTitle></DialogHeader>
              <Textarea placeholder="Reason for rejection" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowReject(false)}>Cancel</Button>
                <Button onClick={reject} disabled={!rejectReason.trim()}>Reject</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddEntryDialog({
  reportId, machines, operators, userId, onClose, onSaved,
}: {
  reportId: string;
  machines: Machine[];
  operators: Operator[];
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [machineId, setMachineId] = useState<string>("");
  const [operatorId, setOperatorId] = useState<string>("");
  const [category, setCategory] = useState<Category>("excavator");
  const [customName, setCustomName] = useState("");
  const [litres, setLitres] = useState("0");
  const [hourStart, setHourStart] = useState("");
  const [hourClose, setHourClose] = useState("");
  const [work, setWork] = useState("");
  const [tank, setTank] = useState("");
  const [service, setService] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedMachine = machines.find((m) => m.id === machineId);
  const selectedOperator = operators.find((o) => o.id === operatorId);

  useEffect(() => {
    if (selectedMachine) setCategory(selectedMachine.category);
  }, [selectedMachine]);

  const submit = async () => {
    const name = selectedMachine?.name ?? customName.trim();
    if (!name) { toast.error("Pick a machine or enter a name"); return; }
    const hs = hourStart ? Number(hourStart) : null;
    const hc = hourClose ? Number(hourClose) : null;
    const th = hs != null && hc != null ? Math.max(0, hc - hs) : null;
    const l = Number(litres) || 0;
    const avg = th && th > 0 ? l / th : null;
    setSaving(true);
    const { error } = await supabase.from("diesel_machine_entries").insert({
      daily_report_id: reportId,
      machine_id: selectedMachine?.id ?? null,
      operator_id: selectedOperator?.id ?? null,
      category,
      machine_name: name,
      operator_name: selectedOperator?.name ?? null,
      consumption_litres: l,
      hour_start: hs,
      hour_close: hc,
      total_hours: th,
      average_lph: avg,
      nature_of_work: work || null,
      tank_details: tank || null,
      tank_capacity: selectedMachine?.tank_capacity ?? null,
      service_hours: service ? Number(service) : null,
      remarks: remarks || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit("diesel", "add_machine_entry", reportId, { machine: name, litres: l });
    toast.success("Entry added");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Add machine entry</DialogTitle></DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Machine</Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger><SelectValue placeholder="Pick from master" /></SelectTrigger>
              <SelectContent>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name} ({CATEGORY_LABEL[m.category]})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!machineId && (
              <Input className="mt-2" placeholder="Or type machine name" value={customName} onChange={(e) => setCustomName(e.target.value)} />
            )}
          </div>
          <div>
            <Label>Operator</Label>
            <Select value={operatorId} onValueChange={setOperatorId}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                {operators.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Consumption (L)</Label>
            <Input type="number" step="0.01" value={litres} onChange={(e) => setLitres(e.target.value)} />
          </div>
          <div>
            <Label>Hour meter start</Label>
            <Input type="number" step="0.01" value={hourStart} onChange={(e) => setHourStart(e.target.value)} />
          </div>
          <div>
            <Label>Hour meter close</Label>
            <Input type="number" step="0.01" value={hourClose} onChange={(e) => setHourClose(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Nature of work</Label>
            <Input value={work} onChange={(e) => setWork(e.target.value)} />
          </div>
          <div>
            <Label>Tank details</Label>
            <Input value={tank} onChange={(e) => setTank(e.target.value)} placeholder="e.g. Full / Half" />
          </div>
          <div>
            <Label>Service hours</Label>
            <Input type="number" step="0.01" value={service} onChange={(e) => setService(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Machines master ---------------- */

function Machines({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("machines").select("*").order("name");
    setRows((data as Machine[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Machines</CardTitle>
          <CardDescription>Excavators, compressors, vehicles, generators.</CardDescription>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" /> Add machine</Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /> :
          rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No machines yet.</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Tank (L)</TableHead>
                    <TableHead className="text-right">Service (h)</TableHead>
                    <TableHead>Active</TableHead>
                    {canManage && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{CATEGORY_LABEL[m.category]}</TableCell>
                      <TableCell className="text-right">{m.tank_capacity ?? "—"}</TableCell>
                      <TableCell className="text-right">{m.service_hours_interval ?? "—"}</TableCell>
                      <TableCell>{m.active ? "Yes" : "No"}</TableCell>
                      {canManage && (
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => setEditing(m)}>Edit</Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
      </CardContent>
      {(creating || editing) && (
        <MachineDialog
          machine={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => { setCreating(false); setEditing(null); await load(); }}
        />
      )}
    </Card>
  );
}

function MachineDialog({ machine, onClose, onSaved }: { machine: Machine | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(machine?.name ?? "");
  const [category, setCategory] = useState<Category>(machine?.category ?? "excavator");
  const [tank, setTank] = useState(machine?.tank_capacity?.toString() ?? "");
  const [service, setService] = useState(machine?.service_hours_interval?.toString() ?? "");
  const [notes, setNotes] = useState(machine?.notes ?? "");
  const [active, setActive] = useState(machine?.active ?? true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name required");
    setSaving(true);
    const payload = {
      name: name.trim(),
      category,
      tank_capacity: tank ? Number(tank) : null,
      service_hours_interval: service ? Number(service) : null,
      notes: notes || null,
      active,
    };
    const { error } = machine
      ? await supabase.from("machines").update(payload).eq("id", machine.id)
      : await supabase.from("machines").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit("diesel", machine ? "update_machine" : "create_machine", machine?.id ?? null, { name: payload.name });
    toast.success("Saved");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{machine ? "Edit machine" : "New machine"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Tank capacity (L)</Label><Input type="number" step="0.01" value={tank} onChange={(e) => setTank(e.target.value)} /></div>
            <div><Label>Service interval (h)</Label><Input type="number" step="0.01" value={service} onChange={(e) => setService(e.target.value)} /></div>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /><Label>Active</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Operators master ---------------- */

function Operators({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Operator | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("operators").select("*").order("name");
    setRows((data as Operator[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Operators</CardTitle>
          <CardDescription>Drivers, operators & machine handlers.</CardDescription>
        </div>
        {canManage && <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" /> Add operator</Button>}
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /> :
          rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No operators yet.</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Active</TableHead>{canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell>{o.phone ?? "—"}</TableCell>
                    <TableCell>{o.active ? "Yes" : "No"}</TableCell>
                    {canManage && <TableCell><Button size="sm" variant="outline" onClick={() => setEditing(o)}>Edit</Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </CardContent>
      {(creating || editing) && (
        <OperatorDialog
          operator={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => { setCreating(false); setEditing(null); await load(); }}
        />
      )}
    </Card>
  );
}

function OperatorDialog({ operator, onClose, onSaved }: { operator: Operator | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(operator?.name ?? "");
  const [phone, setPhone] = useState(operator?.phone ?? "");
  const [notes, setNotes] = useState(operator?.notes ?? "");
  const [active, setActive] = useState(operator?.active ?? true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name required");
    setSaving(true);
    const payload = { name: name.trim(), phone: phone || null, notes: notes || null, active };
    const { error } = operator
      ? await supabase.from("operators").update(payload).eq("id", operator.id)
      : await supabase.from("operators").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit("diesel", operator ? "update_operator" : "create_operator", operator?.id ?? null, { name: payload.name });
    toast.success("Saved");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{operator ? "Edit operator" : "New operator"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /><Label>Active</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Analytics / Reports ---------------- */

function Analytics({ canExport }: { canExport: boolean }) {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(todayISO());
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [entries, setEntries] = useState<(MachineEntry & { report_date?: string })[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const { data: r } = await supabase
      .from("diesel_daily_reports")
      .select("*")
      .gte("report_date", from)
      .lte("report_date", to)
      .order("report_date");
    const rpts = (r as DailyReport[]) ?? [];
    setReports(rpts);
    if (rpts.length === 0) { setEntries([]); setLoading(false); return; }
    const ids = rpts.map((x) => x.id);
    const { data: e } = await supabase
      .from("diesel_machine_entries")
      .select("*")
      .in("daily_report_id", ids);
    const map = new Map(rpts.map((x) => [x.id, x.report_date] as const));
    setEntries(((e as MachineEntry[]) ?? []).map((x) => ({ ...x, report_date: map.get(x.daily_report_id) })));
    setLoading(false);
  };

  useEffect(() => { void run(); }, []);

  const totals = useMemo(() => {
    const received = reports.reduce((s, r) => s + Number(r.received_litres ?? 0), 0);
    const consumed = reports.reduce((s, r) => s + Number(r.consumption_litres ?? 0), 0);
    return { received, consumed };
  }, [reports]);

  const byMachine = useMemo(() => {
    const m = new Map<string, number>();
    entries.forEach((e) => m.set(e.machine_name, (m.get(e.machine_name) ?? 0) + Number(e.consumption_litres ?? 0)));
    return Array.from(m.entries()).map(([name, litres]) => ({ name, litres })).sort((a, b) => b.litres - a.litres).slice(0, 10);
  }, [entries]);

  const byOperator = useMemo(() => {
    const m = new Map<string, number>();
    entries.forEach((e) => { if (e.operator_name) m.set(e.operator_name, (m.get(e.operator_name) ?? 0) + Number(e.consumption_litres ?? 0)); });
    return Array.from(m.entries()).map(([name, litres]) => ({ name, litres })).sort((a, b) => b.litres - a.litres).slice(0, 10);
  }, [entries]);

  const trend = useMemo(() => {
    const m = new Map<string, { received: number; consumed: number }>();
    reports.forEach((r) => {
      const p = m.get(r.report_date) ?? { received: 0, consumed: 0 };
      m.set(r.report_date, { received: p.received + Number(r.received_litres ?? 0), consumed: p.consumed + Number(r.consumption_litres ?? 0) });
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date: date.slice(5), ...v }));
  }, [reports]);

  const exportCSV = () => {
    const rows = entries.map((e) => ({
      date: e.report_date, category: CATEGORY_LABEL[e.category], machine: e.machine_name, operator: e.operator_name ?? "",
      litres: e.consumption_litres, hours: e.total_hours ?? "", average: e.average_lph ?? "", work: e.nature_of_work ?? "",
    }));
    downloadFile(`diesel-${from}-${to}.csv`, toCSV(rows));
  };

  return (
    <div className="space-y-4">
      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <Button onClick={run} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Run</Button>
          {canExport && (
            <>
              <Button variant="outline" onClick={exportCSV}><FileDown className="mr-2 h-4 w-4" /> CSV</Button>
              <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print / PDF</Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Received (L)" value={totals.received.toFixed(2)} />
        <KpiCard label="Consumed (L)" value={totals.consumed.toFixed(2)} />
        <KpiCard label="Reports" value={reports.length.toString()} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Consumption trend</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <RTooltip />
                <Legend />
                <Line type="monotone" dataKey="received" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line type="monotone" dataKey="consumed" stroke="hsl(var(--destructive))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top machines (L)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMachine}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis fontSize={12} />
                <RTooltip />
                <Bar dataKey="litres" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Top operators (L)</CardTitle></CardHeader>
        <CardContent className="h-64">
          {byOperator.length === 0 ? (
            <p className="pt-8 text-center text-sm text-muted-foreground">No operator data in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byOperator}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis fontSize={12} />
                <RTooltip />
                <Bar dataKey="litres" fill="hsl(var(--accent-foreground))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Detailed entries</CardTitle><CardDescription>{formatDate(from)} — {formatDate(to)}</CardDescription></CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No entries.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Machine</TableHead>
                    <TableHead>Operator</TableHead><TableHead className="text-right">Litres</TableHead>
                    <TableHead className="text-right">Hours</TableHead><TableHead className="text-right">Avg L/h</TableHead>
                    <TableHead>Work</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.report_date ? formatDate(e.report_date) : "—"}</TableCell>
                      <TableCell>{CATEGORY_LABEL[e.category]}</TableCell>
                      <TableCell>{e.machine_name}</TableCell>
                      <TableCell>{e.operator_name ?? "—"}</TableCell>
                      <TableCell className="text-right">{Number(e.consumption_litres).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{e.total_hours != null ? Number(e.total_hours).toFixed(2) : "—"}</TableCell>
                      <TableCell className="text-right">{e.average_lph != null ? Number(e.average_lph).toFixed(2) : "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{e.nature_of_work ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
