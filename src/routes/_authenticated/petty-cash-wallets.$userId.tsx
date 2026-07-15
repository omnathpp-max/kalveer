import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AccessGuard } from "@/components/access-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Loader2, Wallet } from "lucide-react";
import { formatINR, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/petty-cash-wallets/$userId")({
  component: () => (
    <AccessGuard module="petty_cash_wallets">
      <WalletDetailPage />
    </AccessGuard>
  ),
});

interface Entry {
  id: string;
  entry_type: string;
  direction: string;
  amount: number;
  entry_date: string;
  vendor_or_person: string | null;
  remarks: string | null;
  expense_head_id: string | null;
  inventory_item_id: string | null;
  qty: number | null;
  is_voided: boolean;
}

interface Profile {
  id: string;
  full_name: string;
  email: string | null;
}

function WalletDetailPage() {
  const { userId } = useParams({ from: "/_authenticated/petty-cash-wallets/$userId" });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [heads, setHeads] = useState<Record<string, string>>({});
  const [items, setItems] = useState<Record<string, { name: string; unit: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: prof }, { data: e }, { data: h }, { data: it }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email").eq("id", userId).maybeSingle(),
        supabase
          .from("petty_cash_wallet_entries")
          .select("*")
          .eq("user_id", userId)
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("expense_heads").select("id,name"),
        supabase.from("inventory_items").select("id,name,unit"),
      ]);
      setProfile((prof as Profile | null) ?? null);
      setEntries((e ?? []) as Entry[]);
      const hm: Record<string, string> = {};
      for (const x of (h ?? []) as Array<{ id: string; name: string }>) hm[x.id] = x.name;
      setHeads(hm);
      const im: Record<string, { name: string; unit: string }> = {};
      for (const x of (it ?? []) as Array<{ id: string; name: string; unit: string }>)
        im[x.id] = { name: x.name, unit: x.unit };
      setItems(im);
      setLoading(false);
    })();
  }, [userId]);

  const balance = useMemo(
    () =>
      entries
        .filter((e) => !e.is_voided)
        .reduce((s, e) => s + (e.direction === "in" ? Number(e.amount) : -Number(e.amount)), 0),
    [entries],
  );

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/petty-cash-wallets">
          <ChevronLeft className="mr-1 h-4 w-4" /> All wallets
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile?.full_name ?? "Wallet"}
        </h1>
        <p className="text-sm text-muted-foreground">{profile?.email}</p>
      </div>

      <Card className="border-primary/40">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <Wallet className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Current balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold">{formatINR(balance)}</div>
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
          ) : entries.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No entries yet.
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
                  {entries.map((e) => (
                    <TableRow key={e.id} className={e.is_voided ? "opacity-50" : ""}>
                      <TableCell className="text-sm">{formatDate(e.entry_date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{e.entry_type.replace(/_/g, " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.expense_head_id ? heads[e.expense_head_id] : "—"}
                        {e.inventory_item_id && items[e.inventory_item_id] && (
                          <div className="text-xs text-muted-foreground">
                            {items[e.inventory_item_id].name} · {e.qty}{" "}
                            {items[e.inventory_item_id].unit}
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
    </div>
  );
}
