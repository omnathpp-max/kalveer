import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Wallet, ArrowDownCircle, ArrowUpCircle, Package, Loader2 } from "lucide-react";
import { formatINR, formatDate, todayISO, toCSV, downloadFile } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/my-petty-cash")({
  component: MyPettyCashPage,
});

interface Entry {
  id: string;
  user_id: string;
  entry_type: "auto_top_up" | "manual_top_up" | "expense";
  direction: "in" | "out";
  amount: number;
  entry_date: string;
  expense_head_id: string | null;
  vendor_or_person: string | null;
  remarks: string | null;
  attachment_url: string | null;
  request_id: string | null;
  inventory_item_id: string | null;
  qty: number | null;
  is_voided: boolean;
  created_at: string;
}

interface Head {
  id: string;
  name: string;
  tracks_inventory: boolean;
  is_active: boolean;
  sort_order: number;
}

interface Item {
  id: string;
  name: string;
  unit: string;
  reorder_level: number;
  is_active: boolean;
}

function MyPettyCashPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [heads, setHeads] = useState<Head[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExpense, setShowExpense] = useState(false);
  const [reorderAlert, setReorderAlert] = useState<
    { item: Item; balance: number } | null
  >(null);

  const [filterHead, setFilterHead] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: e }, { data: h }, { data: it }] = await Promise.all([
      supabase
        .from("petty_cash_wallet_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("expense_heads")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("inventory_items").select("*").eq("is_active", true).order("name"),
    ]);
    setEntries((e ?? []) as Entry[]);
    setHeads((h ?? []) as Head[]);
    setItems((it ?? []) as Item[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const balance = useMemo(
    () =>
      entries
        .filter((e) => !e.is_voided)
        .reduce((s, e) => s + (e.direction === "in" ? Number(e.amount) : -Number(e.amount)), 0),
    [entries],
  );

  const totals = useMemo(() => {
    const live = entries.filter((e) => !e.is_voided);
    return {
      topUps: live.filter((e) => e.direction === "in").reduce((s, e) => s + Number(e.amount), 0),
      expenses: live.filter((e) => e.direction === "out").reduce((s, e) => s + Number(e.amount), 0),
    };
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterHead !== "all" && e.expense_head_id !== filterHead) return false;
      if (from && e.entry_date < from) return false;
      if (to && e.entry_date > to) return false;
      return true;
    });
  }, [entries, filterHead, from, to]);

  const headById = useMemo(() => {
    const m: Record<string, Head> = {};
    for (const h of heads) m[h.id] = h;
    return m;
  }, [heads]);
  const itemById = useMemo(() => {
    const m: Record<string, Item> = {};
    for (const i of items) m[i.id] = i;
    return m;
  }, [items]);

  const exportCsv = () => {
    downloadFile(
      `my-petty-cash-${todayISO()}.csv`,
      toCSV(
        filtered.map((e) => ({
          date: e.entry_date,
          type: e.entry_type,
          direction: e.direction,
          amount: e.amount,
          head: e.expense_head_id ? headById[e.expense_head_id]?.name ?? "" : "",
          item: e.inventory_item_id ? itemById[e.inventory_item_id]?.name ?? "" : "",
          qty: e.qty ?? "",
          vendor_or_person: e.vendor_or_person ?? "",
          remarks: e.remarks ?? "",
          voided: e.is_voided ? "yes" : "",
        })),
        ["date", "type", "direction", "amount", "head", "item", "qty", "vendor_or_person", "remarks", "voided"],
      ),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Petty Cash</h1>
          <p className="text-sm text-muted-foreground">
            Track your top-ups and expenses. Balance updates live.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            Export CSV
          </Button>
          <Button onClick={() => setShowExpense(true)} disabled={balance <= 0}>
            <Plus className="mr-2 h-4 w-4" /> Add expense
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-primary/40">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <Wallet className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Current balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={"text-3xl font-semibold " + (balance > 0 ? "text-emerald-600" : "text-muted-foreground")}>
              {formatINR(balance)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-sm">Total top-ups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatINR(totals.topUps)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <ArrowUpCircle className="h-4 w-4 text-rose-600" />
            <CardTitle className="text-sm">Total expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatINR(totals.expenses)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="grid gap-1">
            <Label className="text-xs">Expense head</Label>
            <Select value={filterHead} onValueChange={setFilterHead}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All heads</SelectItem>
                {heads.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </div>
          {(filterHead !== "all" || from || to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterHead("all");
                setFrom("");
                setTo("");
              }}
            >
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No entries yet. Once you have a paid Petty Cash request, your wallet will top up automatically.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Head / Item</TableHead>
                    <TableHead>Vendor / Person</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id} className={e.is_voided ? "opacity-50" : ""}>
                      <TableCell className="text-sm">{formatDate(e.entry_date)}</TableCell>
                      <TableCell>
                        {e.entry_type === "auto_top_up" && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                            Auto top-up
                          </Badge>
                        )}
                        {e.entry_type === "manual_top_up" && (
                          <Badge className="bg-sky-100 text-sky-800 border-sky-200">
                            Manual top-up
                          </Badge>
                        )}
                        {e.entry_type === "expense" && (
                          <Badge variant="outline">Expense</Badge>
                        )}
                        {e.is_voided && (
                          <Badge variant="outline" className="ml-1">
                            Voided
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.expense_head_id ? headById[e.expense_head_id]?.name : "—"}
                        {e.inventory_item_id && (
                          <div className="text-xs text-muted-foreground">
                            {itemById[e.inventory_item_id]?.name} · {e.qty}{" "}
                            {itemById[e.inventory_item_id]?.unit}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{e.vendor_or_person ?? "—"}</TableCell>
                      <TableCell
                        className={
                          "text-right font-medium " +
                          (e.direction === "in" ? "text-emerald-700" : "text-rose-700")
                        }
                      >
                        {e.direction === "in" ? "+" : "−"} {formatINR(e.amount)}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                        {e.remarks ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {showExpense && user && (
        <ExpenseFormDialog
          userId={user.id}
          heads={heads}
          items={items}
          balance={balance}
          onClose={() => setShowExpense(false)}
          onSaved={(alert) => {
            setShowExpense(false);
            if (alert) setReorderAlert(alert);
            load();
          }}
        />
      )}

      {reorderAlert && (
        <ReorderAlertDialog
          item={reorderAlert.item}
          balance={reorderAlert.balance}
          onClose={() => setReorderAlert(null)}
        />
      )}
    </div>
  );
}

function ExpenseFormDialog({
  userId,
  heads,
  items,
  balance,
  onClose,
  onSaved,
}: {
  userId: string;
  heads: Head[];
  items: Item[];
  balance: number;
  onClose: () => void;
  onSaved: (alert?: { item: Item; balance: number } | null) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [headId, setHeadId] = useState<string>(heads[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayISO());
  const [vendorOrPerson, setVendorOrPerson] = useState("");
  const [remarks, setRemarks] = useState("");
  const [itemId, setItemId] = useState<string>("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("pcs");
  const [newItemReorder, setNewItemReorder] = useState("0");
  const [qty, setQty] = useState("");

  const head = heads.find((h) => h.id === headId);
  const showInventory = !!head?.tracks_inventory;

  const save = async () => {
    if (!headId) return toast.error("Select an expense head");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Amount must be positive");
    if (amt > balance) return toast.error(`Not enough balance (${formatINR(balance)})`);

    let effectiveItemId = itemId;

    setSaving(true);
    try {
      if (showInventory && itemId === "__new__") {
        if (!newItemName.trim()) throw new Error("Item name is required");
        const { data: newItem, error: itemErr } = await supabase
          .from("inventory_items")
          .insert({
            name: newItemName.trim(),
            unit: newItemUnit.trim() || "pcs",
            reorder_level: Number(newItemReorder) || 0,
          } as never)
          .select("id")
          .single();
        if (itemErr) throw itemErr;
        effectiveItemId = (newItem as { id: string }).id;
      }

      const qtyNum = showInventory && qty ? Number(qty) : null;

      const { data: entry, error } = await supabase
        .from("petty_cash_wallet_entries")
        .insert({
          user_id: userId,
          entry_type: "expense" as never,
          direction: "out",
          amount: amt,
          entry_date: entryDate,
          expense_head_id: headId,
          vendor_or_person: vendorOrPerson.trim() || null,
          remarks: remarks.trim() || null,
          inventory_item_id: showInventory && effectiveItemId && effectiveItemId !== "__new__" ? effectiveItemId : null,
          qty: qtyNum,
          created_by: userId,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      // Record inventory movement if applicable
      let alert: { item: Item; balance: number } | null = null;
      if (showInventory && effectiveItemId && effectiveItemId !== "__new__" && qtyNum) {
        const { error: movErr } = await supabase.from("inventory_movements").insert({
          item_id: effectiveItemId,
          movement_type: "purchase" as never,
          qty: qtyNum,
          entry_id: (entry as { id: string }).id,
          created_by: userId,
        } as never);
        if (movErr) throw movErr;

        // Check balance for reorder alert (client-side, mirrors trigger)
        const { data: bal } = await supabase
          .from("inventory_balances")
          .select("balance")
          .eq("item_id", effectiveItemId)
          .maybeSingle();
        const item = items.find((i) => i.id === effectiveItemId);
        const b = Number((bal as { balance?: number } | null)?.balance ?? 0);
        if (item && item.reorder_level > 0 && b <= Number(item.reorder_level)) {
          alert = { item, balance: b };
        }
      }

      await logAudit("petty_cash_wallet", "expense_added", (entry as { id: string }).id, {
        amount: amt,
        head: head?.name,
      });
      toast.success("Expense recorded");
      onSaved(alert);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Add expense</DialogTitle>
          <DialogDescription>
            Available balance: <span className="font-medium">{formatINR(balance)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Expense head *</Label>
              <Select value={headId} onValueChange={setHeadId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {heads.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                      {h.tracks_inventory && (
                        <span className="ml-2 text-xs text-muted-foreground">(stock)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Vendor / person</Label>
              <Input
                value={vendorOrPerson}
                onChange={(e) => setVendorOrPerson(e.target.value)}
                placeholder="Who did you pay?"
              />
            </div>

            {showInventory && (
              <div className="space-y-2 sm:col-span-2 rounded-md border p-3">
                <div className="text-sm font-medium">Stock item (optional)</div>
                <Select value={itemId} onValueChange={setItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select or add new" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} ({i.unit})
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__">+ Add new item</SelectItem>
                  </SelectContent>
                </Select>
                {itemId === "__new__" && (
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Name"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="col-span-1"
                    />
                    <Input
                      placeholder="Unit"
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Reorder lvl"
                      value={newItemReorder}
                      onChange={(e) => setNewItemReorder(e.target.value)}
                    />
                  </div>
                )}
                {itemId && (
                  <div>
                    <Label className="text-xs">Quantity purchased</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 sm:col-span-2">
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t bg-background px-6 py-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReorderAlertDialog({
  item,
  balance,
  onClose,
}: {
  item: Item;
  balance: number;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <Package className="h-5 w-5" />
            Low stock alert
          </DialogTitle>
          <DialogDescription>
            Stock of <span className="font-semibold text-foreground">{item.name}</span> has reached
            re-order level.
            <br />
            Current: {balance} {item.unit}. Re-order level: {item.reorder_level} {item.unit}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose}>
            Ignore
          </Button>
          <Button asChild>
            <Link
              to="/payment-requests"
              search={{
                new: "1",
                category: "vendor_payment",
                purpose: `Purchase ${item.name} — restock`,
                vendor: "",
              }}
            >
              Create Purchase Request
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
