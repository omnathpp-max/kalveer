import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { notifyUsers, notifyRole } from "@/lib/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Filter, Loader2, ChevronRight } from "lucide-react";
import { StatusBadge, type Status } from "@/components/status-badge";
import { formatINR, formatDate, todayISO } from "@/lib/format";

const searchSchema = z.object({
  new: z.string().optional(),
  category: z.enum(["petty_cash", "vendor_payment", "diesel", "other"]).optional(),
  purpose: z.string().optional(),
  vendor: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/payment-requests")({
  validateSearch: (s) => searchSchema.parse(s),
  component: PaymentRequestsPage,
});

const CATEGORY_LABELS: Record<string, string> = {
  petty_cash: "Petty Cash",
  vendor_payment: "Vendor Payment",
  diesel: "Diesel",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  petty_cash: "bg-violet-100 text-violet-800 border-violet-200",
  vendor_payment: "bg-blue-100 text-blue-800 border-blue-200",
  diesel: "bg-orange-100 text-orange-800 border-orange-200",
  other: "bg-slate-100 text-slate-800 border-slate-200",
};

interface RequestRow {
  id: string;
  request_no: string;
  category: string;
  requester_id: string;
  amount: number;
  approved_amount: number | null;
  paid_amount: number | null;
  purpose: string;
  required_date: string;
  priority: string;
  notes: string | null;
  attachment_url: string | null;
  vendor_name: string | null;
  vendor_category: string | null;
  payment_type: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
  upi_id: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  invoice_url: string | null;
  status: Status | string;
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
}

function PaymentRequestsPage() {
  const { user, hasPermission } = useAuth();
  const search = useSearch({ from: "/_authenticated/payment-requests" });
  const navigate = useNavigate();
  const canRaise = hasPermission("raise_request");
  const canApprove = hasPermission("approve_request");
  const canPay = hasPermission("process_payment");

  const [rows, setRows] = useState<RequestRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<RequestRow | null>(null);
  const [tab, setTab] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [{ data }, { data: profs }] = await Promise.all([
      supabase
        .from("payment_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("profiles").select("id,full_name"),
    ]);
    setRows((data ?? []) as RequestRow[]);
    const nm: Record<string, string> = {};
    for (const p of (profs ?? []) as Array<{ id: string; full_name: string }>) {
      nm[p.id] = p.full_name;
    }
    setNames(nm);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (search.new === "1") setShowForm(true);
  }, [search.new]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (catFilter !== "all" && r.category !== catFilter) return false;
      if (tab === "mine" && r.requester_id !== user?.id) return false;
      if (tab === "pending" && !["submitted", "approved", "processing"].includes(r.status)) return false;
      if (tab === "paid" && r.status !== "paid") return false;
      return true;
    });
  }, [rows, catFilter, tab, user?.id]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payment Requests</h1>
          <p className="text-sm text-muted-foreground">
            Petty cash, vendor payments, diesel and other expenses — all in one place.
          </p>
        </div>
        {canRaise && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> New request
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="flex gap-1">
            {[
              { key: "all", label: "All" },
              { key: "mine", label: "Mine" },
              { key: "pending", label: "Pending" },
              { key: "paid", label: "Paid" },
            ].map((t) => (
              <Button
                key={t.key}
                variant={tab === t.key ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="h-9 w-44">
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No requests yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request #</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => setDetail(r)}
                    >
                      <TableCell className="font-mono text-xs">{r.request_no}</TableCell>
                      <TableCell>
                        <span
                          className={
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium " +
                            (CATEGORY_COLORS[r.category] ?? "")
                          }
                        >
                          {CATEGORY_LABELS[r.category] ?? r.category}
                        </span>
                        {r.priority === "urgent" && (
                          <Badge className="ml-1 bg-rose-600 text-white text-[10px]">
                            URGENT
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate">{r.purpose}</TableCell>
                      <TableCell className="text-sm">{names[r.requester_id] ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatINR(r.approved_amount ?? r.amount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status as Status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(r.created_at)}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <RequestFormDialog
          initial={{
            category: search.category,
            purpose: search.purpose,
            vendor_name: search.vendor,
          }}
          onClose={() => {
            setShowForm(false);
            if (search.new)
              navigate({ to: "/payment-requests", search: {} });
          }}
          onSaved={() => {
            setShowForm(false);
            if (search.new)
              navigate({ to: "/payment-requests", search: {} });
            load();
          }}
        />
      )}

      {detail && (
        <RequestDetailDialog
          request={detail}
          requesterName={names[detail.requester_id]}
          approverName={detail.approver_id ? names[detail.approver_id] : undefined}
          payerName={detail.payer_id ? names[detail.payer_id] : undefined}
          canApprove={canApprove}
          canPay={canPay}
          onClose={() => setDetail(null)}
          onSaved={() => {
            setDetail(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function RequestFormDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial?: {
    category?: "petty_cash" | "vendor_payment" | "diesel" | "other";
    purpose?: string;
    vendor_name?: string;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState<string>(initial?.category ?? "petty_cash");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [requiredDate, setRequiredDate] = useState(todayISO());
  const [priority, setPriority] = useState("normal");
  const [notes, setNotes] = useState("");

  const [vendorName, setVendorName] = useState(initial?.vendor_name ?? "");
  const [paymentType, setPaymentType] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAcc, setBankAcc] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [upi, setUpi] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [showVendor, setShowVendor] = useState(!!initial?.vendor_name);

  const save = async () => {
    if (!user) return;
    if (!purpose.trim()) return toast.error("Purpose is required");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Amount must be positive");

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("payment_requests")
        .insert({
          category: category as never,
          requester_id: user.id,
          amount: amt,
          purpose: purpose.trim(),
          required_date: requiredDate,
          priority,
          notes: notes.trim() || null,
          vendor_name: vendorName.trim() || null,
          payment_type: paymentType || null,
          bank_name: bankName.trim() || null,
          bank_account_no: bankAcc.trim() || null,
          bank_ifsc: bankIfsc.trim() || null,
          upi_id: upi.trim() || null,
          invoice_no: invoiceNo.trim() || null,
          invoice_date: invoiceDate || null,
        } as never)
        .select("id,request_no,category")
        .single();

      if (error) throw error;
      const row = data as { id: string; request_no: string; category: string };
      await logAudit("payment_requests", "request_created", row.id, {
        category: row.category,
        amount: amt,
      });
      await notifyRole({
        role: "accounts_admin",
        type: "request_created",
        title: `New ${CATEGORY_LABELS[category]} request`,
        body: `${row.request_no} — ${formatINR(amt)}`,
        module: "payment_requests",
        entityId: row.id,
        link: "/payment-requests",
      });
      toast.success(`Request ${row.request_no} submitted`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>New payment request</DialogTitle>
          <DialogDescription>
            One form for petty cash, vendor payments, diesel and other expenses.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="petty_cash">Petty Cash</SelectItem>
                  <SelectItem value="vendor_payment">Vendor Payment</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {category === "petty_cash" && (
                <p className="text-xs text-muted-foreground">
                  Paid amount will auto-top-up your petty cash wallet.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Purpose *</Label>
              <Textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={2}
                placeholder="What is this payment for?"
              />
            </div>
            <div className="space-y-2">
              <Label>Required by</Label>
              <Input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className="rounded-md border">
            <button
              type="button"
              onClick={() => setShowVendor((s) => !s)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50"
            >
              <span>Vendor / bank details (optional)</span>
              <ChevronRight
                className={
                  "h-4 w-4 transition-transform " + (showVendor ? "rotate-90" : "")
                }
              />
            </button>
            {showVendor && (
              <div className="grid gap-3 border-t p-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Vendor name</Label>
                  <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Payment type</Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank">Bank transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bank name</Label>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Account no.</Label>
                  <Input value={bankAcc} onChange={(e) => setBankAcc(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>IFSC</Label>
                  <Input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>UPI ID</Label>
                  <Input value={upi} onChange={(e) => setUpi(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Invoice no.</Label>
                  <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Invoice date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t bg-background px-6 py-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestDetailDialog({
  request,
  requesterName,
  approverName,
  payerName,
  canApprove,
  canPay,
  onClose,
  onSaved,
}: {
  request: RequestRow;
  requesterName?: string;
  approverName?: string;
  payerName?: string;
  canApprove: boolean;
  canPay: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const [approvedAmount, setApprovedAmount] = useState(
    String(request.approved_amount ?? request.amount),
  );
  const [approvalNotes, setApprovalNotes] = useState(request.approval_notes ?? "");
  const [rejectReason, setRejectReason] = useState("");

  const [paidAmount, setPaidAmount] = useState(
    String(request.paid_amount ?? request.approved_amount ?? request.amount),
  );
  const [paymentMode, setPaymentMode] = useState(request.payment_mode ?? "cash");
  const [paymentRef, setPaymentRef] = useState(request.payment_reference ?? "");
  const [paymentNotes, setPaymentNotes] = useState(request.payment_notes ?? "");

  const isRequester = user?.id === request.requester_id;
  const notifyRequester = async (type: string, title: string, body?: string) => {
    await notifyUsers([request.requester_id], {
      type,
      title,
      body,
      module: "payment_requests",
      entityId: request.id,
      link: "/payment-requests",
    });
  };

  const approve = async () => {
    if (!user) return;
    const amt = Number(approvedAmount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter approved amount");
    if (user.id === request.requester_id)
      return toast.error("Approver cannot be the requester");
    setBusy(true);
    try {
      const { error } = await supabase
        .from("payment_requests")
        .update({
          status: "approved" as never,
          approver_id: user.id,
          approved_at: new Date().toISOString(),
          approved_amount: amt,
          approval_notes: approvalNotes.trim() || null,
        } as never)
        .eq("id", request.id);
      if (error) throw error;
      await logAudit("payment_requests", "request_approved", request.id, { amount: amt });
      await notifyRequester(
        "request_approved",
        `Approved: ${request.request_no}`,
        `${formatINR(amt)} approved`,
      );
      toast.success("Approved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!user) return;
    if (!rejectReason.trim()) return toast.error("Reason is required");
    setBusy(true);
    try {
      const { error } = await supabase
        .from("payment_requests")
        .update({
          status: "rejected" as never,
          approver_id: user.id,
          approved_at: new Date().toISOString(),
          rejected_reason: rejectReason.trim(),
        } as never)
        .eq("id", request.id);
      if (error) throw error;
      await logAudit("payment_requests", "request_rejected", request.id, {
        reason: rejectReason.trim(),
      });
      await notifyRequester(
        "request_rejected",
        `Rejected: ${request.request_no}`,
        rejectReason.trim(),
      );
      toast.success("Rejected");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reject");
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!user) return;
    const amt = Number(paidAmount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter paid amount");
    if (user.id === request.requester_id)
      return toast.error("Payer cannot be the requester");
    if (request.approver_id && user.id === request.approver_id)
      return toast.error("Payer cannot be the approver");
    setBusy(true);
    try {
      const { error } = await supabase
        .from("payment_requests")
        .update({
          status: "paid" as never,
          payer_id: user.id,
          paid_at: new Date().toISOString(),
          paid_amount: amt,
          payment_mode: paymentMode,
          payment_reference: paymentRef.trim() || null,
          payment_notes: paymentNotes.trim() || null,
        } as never)
        .eq("id", request.id);
      if (error) throw error;
      await logAudit("payment_requests", "request_paid", request.id, {
        amount: amt,
        mode: paymentMode,
      });
      await notifyRequester(
        "request_paid",
        `Paid: ${request.request_no}`,
        `${formatINR(amt)} · ${paymentMode}`,
      );
      toast.success(
        request.category === "petty_cash"
          ? "Paid — wallet topped up automatically"
          : "Marked as paid",
      );
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record payment");
    } finally {
      setBusy(false);
    }
  };

  const cancelDraft = async () => {
    if (!confirm("Delete this request?")) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("payment_requests")
        .delete()
        .eq("id", request.id);
      if (error) throw error;
      await logAudit("payment_requests", "request_deleted", request.id);
      toast.success("Deleted");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  };

  const canApproveNow = canApprove && request.status === "submitted" && !isRequester;
  const canPayNow =
    canPay &&
    request.status === "approved" &&
    !isRequester &&
    (!request.approver_id || request.approver_id !== user?.id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-sm">{request.request_no}</span>
            <span
              className={
                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium " +
                (CATEGORY_COLORS[request.category] ?? "")
              }
            >
              {CATEGORY_LABELS[request.category] ?? request.category}
            </span>
            <StatusBadge status={request.status as Status} />
          </DialogTitle>
          <DialogDescription>{request.purpose}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Field label="Amount" value={formatINR(request.amount)} />
            {request.approved_amount != null && (
              <Field label="Approved" value={formatINR(request.approved_amount)} />
            )}
            {request.paid_amount != null && (
              <Field label="Paid" value={formatINR(request.paid_amount)} />
            )}
            <Field label="Requester" value={requesterName ?? "—"} />
            <Field label="Required by" value={formatDate(request.required_date)} />
            <Field label="Priority" value={request.priority} />
            {approverName && <Field label="Approved by" value={approverName} />}
            {payerName && <Field label="Paid by" value={payerName} />}
            {request.payment_mode && <Field label="Mode" value={request.payment_mode} />}
          </div>

          {(request.vendor_name || request.invoice_no || request.bank_name || request.upi_id) && (
            <div className="rounded-md border p-3">
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Vendor / bank
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {request.vendor_name && <Field label="Vendor" value={request.vendor_name} />}
                {request.invoice_no && <Field label="Invoice" value={request.invoice_no} />}
                {request.bank_name && <Field label="Bank" value={request.bank_name} />}
                {request.bank_account_no && (
                  <Field label="Account" value={request.bank_account_no} />
                )}
                {request.bank_ifsc && <Field label="IFSC" value={request.bank_ifsc} />}
                {request.upi_id && <Field label="UPI" value={request.upi_id} />}
              </div>
            </div>
          )}

          {request.notes && (
            <div className="rounded-md border p-3 text-sm">
              <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Notes
              </div>
              {request.notes}
            </div>
          )}

          {request.rejected_reason && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm">
              <div className="mb-1 text-xs font-semibold uppercase text-rose-700">
                Rejected
              </div>
              {request.rejected_reason}
            </div>
          )}

          {canApproveNow && (
            <div className="rounded-md border p-3">
              <div className="mb-2 text-sm font-medium">Approve</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Approved amount</Label>
                  <Input
                    type="number"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Input
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={approve} disabled={busy}>
                  Approve
                </Button>
              </div>
              <div className="mt-4 border-t pt-3">
                <Label className="text-xs">Reject with reason</Label>
                <div className="flex gap-2">
                  <Input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason"
                  />
                  <Button size="sm" variant="destructive" onClick={reject} disabled={busy}>
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          )}

          {canPayNow && (
            <div className="rounded-md border p-3">
              <div className="mb-2 text-sm font-medium">Record payment</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Paid amount</Label>
                  <Input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Mode</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank">Bank transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Reference no.</Label>
                  <Input
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="UTR / cheque no."
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Input
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-3">
                <Button size="sm" onClick={pay} disabled={busy}>
                  Mark as paid
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t bg-background px-6 py-3">
          {isRequester && request.status === "submitted" && (
            <Button variant="destructive" onClick={cancelDraft} disabled={busy}>
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
