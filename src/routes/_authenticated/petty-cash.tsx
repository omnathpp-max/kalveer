import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatINR, formatDate, formatDateTime, todayISO, toCSV, downloadFile } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { StatusBadge, type Status } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { FileUpload, AttachmentViewButton } from "@/components/file-upload";
import { useCategories } from "@/lib/use-categories";
import {
  Wallet,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  FileDown,
  Printer,
  Search,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/petty-cash")({
  component: PettyCashPage,
});

type RequestRow = {
  id: string;
  request_no: string;
  requester_id: string;
  amount: number;
  purpose: string;
  required_date: string;
  notes: string | null;
  status: "submitted" | "approved" | "rejected" | "processing" | "paid";
  approver_id: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  rejected_reason: string | null;
  payer_id: string | null;
  paid_at: string | null;
  payment_proof_url: string | null;
  payment_mode: string | null;
  payment_reference: string | null;
  payment_notes: string | null;
  attachment_url: string | null;
  created_at: string;
};

type LedgerRow = {
  id: string;
  entry_date: string;
  type: "in" | "out";
  amount: number;
  category: string;
  description: string | null;
  voucher_no: string | null;
  party: string | null;
  entered_by: string;
  linked_request_id: string | null;
  created_at: string;
};

type DenomRow = {
  id: string;
  entry_date: string;
  notes_500: number;
  notes_200: number;
  notes_100: number;
  notes_50: number;
  notes_20: number;
  notes_10: number;
  coins: number;
  total: number;
  expected_closing: number | null;
  mismatch_note: string | null;
};

type ProfileLite = { id: string; full_name: string };

const LEDGER_CATEGORIES = [
  "Site expense",
  "Fuel top-up",
  "Repair & Maintenance",
  "Labour",
  "Office",
  "Food & Refreshments",
  "Transport",
  "Cash withdrawal (bank)",
  "Cash deposit",
  "Petty cash request settlement",
  "Other",
];

function PettyCashPage() {
  const { hasPermission } = useAuth();
  const canRaise = hasPermission("raise_petty_cash_request");
  const canApprove = hasPermission("approve_petty_cash");
  const canPay = hasPermission("process_petty_cash_payment");
  const canLedger = hasPermission("add_petty_cash_ledger");
  const canExport = hasPermission("export_reports");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Wallet className="h-6 w-6" /> Petty Cash
        </h1>
        <p className="text-sm text-muted-foreground">
          Requests, cash ledger, denomination sheet and reports.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="denominations">Denominations</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="requests" className="mt-4">
          <RequestsTab canRaise={canRaise} canApprove={canApprove} canPay={canPay} />
        </TabsContent>
        <TabsContent value="ledger" className="mt-4">
          <LedgerTab canAdd={canLedger} />
        </TabsContent>
        <TabsContent value="denominations" className="mt-4">
          <DenominationsTab canAdd={canLedger} />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ReportsTab canExport={canExport} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                    */
/* -------------------------------------------------------------------------- */

function OverviewTab() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    cashInToday: 0,
    cashOutToday: 0,
    balance: 0,
    pendingRequests: 0,
    approvedUnpaid: 0,
    paidToday: 0,
  });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const today = todayISO();
    const [ledgerRes, reqRes] = await Promise.all([
      supabase.from("petty_cash_ledger").select("entry_date,type,amount"),
      supabase.from("petty_cash_requests").select("status,paid_at,amount"),
    ]);
    const ledger = (ledgerRes.data ?? []) as { entry_date: string; type: "in" | "out"; amount: number }[];
    const reqs = (reqRes.data ?? []) as { status: string; paid_at: string | null; amount: number }[];

    let inToday = 0;
    let outToday = 0;
    let balance = 0;
    for (const l of ledger) {
      const amt = Number(l.amount);
      if (l.type === "in") balance += amt;
      else balance -= amt;
      if (l.entry_date === today) {
        if (l.type === "in") inToday += amt;
        else outToday += amt;
      }
    }
    const pending = reqs.filter((r) => r.status === "submitted").length;
    const approvedUnpaid = reqs.filter((r) => r.status === "approved" || r.status === "processing").length;
    const paidToday = reqs.filter((r) => r.status === "paid" && r.paid_at?.slice(0, 10) === today).length;

    setStats({
      cashInToday: inToday,
      cashOutToday: outToday,
      balance,
      pendingRequests: pending,
      approvedUnpaid,
      paidToday,
    });
    setLoading(false);
  }

  const cards = [
    { title: "Cash In Today", value: formatINR(stats.cashInToday), icon: ArrowUpCircle, tint: "text-emerald-600" },
    { title: "Cash Out Today", value: formatINR(stats.cashOutToday), icon: ArrowDownCircle, tint: "text-rose-600" },
    { title: "Current Balance", value: formatINR(stats.balance), icon: Wallet, tint: "text-primary" },
    { title: "Pending Requests", value: String(stats.pendingRequests), icon: Wallet, tint: "text-amber-600" },
    { title: "Approved · Unpaid", value: String(stats.approvedUnpaid), icon: Wallet, tint: "text-sky-600" },
    { title: "Paid Today", value: String(stats.paidToday), icon: Wallet, tint: "text-green-600" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
            <c.icon className={`h-4 w-4 ${c.tint}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "…" : c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Requests                                                                    */
/* -------------------------------------------------------------------------- */

function RequestsTab({
  canRaise,
  canApprove,
  canPay,
}: {
  canRaise: boolean;
  canApprove: boolean;
  canPay: boolean;
}) {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("petty_cash_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const list = (data ?? []) as RequestRow[];
    setRows(list);
    const ids = Array.from(
      new Set(list.flatMap((r) => [r.requester_id, r.approver_id, r.payer_id].filter(Boolean) as string[])),
    );
    if (ids.length) {
      const { data: pf } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const map: Record<string, string> = {};
      for (const p of (pf ?? []) as ProfileLite[]) map[p.id] = p.full_name;
      setProfiles(map);
    }
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q) {
        const hay = `${r.request_no} ${r.purpose} ${profiles[r.requester_id] ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, statusFilter, q, profiles]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Petty Cash Requests</CardTitle>
            <CardDescription>Submit, approve and mark payments.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="w-44 pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            {canRaise && (
              <Button onClick={() => setOpenNew(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Request
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request #</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                      <TableCell className="font-mono text-xs">{r.request_no}</TableCell>
                      <TableCell>{profiles[r.requester_id] ?? "—"}</TableCell>
                      <TableCell className="max-w-xs truncate">{r.purpose}</TableCell>
                      <TableCell className="text-right font-medium">{formatINR(r.amount)}</TableCell>
                      <TableCell className="text-sm">{formatDate(r.required_date)}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status as Status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(r);
                          }}
                        >
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <NewRequestDialog open={openNew} onOpenChange={setOpenNew} onSaved={load} />
      {selected && (
        <RequestDetailDialog
          request={selected}
          profiles={profiles}
          canApprove={canApprove}
          canPay={canPay}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            await load();
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function NewRequestDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => Promise<void> | void;
}) {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [requiredDate, setRequiredDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setAmount("");
    setPurpose("");
    setRequiredDate(todayISO());
    setNotes("");
    setAttachmentUrl("");
  }

  async function submit() {
    if (!user) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (!purpose.trim()) return toast.error("Purpose is required");
    setSaving(true);
    const { data, error } = await supabase
      .from("petty_cash_requests")
      .insert({
        requester_id: user.id,
        amount: amt,
        purpose: purpose.trim(),
        required_date: requiredDate,
        notes: notes.trim() || null,
        attachment_url: attachmentUrl.trim() || null,
        request_no: "", // trigger fills
      } as never)
      .select("id,request_no")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit("petty_cash", "request_created", data?.id, { amount: amt });
    toast.success(`Request ${data?.request_no} submitted`);
    reset();
    onOpenChange(false);
    await onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Petty Cash Request</DialogTitle>
          <DialogDescription>
            Your request will go for approval before it can be paid.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Required Date">
              <Input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Purpose">
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Site diesel top-up"
            />
          </Field>
          <Field label="Notes (optional)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>
          <Field label="Bill / Receipt (optional)">
            <FileUpload
              value={attachmentUrl}
              onChange={setAttachmentUrl}
              folder="petty-cash"
              label="bill"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestDetailDialog({
  request,
  profiles,
  canApprove,
  canPay,
  onClose,
  onChanged,
}: {
  request: RequestRow;
  profiles: Record<string, string>;
  canApprove: boolean;
  canPay: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [payMode, setPayMode] = useState("Cash");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payProof, setPayProof] = useState("");

  const isRequester = user?.id === request.requester_id;
  const isApprover = user?.id === request.approver_id;
  const showApprove = canApprove && !isRequester && request.status === "submitted";
  const showPay =
    canPay && !isApprover && !isRequester && (request.status === "approved" || request.status === "processing");

  async function update(patch: Record<string, unknown>, action: string) {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("petty_cash_requests")
      .update(patch as never)
      .eq("id", request.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await logAudit("petty_cash", action, request.id, patch);
    toast.success("Request updated");
    await onChanged();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-sm">{request.request_no}</span>
            <StatusBadge status={request.status as Status} />
          </DialogTitle>
          <DialogDescription>{request.purpose}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <InfoRow label="Amount" value={<span className="font-semibold">{formatINR(request.amount)}</span>} />
          <InfoRow label="Requester" value={profiles[request.requester_id] ?? "—"} />
          <InfoRow label="Required" value={formatDate(request.required_date)} />
          <InfoRow label="Submitted" value={formatDateTime(request.created_at)} />
          {request.notes && <InfoRow label="Notes" value={request.notes} />}
          {request.attachment_url && (
            <InfoRow
              label="Attachment"
              value={<AttachmentViewButton value={request.attachment_url} />}
            />
          )}
          {request.approver_id && (
            <InfoRow
              label="Approver"
              value={`${profiles[request.approver_id] ?? "—"} · ${formatDateTime(request.approved_at)}`}
            />
          )}
          {request.approval_notes && <InfoRow label="Approval notes" value={request.approval_notes} />}
          {request.rejected_reason && <InfoRow label="Rejection reason" value={request.rejected_reason} />}
          {request.payer_id && (
            <InfoRow
              label="Paid by"
              value={`${profiles[request.payer_id] ?? "—"} · ${formatDateTime(request.paid_at)}`}
            />
          )}
          {request.payment_mode && <InfoRow label="Mode" value={request.payment_mode} />}
          {request.payment_reference && <InfoRow label="Reference" value={request.payment_reference} />}
          {request.payment_proof_url && (
            <InfoRow
              label="Payment proof"
              value={<AttachmentViewButton value={request.payment_proof_url} />}
            />
          )}
        </div>

        {showApprove && (
          <div className="mt-2 space-y-2 rounded-md border p-3">
            <div className="text-sm font-medium">Approve or reject</div>
            <Textarea
              placeholder="Approval notes (optional) or rejection reason"
              value={approvalNotes || rejectReason}
              onChange={(e) => {
                setApprovalNotes(e.target.value);
                setRejectReason(e.target.value);
              }}
              rows={2}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  update(
                    {
                      status: "rejected",
                      approver_id: user!.id,
                      approved_at: new Date().toISOString(),
                      rejected_reason: rejectReason || "Rejected",
                    },
                    "request_rejected",
                  )
                }
                disabled={busy}
              >
                Reject
              </Button>
              <Button
                onClick={() =>
                  update(
                    {
                      status: "approved",
                      approver_id: user!.id,
                      approved_at: new Date().toISOString(),
                      approval_notes: approvalNotes || null,
                    },
                    "request_approved",
                  )
                }
                disabled={busy}
              >
                Approve
              </Button>
            </div>
          </div>
        )}

        {showPay && (
          <div className="mt-2 space-y-2 rounded-md border p-3">
            <div className="text-sm font-medium">Process payment</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Mode">
                <Select value={payMode} onValueChange={setPayMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Cash", "UPI", "Bank Transfer", "Cheque", "Other"].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reference / Txn ID">
                <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} />
              </Field>
            </div>
            <Field label="Payment proof (optional)">
              <FileUpload
                value={payProof}
                onChange={setPayProof}
                folder="petty-cash-proofs"
                label="proof"
              />
            </Field>
            <Field label="Notes (optional)">
              <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={2} />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              {request.status === "approved" && (
                <Button
                  variant="outline"
                  onClick={() => update({ status: "processing", payer_id: user!.id }, "request_processing")}
                  disabled={busy}
                >
                  Mark Processing
                </Button>
              )}
              <Button
                onClick={() =>
                  update(
                    {
                      status: "paid",
                      payer_id: user!.id,
                      paid_at: new Date().toISOString(),
                      payment_mode: payMode,
                      payment_reference: payRef || null,
                      payment_proof_url: payProof || null,
                      payment_notes: payNotes || null,
                    },
                    "request_paid",
                  )
                }
                disabled={busy}
              >
                Mark Paid
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Ledger                                                                      */
/* -------------------------------------------------------------------------- */

function LedgerTab({ canAdd }: { canAdd: boolean }) {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("petty_cash_ledger")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as LedgerRow[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (typeFilter !== "all" && r.type !== typeFilter) return false;
        if (q) {
          const hay = `${r.category} ${r.description ?? ""} ${r.party ?? ""} ${r.voucher_no ?? ""}`.toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [rows, typeFilter, q],
  );

  // Running balance from full data (chronological), then map by id.
  const balanceById = useMemo(() => {
    const map = new Map<string, number>();
    let bal = 0;
    for (const r of [...rows].reverse()) {
      bal += r.type === "in" ? Number(r.amount) : -Number(r.amount);
      map.set(r.id, bal);
    }
    return map;
  }, [rows]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Cash Ledger</CardTitle>
            <CardDescription>Cash in / cash out entries with running balance.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="w-44 pl-8"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="in">Cash In</SelectItem>
                <SelectItem value="out">Cash Out</SelectItem>
              </SelectContent>
            </Select>
            {canAdd && (
              <Button onClick={() => setOpenNew(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Entry
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      No entries yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.entry_date)}</TableCell>
                      <TableCell>
                        <span
                          className={
                            r.type === "in"
                              ? "inline-flex items-center gap-1 text-emerald-700"
                              : "inline-flex items-center gap-1 text-rose-700"
                          }
                        >
                          {r.type === "in" ? (
                            <ArrowUpCircle className="h-4 w-4" />
                          ) : (
                            <ArrowDownCircle className="h-4 w-4" />
                          )}
                          {r.type === "in" ? "In" : "Out"}
                        </span>
                      </TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell className="max-w-xs truncate">{r.description ?? "—"}</TableCell>
                      <TableCell>{r.party ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.voucher_no ?? "—"}</TableCell>
                      <TableCell
                        className={`text-right font-medium ${r.type === "in" ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        {r.type === "in" ? "+" : "−"}
                        {formatINR(r.amount)}
                      </TableCell>
                      <TableCell className="text-right">{formatINR(balanceById.get(r.id) ?? 0)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <NewLedgerDialog open={openNew} onOpenChange={setOpenNew} onSaved={load} />
    </div>
  );
}

function NewLedgerDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => Promise<void> | void;
}) {
  const { user } = useAuth();
  const categories = useCategories("petty_cash", LEDGER_CATEGORIES);
  const [entryDate, setEntryDate] = useState(todayISO());
  const [type, setType] = useState<"in" | "out">("out");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0] ?? LEDGER_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [party, setParty] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (categories.length && !categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [categories]);

  async function submit() {
    if (!user) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    const { error } = await supabase.from("petty_cash_ledger").insert({
      entry_date: entryDate,
      type,
      amount: amt,
      category,
      description: description.trim() || null,
      voucher_no: voucherNo.trim() || null,
      party: party.trim() || null,
      entered_by: user.id,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit("petty_cash", "ledger_added", null, { type, amount: amt, category });
    toast.success("Entry saved");
    setAmount("");
    setDescription("");
    setVoucherNo("");
    setParty("");
    onOpenChange(false);
    await onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Ledger Entry</DialogTitle>
          <DialogDescription>Record a cash in / cash out event.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </Field>
            <Field label="Type">
              <Select value={type} onValueChange={(v) => setType(v as "in" | "out")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Cash In</SelectItem>
                  <SelectItem value="out">Cash Out</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Category">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEDGER_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label={type === "in" ? "Received from" : "Paid to"}>
            <Input value={party} onChange={(e) => setParty(e.target.value)} />
          </Field>
          <Field label="Voucher # (optional)">
            <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} />
          </Field>
          <Field label="Description (optional)">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Denominations                                                               */
/* -------------------------------------------------------------------------- */

const DENOMS: { key: keyof Omit<DenomRow, "id" | "entry_date" | "total" | "expected_closing" | "mismatch_note">; label: string; value: number }[] = [
  { key: "notes_500", label: "₹500", value: 500 },
  { key: "notes_200", label: "₹200", value: 200 },
  { key: "notes_100", label: "₹100", value: 100 },
  { key: "notes_50", label: "₹50", value: 50 },
  { key: "notes_20", label: "₹20", value: 20 },
  { key: "notes_10", label: "₹10", value: 10 },
];

function DenominationsTab({ canAdd }: { canAdd: boolean }) {
  const { user } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [row, setRow] = useState<DenomRow | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({
    notes_500: 0,
    notes_200: 0,
    notes_100: 0,
    notes_50: 0,
    notes_20: 0,
    notes_10: 0,
  });
  const [coins, setCoins] = useState(0);
  const [note, setNote] = useState("");
  const [expected, setExpected] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: d }, ledgerRes] = await Promise.all([
      supabase.from("petty_cash_denominations").select("*").eq("entry_date", date).maybeSingle(),
      supabase
        .from("petty_cash_ledger")
        .select("type,amount,entry_date")
        .lte("entry_date", date),
    ]);
    const ex = ((ledgerRes.data ?? []) as { type: "in" | "out"; amount: number }[]).reduce(
      (acc, r) => acc + (r.type === "in" ? Number(r.amount) : -Number(r.amount)),
      0,
    );
    setExpected(ex);
    if (d) {
      setRow(d as DenomRow);
      setCounts({
        notes_500: d.notes_500,
        notes_200: d.notes_200,
        notes_100: d.notes_100,
        notes_50: d.notes_50,
        notes_20: d.notes_20,
        notes_10: d.notes_10,
      });
      setCoins(Number(d.coins));
      setNote(d.mismatch_note ?? "");
    } else {
      setRow(null);
      setCounts({ notes_500: 0, notes_200: 0, notes_100: 0, notes_50: 0, notes_20: 0, notes_10: 0 });
      setCoins(0);
      setNote("");
    }
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, [date]);

  const total = useMemo(
    () => DENOMS.reduce((s, d) => s + (counts[d.key] || 0) * d.value, 0) + (coins || 0),
    [counts, coins],
  );
  const diff = total - expected;

  async function save() {
    if (!user) return;
    setSaving(true);
    const payload = {
      entry_date: date,
      notes_500: counts.notes_500,
      notes_200: counts.notes_200,
      notes_100: counts.notes_100,
      notes_50: counts.notes_50,
      notes_20: counts.notes_20,
      notes_10: counts.notes_10,
      coins,
      total,
      expected_closing: expected,
      mismatch_note: note || null,
      entered_by: user.id,
    };
    let error;
    if (row) {
      ({ error } = await supabase.from("petty_cash_denominations").update(payload as never).eq("id", row.id));
    } else {
      ({ error } = await supabase.from("petty_cash_denominations").insert(payload as never));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit("petty_cash", "denominations_saved", null, { date, total, expected });
    toast.success("Denominations saved");
    await load();
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle>Denomination Sheet</CardTitle>
          <CardDescription>Physical cash count for a given date.</CardDescription>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Denomination</TableHead>
                    <TableHead className="w-32">Count</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DENOMS.map((d) => (
                    <TableRow key={d.key}>
                      <TableCell className="font-medium">{d.label}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={counts[d.key] || 0}
                          onChange={(e) =>
                            setCounts((c) => ({ ...c, [d.key]: Math.max(0, Number(e.target.value) || 0) }))
                          }
                          disabled={!canAdd}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatINR((counts[d.key] || 0) * d.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-medium">Coins</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={coins}
                        onChange={(e) => setCoins(Math.max(0, Number(e.target.value) || 0))}
                        disabled={!canAdd}
                      />
                    </TableCell>
                    <TableCell className="text-right">{formatINR(coins)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatBox label="Physical Total" value={formatINR(total)} />
              <StatBox label="Expected (Ledger)" value={formatINR(expected)} />
              <StatBox
                label="Difference"
                value={formatINR(diff)}
                tone={diff === 0 ? "ok" : "warn"}
              />
            </div>

            {diff !== 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Mismatch of {formatINR(Math.abs(diff))} — please add an explanation below.
              </div>
            )}

            <Field label="Mismatch note / remarks">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} disabled={!canAdd} />
            </Field>

            {canAdd && (
              <div className="flex justify-end">
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Sheet
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */

function ReportsTab({ canExport }: { canExport: boolean }) {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(todayISO());
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const [rangeRes, priorRes] = await Promise.all([
      supabase
        .from("petty_cash_ledger")
        .select("*")
        .gte("entry_date", from)
        .lte("entry_date", to)
        .order("entry_date", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("petty_cash_ledger")
        .select("type,amount")
        .lt("entry_date", from),
    ]);
    setLedger((rangeRes.data ?? []) as LedgerRow[]);
    const opening = ((priorRes.data ?? []) as { type: "in" | "out"; amount: number }[]).reduce(
      (s, r) => s + (r.type === "in" ? Number(r.amount) : -Number(r.amount)),
      0,
    );
    setOpeningBalance(opening);
    setLoading(false);
  }
  useEffect(() => {
    void run();
  }, [from, to]);

  const totals = useMemo(() => {
    const inSum = ledger.filter((l) => l.type === "in").reduce((s, l) => s + Number(l.amount), 0);
    const outSum = ledger.filter((l) => l.type === "out").reduce((s, l) => s + Number(l.amount), 0);
    return { inSum, outSum, closing: openingBalance + inSum - outSum };
  }, [ledger, openingBalance]);

  function exportCSV() {
    const rows = ledger.map((l) => ({
      Date: l.entry_date,
      Type: l.type,
      Category: l.category,
      Description: l.description ?? "",
      Party: l.party ?? "",
      Voucher: l.voucher_no ?? "",
      Amount: l.amount,
    }));
    const csv =
      `Kalveer Quarry - Petty Cash Report\nFrom,${from}\nTo,${to}\nOpening,${openingBalance}\n\n` +
      toCSV(rows);
    downloadFile(`petty-cash-${from}_to_${to}.csv`, csv);
  }

  function printView() {
    window.print();
  }

  return (
    <div className="space-y-4">
      <Card className="print:hidden">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Report</CardTitle>
            <CardDescription>Filter by date range and export.</CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="From">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </Field>
            <Field label="To">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </Field>
            <div className="flex gap-2">
              {canExport && (
                <Button variant="outline" onClick={exportCSV} disabled={loading}>
                  <FileDown className="mr-2 h-4 w-4" />
                  CSV
                </Button>
              )}
              <Button variant="outline" onClick={printView} disabled={loading}>
                <Printer className="mr-2 h-4 w-4" />
                Print / PDF
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div id="print-area" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kalveer Quarry — Petty Cash Report</CardTitle>
            <CardDescription>
              {formatDate(from)} — {formatDate(to)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              <StatBox label="Opening" value={formatINR(openingBalance)} />
              <StatBox label="Total In" value={formatINR(totals.inSum)} tone="ok" />
              <StatBox label="Total Out" value={formatINR(totals.outSum)} tone="warn" />
              <StatBox label="Closing" value={formatINR(totals.closing)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Voucher</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center">
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : ledger.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        No entries in this range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledger.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{formatDate(l.entry_date)}</TableCell>
                        <TableCell>{l.type === "in" ? "Cash In" : "Cash Out"}</TableCell>
                        <TableCell>{l.category}</TableCell>
                        <TableCell>{l.description ?? "—"}</TableCell>
                        <TableCell>{l.party ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{l.voucher_no ?? "—"}</TableCell>
                        <TableCell
                          className={`text-right font-medium ${l.type === "in" ? "text-emerald-700" : "text-rose-700"}`}
                        >
                          {l.type === "in" ? "+" : "−"}
                          {formatINR(l.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small UI helpers                                                            */
/* -------------------------------------------------------------------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b pb-2 last:border-b-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-3">
      <div className="w-40 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          "text-lg font-semibold " +
          (tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-rose-700" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}
