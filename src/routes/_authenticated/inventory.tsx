import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Loader2, Package, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
});

interface Item {
  id: string;
  name: string;
  unit: string;
  reorder_level: number;
  is_active: boolean;
  notes: string | null;
}

interface BalanceRow {
  item_id: string;
  balance: number;
}

interface Movement {
  id: string;
  item_id: string;
  movement_type: string;
  qty: number;
  notes: string | null;
  created_at: string;
}

function InventoryPage() {
  const { user, hasRole, isAnyAdmin } = useAuth();
  const canManage = isAnyAdmin || hasRole("super_admin");

  const [items, setItems] = useState<Item[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [consumeFor, setConsumeFor] = useState<Item | null>(null);
  const [historyFor, setHistoryFor] = useState<Item | null>(null);
  const [lowOnly, setLowOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: its }, { data: bals }] = await Promise.all([
      supabase.from("inventory_items").select("*").order("name"),
      supabase.from("inventory_balances").select("item_id,balance"),
    ]);
    setItems((its ?? []) as Item[]);
    const b: Record<string, number> = {};
    for (const r of (bals ?? []) as BalanceRow[]) b[r.item_id] = Number(r.balance);
    setBalances(b);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => {
    return items.filter((i) => {
      const bal = balances[i.id] ?? 0;
      const isLow = i.reorder_level > 0 && bal <= Number(i.reorder_level);
      if (lowOnly && !isLow) return false;
      return true;
    });
  }, [items, balances, lowOnly]);

  const lowCount = items.filter(
    (i) => i.is_active && i.reorder_level > 0 && (balances[i.id] ?? 0) <= Number(i.reorder_level),
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Company-wide stock items and reorder levels.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={lowOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setLowOnly((v) => !v)}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Low stock ({lowCount})
          </Button>
          {canManage && (
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add item
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : shown.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {lowOnly ? "No items at or below reorder level." : "No items yet. Purchases via Groceries/Fuel/Equipment/Stationery expense heads will add items here."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Reorder level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((i) => {
                    const bal = balances[i.id] ?? 0;
                    const isLow = i.reorder_level > 0 && bal <= Number(i.reorder_level);
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{i.unit}</TableCell>
                        <TableCell className="text-right font-semibold">{bal}</TableCell>
                        <TableCell className="text-right text-sm">
                          {i.reorder_level > 0 ? i.reorder_level : "—"}
                        </TableCell>
                        <TableCell>
                          {!i.is_active ? (
                            <Badge variant="outline">Inactive</Badge>
                          ) : isLow ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                              Low stock
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                              OK
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setHistoryFor(i)}
                            >
                              History
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConsumeFor(i)}
                            >
                              Consume
                            </Button>
                            {isLow && (
                              <Button asChild size="sm">
                                <Link
                                  to="/payment-requests"
                                  search={{
                                    new: "1",
                                    category: "vendor_payment",
                                    purpose: `Purchase ${i.name} — restock`,
                                  }}
                                >
                                  Reorder
                                </Link>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {showAdd && user && (
        <AddItemDialog
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}

      {consumeFor && user && (
        <ConsumeDialog
          item={consumeFor}
          balance={balances[consumeFor.id] ?? 0}
          createdBy={user.id}
          onClose={() => setConsumeFor(null)}
          onSaved={() => {
            setConsumeFor(null);
            load();
          }}
        />
      )}

      {historyFor && (
        <HistoryDialog item={historyFor} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  );
}

function AddItemDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [reorder, setReorder] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .insert({
          name: name.trim(),
          unit: unit.trim() || "pcs",
          reorder_level: Number(reorder) || 0,
          notes: notes.trim() || null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      await logAudit("inventory", "item_added", (data as { id: string }).id, { name });
      toast.success("Item added");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Add inventory item
          </DialogTitle>
          <DialogDescription>
            Shared across the whole company.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cement" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="bags, litres…" />
            </div>
            <div className="space-y-2">
              <Label>Reorder level</Label>
              <Input
                type="number"
                min="0"
                value={reorder}
                onChange={(e) => setReorder(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConsumeDialog({
  item,
  balance,
  createdBy,
  onClose,
  onSaved,
}: {
  item: Item;
  balance: number;
  createdBy: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) return toast.error("Enter quantity");
    if (q > balance) return toast.error(`Only ${balance} ${item.unit} available`);
    setSaving(true);
    try {
      const { error } = await supabase.from("inventory_movements").insert({
        item_id: item.id,
        movement_type: "consumption" as never,
        qty: q,
        notes: notes.trim() || null,
        created_by: createdBy,
      } as never);
      if (error) throw error;
      await logAudit("inventory", "consumed", item.id, { qty: q });
      toast.success(`Consumed ${q} ${item.unit}`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Record consumption</DialogTitle>
          <DialogDescription>
            {item.name} — available: {balance} {item.unit}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Quantity ({item.unit})</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const [rows, setRows] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("inventory_movements")
        .select("*")
        .eq("item_id", item.id)
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data ?? []) as Movement[]);
      setLoading(false);
    })();
  }, [item.id]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{item.name} — history</DialogTitle>
          <DialogDescription>Purchases and consumption events</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No movements yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty ({item.unit})</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{formatDate(r.created_at)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          r.movement_type === "purchase"
                            ? "bg-emerald-50 text-emerald-800"
                            : r.movement_type === "consumption"
                              ? "bg-rose-50 text-rose-800"
                              : "bg-sky-50 text-sky-800"
                        }
                      >
                        {r.movement_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {r.movement_type === "consumption" ? "−" : "+"}
                      {r.qty}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
