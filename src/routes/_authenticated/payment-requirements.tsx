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
  Receipt,
  Plus,
  FileDown,
  Printer,
  Search,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/payment-requirements")({
  component: PaymentRequirementsPage,
});

type RequestRow = {
  id: string;
  request_no: string;
  requester_id: string;
  vendor_name: string;
  vendor_category: string | null;
  payment_type: string;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
  upi_id: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  invoice_url: string | null;
  amount: number;
  approved_amount: number | null;
  paid_amount: number | null;
  priority: string;
  required_date: string;
  purpose: string;
  notes: string | null;
  attachment_url: string | null;
  status: "submitted" | "approved" | "rejected" | "processing" | "paid";
  approver_id: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  rejected_reason: string | null;
  payer_id: string | null;
  paid_at: string | null;
  payment_mode: string | null;
  payment_reference: string | null;
  payment_proof_url: string | null;
  payment_notes: string | null;
  created_at: string;
};

type ProfileLite = { id: string; full_name: string };

const VENDOR_CATEGORIES = [
  "Diesel / Fuel",
  "Explosives",
  "Machinery Spares",
  "Machinery Rent / Hire",
  "Transport",
  "Labour Contractor",
  "Electricity / Utilities",
  "Government / Statutory",
  "Repairs & Services",
  "Office / Admin",
  "Consumables",
  "Other",
];

const PAYMENT_TYPES = ["Bank Transfer", "UPI", "Cash", "Cheque", "Other"];
const PRIORITIES: { value: string; label: string; tone: string }[] = [
  { value: "low", label: "Low", tone: "text-muted-foreground" },
  { value: "normal", label: "Normal", tone: "text-foreground" },
  { value: "high", label: "High", tone: "text-amber-700" },
  { value: "urgent", label: "Urgent", tone: "text-rose-700" },
];

function PaymentRequirementsPage() {
  const { hasPermission } = useAuth();
  const canRaise = hasPermission("raise_payment_requirement");
  const canApprove = hasPermission("approve_payment_requirement");
  const canPay = hasPermission("process_payment_requirement");
  const canExport = hasPermission("export_reports");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Receipt className="h-6 w-6" /> Payment Requirements
        </h1>
        <p className="text-sm text-muted-foreground">
          Vendor payment requests, approvals and payment tracking.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="requests" className="mt-4">
          <RequestsTab canRaise={canRaise} canApprove={canApprove} canPay={canPay} />
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
    pending: 0,
    pendingAmount: 0,
    approvedUnpaid: 0,
    approvedUnpaidAmount: 0,
    paidThisMonth: 0,
    paidThisMonthAmount: 0,
    urgentPending: 0,
  });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("payment_requirements")
      .select("status,amount,approved_amount,paid_amount,paid_at,priority");
    const rows = (data ?? []) as Pick<
      RequestRow,
      "status" | "amount" | "approved_amount" | "paid_amount" | "paid_at" | "priority"
    >[];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    let pending = 0;
    let pendingAmount = 0;
    let approvedUnpaid = 0;
    let approvedUnpaidAmount = 0;
    let paidThisMonth = 0;
    let paidThisMonthAmount = 0;
    let urgentPending = 0;
    for (const r of rows) {
      const amt = Number(r.amount);
      if (r.status === "submitted") {
        pending += 1;
        pendingAmount += amt;
        if (r.priority === "urgent") urgentPending += 1;
      }
      if (r.status === "approved" || r.status === "processing") {
        approvedUnpaid += 1;
        approvedUnpaidAmount += Number(r.approved_amount ?? amt);
      }
      if (r.status === "paid" && r.paid_at && new Date(r.paid_at) >= monthStart) {
        paidThisMonth += 1;
        paidThisMonthAmount += Number(r.paid_amount ?? amt);
      }
    }
    setStats({
      pending,
      pendingAmount,
      approvedUnpaid,
      approvedUnpaidAmount,
      paidThisMonth,
      paidThisMonthAmount,
      urgentPending,
    });
    setLoading(false);
  }

  const cards = [
    {
      title: "Pending Approvals",
      value: String(stats.pending),
      sub: formatINR(stats.pendingAmount),
      icon: Clock,
      tint: "text-amber-600",
    },
    {
      title: "Urgent Pending",
      value: String(stats.urgentPending),
      sub: "Marked urgent",
      icon: AlertTriangle,
      tint: "text-rose-600",
    },
    {
      title: "Approved · Unpaid",
      value: String(stats.approvedUnpaid),
      sub: formatINR(stats.approvedUnpaidAmount),
      icon: Wallet,
      tint: "text-sky-600",
    },
    {
      title: "Paid This Month",
      value: String(stats.paidThisMonth),
      sub: formatINR(stats.paidThisMonthAmount),
      icon: CheckCircle2,
      tint: "text-emerald-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
            <c.icon className={`h-4 w-4 ${c.tint}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "…" : c.value}</div>
            <div className="text-xs text-muted-foreground">{loading ? "" : c.sub}</div>
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
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_requirements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const list = (data ?? []) as RequestRow[];
    setRows(list);
    const ids = Array.from(
      new Set(
        list.flatMap((r) => [r.requester_id, r.approver_id, r.payer_id].filter(Boolean) as string[]),
      ),
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
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      if (q) {
        const hay =
          `${r.request_no} ${r.vendor_name} ${r.purpose} ${r.invoice_no ?? ""} ${profiles[r.requester_id] ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, statusFilter, priorityFilter, q, profiles]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Payment Requests</CardTitle>
            <CardDescription>Submit, approve and process vendor payments.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Vendor, invoice, purpose…"
                className="w-56 pl-8"
              />
            </div>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  <TableHead>Vendor</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      No requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const prio = PRIORITIES.find((p) => p.value === r.priority);
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                        <TableCell className="font-mono text-xs">{r.request_no}</TableCell>
                        <TableCell>
                          <div className="font-medium">{r.vendor_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.vendor_category ?? "—"} · {r.payment_type}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{r.purpose}</TableCell>
                        <TableCell className={`text-sm font-medium ${prio?.tone ?? ""}`}>
                          {prio?.label ?? r.priority}
                        </TableCell>
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
                    );
                  })
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
  const categories = useCategories("payment", VENDOR_CATEGORIES);
  const [vendorName, setVendorName] = useState("");
  const [vendorCategory, setVendorCategory] = useState(categories[0] ?? VENDOR_CATEGORIES[0]);

  useEffect(() => {
    if (categories.length && !categories.includes(vendorCategory)) {
      setVendorCategory(categories[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);
  const [paymentType, setPaymentType] = useState(PAYMENT_TYPES[0]);
  const [bankName, setBankName] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [upiId, setUpiId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [amount, setAmount] = useState("");
  const [priority, setPriority] = useState("normal");
  const [requiredDate, setRequiredDate] = useState(todayISO());
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setVendorName("");
    setVendorCategory(categories[0] ?? VENDOR_CATEGORIES[0]);
    setPaymentType(PAYMENT_TYPES[0]);
    setBankName("");
    setBankAccountNo("");
    setBankIfsc("");
    setUpiId("");
    setInvoiceNo("");
    setInvoiceDate("");
    setInvoiceUrl("");
    setAmount("");
    setPriority("normal");
    setRequiredDate(todayISO());
    setPurpose("");
    setNotes("");
    setAttachmentUrl("");
  }

  async function submit() {
    if (!user) return;
    const amt = Number(amount);
    if (!vendorName.trim()) return toast.error("Vendor name is required");
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (!purpose.trim()) return toast.error("Purpose is required");
    setSaving(true);
    const { data, error } = await supabase
      .from("payment_requirements")
      .insert({
        requester_id: user.id,
        vendor_name: vendorName.trim(),
        vendor_category: vendorCategory,
        payment_type: paymentType,
        bank_name: bankName.trim() || null,
        bank_account_no: bankAccountNo.trim() || null,
        bank_ifsc: bankIfsc.trim().toUpperCase() || null,
        upi_id: upiId.trim() || null,
        invoice_no: invoiceNo.trim() || null,
        invoice_date: invoiceDate || null,
        invoice_url: invoiceUrl.trim() || null,
        amount: amt,
        priority,
        required_date: requiredDate,
        purpose: purpose.trim(),
        notes: notes.trim() || null,
        attachment_url: attachmentUrl.trim() || null,
        request_no: "", // trigger fills
      } as never)
      .select("id,request_no")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit("payment_requirements", "request_created", data?.id, {
      vendor: vendorName,
      amount: amt,
      priority,
    });
    toast.success(`Request ${data?.request_no} submitted`);
    reset();
    onOpenChange(false);
    await onSaved();
  }

  const showBank = paymentType === "Bank Transfer" || paymentType === "Cheque";
  const showUpi = paymentType === "UPI";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Payment Requirement</DialogTitle>
          <DialogDescription>
            Enter vendor and invoice details. It goes for approval before payment.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vendor name">
              <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
            </Field>
            <Field label="Category">
              <Select value={vendorCategory} onValueChange={setVendorCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
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
                placeholder="0.00"
              />
            </Field>
            <Field label="Payment type">
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {showBank && (
            <div className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-3">
              <Field label="Bank name">
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </Field>
              <Field label="Account #">
                <Input value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} />
              </Field>
              <Field label="IFSC">
                <Input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} />
              </Field>
            </div>
          )}
          {showUpi && (
            <div className="rounded-md border p-3">
              <Field label="UPI ID">
                <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Field label="Invoice #">
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </Field>
            <Field label="Invoice date">
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </Field>
            <Field label="Invoice URL">
              <Input
                value={invoiceUrl}
                onChange={(e) => setInvoiceUrl(e.target.value)}
                placeholder="Link (optional)"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Required by">
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
              placeholder="e.g. Diesel supply for June"
            />
          </Field>
          <Field label="Notes (optional)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
          <Field label="Quotation / Invoice (optional)">
            <FileUpload
              value={attachmentUrl}
              onChange={setAttachmentUrl}
              folder="payment-req"
              label="invoice"
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
  const [approvedAmount, setApprovedAmount] = useState(String(request.amount));
  const [payMode, setPayMode] = useState(request.payment_type || "Bank Transfer");
  const [payRef, setPayRef] = useState("");
  const [payAmount, setPayAmount] = useState(
    String(request.approved_amount ?? request.amount),
  );
  const [payNotes, setPayNotes] = useState("");
  const [payProof, setPayProof] = useState("");

  const isRequester = user?.id === request.requester_id;
  const isApprover = user?.id === request.approver_id;
  const showApprove = canApprove && !isRequester && request.status === "submitted";
  const showPay =
    canPay &&
    !isApprover &&
    !isRequester &&
    (request.status === "approved" || request.status === "processing");

  async function update(patch: Record<string, unknown>, action: string) {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("payment_requirements")
      .update(patch as never)
      .eq("id", request.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await logAudit("payment_requirements", action, request.id, patch);
    toast.success("Request updated");
    await onChanged();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-sm">{request.request_no}</span>
            <StatusBadge status={request.status as Status} />
          </DialogTitle>
          <DialogDescription>
            {request.vendor_name} · {request.purpose}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <InfoRow label="Amount" value={<span className="font-semibold">{formatINR(request.amount)}</span>} />
          {request.approved_amount != null && (
            <InfoRow label="Approved amount" value={formatINR(request.approved_amount)} />
          )}
          {request.paid_amount != null && (
            <InfoRow label="Paid amount" value={formatINR(request.paid_amount)} />
          )}
          <InfoRow label="Vendor" value={`${request.vendor_name} · ${request.vendor_category ?? "—"}`} />
          <InfoRow label="Payment type" value={request.payment_type} />
          {(request.bank_name || request.bank_account_no || request.bank_ifsc) && (
            <InfoRow
              label="Bank details"
              value={`${request.bank_name ?? "—"} · A/C ${request.bank_account_no ?? "—"} · IFSC ${request.bank_ifsc ?? "—"}`}
            />
          )}
          {request.upi_id && <InfoRow label="UPI" value={request.upi_id} />}
          {(request.invoice_no || request.invoice_date) && (
            <InfoRow
              label="Invoice"
              value={`${request.invoice_no ?? "—"}${request.invoice_date ? ` · ${formatDate(request.invoice_date)}` : ""}`}
            />
          )}
          {request.invoice_url && (
            <InfoRow
              label="Invoice link"
              value={
                <a className="text-primary underline" href={request.invoice_url} target="_blank" rel="noreferrer">
                  Open
                </a>
              }
            />
          )}
          <InfoRow label="Priority" value={request.priority} />
          <InfoRow label="Required by" value={formatDate(request.required_date)} />
          <InfoRow label="Requester" value={profiles[request.requester_id] ?? "—"} />
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
            <div className="grid grid-cols-2 gap-2">
              <Field label="Approved amount (₹)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                />
              </Field>
            </div>
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
                onClick={() => {
                  const amt = Number(approvedAmount);
                  if (!amt || amt <= 0) return toast.error("Enter a valid approved amount");
                  update(
                    {
                      status: "approved",
                      approver_id: user!.id,
                      approved_at: new Date().toISOString(),
                      approval_notes: approvalNotes || null,
                      approved_amount: amt,
                    },
                    "request_approved",
                  );
                }}
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
                    {PAYMENT_TYPES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Amount paid (₹)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Reference / Txn ID">
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            </Field>
            <Field label="Payment proof (optional)">
              <FileUpload
                value={payProof}
                onChange={setPayProof}
                folder="payment-req-proofs"
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
                  onClick={() =>
                    update({ status: "processing", payer_id: user!.id }, "request_processing")
                  }
                  disabled={busy}
                >
                  Mark Processing
                </Button>
              )}
              <Button
                onClick={() => {
                  const amt = Number(payAmount);
                  if (!amt || amt <= 0) return toast.error("Enter a valid paid amount");
                  update(
                    {
                      status: "paid",
                      payer_id: user!.id,
                      paid_at: new Date().toISOString(),
                      payment_mode: payMode,
                      payment_reference: payRef || null,
                      payment_proof_url: payProof || null,
                      payment_notes: payNotes || null,
                      paid_amount: amt,
                    },
                    "request_paid",
                  );
                }}
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
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */

function ReportsTab({ canExport }: { canExport: boolean }) {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const { data } = await supabase
      .from("payment_requirements")
      .select("*")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: true });
    setRows((data ?? []) as RequestRow[]);
    setLoading(false);
  }
  useEffect(() => {
    void run();
  }, [from, to]);

  const totals = useMemo(() => {
    const requested = rows.reduce((s, r) => s + Number(r.amount), 0);
    const approved = rows
      .filter((r) => r.status === "approved" || r.status === "processing" || r.status === "paid")
      .reduce((s, r) => s + Number(r.approved_amount ?? r.amount), 0);
    const paid = rows
      .filter((r) => r.status === "paid")
      .reduce((s, r) => s + Number(r.paid_amount ?? r.approved_amount ?? r.amount), 0);
    return { requested, approved, paid, count: rows.length };
  }, [rows]);

  const byVendor = useMemo(() => {
    const map = new Map<string, { requested: number; paid: number; count: number }>();
    for (const r of rows) {
      const v = r.vendor_name;
      const prev = map.get(v) ?? { requested: 0, paid: 0, count: 0 };
      prev.requested += Number(r.amount);
      prev.count += 1;
      if (r.status === "paid") prev.paid += Number(r.paid_amount ?? r.approved_amount ?? r.amount);
      map.set(v, prev);
    }
    return Array.from(map.entries())
      .map(([vendor, v]) => ({ vendor, ...v }))
      .sort((a, b) => b.requested - a.requested);
  }, [rows]);

  function exportCSV() {
    const flat = rows.map((r) => ({
      Request: r.request_no,
      Vendor: r.vendor_name,
      Category: r.vendor_category ?? "",
      "Payment Type": r.payment_type,
      "Invoice #": r.invoice_no ?? "",
      "Invoice Date": r.invoice_date ?? "",
      Priority: r.priority,
      Amount: r.amount,
      "Approved Amount": r.approved_amount ?? "",
      "Paid Amount": r.paid_amount ?? "",
      Status: r.status,
      "Required Date": r.required_date,
      "Created": r.created_at,
      "Paid At": r.paid_at ?? "",
      Purpose: r.purpose,
    }));
    const csv =
      `Kalveer Quarry - Payment Requirements Report\nFrom,${from}\nTo,${to}\n\n` + toCSV(flat);
    downloadFile(`payment-requirements-${from}_to_${to}.csv`, csv);
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
            <CardTitle className="text-lg">Kalveer Quarry — Payment Requirements Report</CardTitle>
            <CardDescription>
              {formatDate(from)} — {formatDate(to)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              <StatBox label="Requests" value={String(totals.count)} />
              <StatBox label="Requested" value={formatINR(totals.requested)} />
              <StatBox label="Approved" value={formatINR(totals.approved)} tone="ok" />
              <StatBox label="Paid" value={formatINR(totals.paid)} tone="ok" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Vendor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byVendor.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                        No data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    byVendor.map((v) => (
                      <TableRow key={v.vendor}>
                        <TableCell className="font-medium">{v.vendor}</TableCell>
                        <TableCell className="text-right">{v.count}</TableCell>
                        <TableCell className="text-right">{formatINR(v.requested)}</TableCell>
                        <TableCell className="text-right">{formatINR(v.paid)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center">
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        No requests in this range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.request_no}</TableCell>
                        <TableCell>{r.vendor_name}</TableCell>
                        <TableCell>{r.invoice_no ?? "—"}</TableCell>
                        <TableCell>{r.priority}</TableCell>
                        <TableCell>{r.status}</TableCell>
                        <TableCell className="text-right">{formatINR(r.amount)}</TableCell>
                        <TableCell className="text-right">
                          {r.paid_amount != null ? formatINR(r.paid_amount) : "—"}
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
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`text-lg font-semibold ${
          tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-rose-700" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
