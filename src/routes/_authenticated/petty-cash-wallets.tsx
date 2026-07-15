import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AccessGuard } from "@/components/access-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { formatINR, formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Loader2, WalletCards } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/petty-cash-wallets")({
  component: () => (
    <AccessGuard module="petty_cash_wallets">
      <WalletsPage />
    </AccessGuard>
  ),
});

interface Balance {
  user_id: string;
  full_name: string;
  email: string | null;
  balance: number;
  last_activity: string | null;
}

function WalletsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpFor, setTopUpFor] = useState<Balance | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("petty_cash_wallet_balances")
      .select("*")
      .order("balance", { ascending: false });
    setRows((data ?? []) as Balance[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const total = rows.reduce((s, r) => s + Number(r.balance || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Petty Cash Wallets</h1>
          <p className="text-sm text-muted-foreground">
            View every user's petty cash wallet, balance, and activity.
          </p>
        </div>
      </div>

      <Card className="border-primary/40">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <WalletCards className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Total cash across all wallets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold">{formatINR(total)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Last activity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.user_id}>
                      <TableCell className="font-medium">{r.full_name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatINR(r.balance)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.last_activity ? formatDate(r.last_activity) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTopUpFor(r)}
                            disabled={r.user_id === user?.id}
                          >
                            <Plus className="mr-1 h-3 w-3" /> Manual top-up
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link to="/petty-cash-wallets/$userId" params={{ userId: r.user_id }}>
                              View
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {topUpFor && user && (
        <ManualTopUpDialog
          target={topUpFor}
          createdBy={user.id}
          onClose={() => setTopUpFor(null)}
          onSaved={() => {
            setTopUpFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ManualTopUpDialog({
  target,
  createdBy,
  onClose,
  onSaved,
}: {
  target: Balance;
  createdBy: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayISO());
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter amount");
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("petty_cash_wallet_entries")
        .insert({
          user_id: target.user_id,
          entry_type: "manual_top_up" as never,
          direction: "in",
          amount: amt,
          entry_date: entryDate,
          remarks: remarks.trim() || null,
          created_by: createdBy,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      await logAudit("petty_cash_wallet", "manual_top_up", (data as { id: string }).id, {
        user_id: target.user_id,
        amount: amt,
      });
      toast.success(`Topped up ${target.full_name}'s wallet`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to top up");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Manual top-up</DialogTitle>
          <DialogDescription>
            Add cash to <span className="font-medium">{target.full_name}</span>'s wallet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
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
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add top-up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
