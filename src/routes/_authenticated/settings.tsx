import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

/* -------------------------------------------------------------------------- */

interface AppSettings {
  id: string;
  company_name: string;
  address: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
}

interface Category {
  id: string;
  kind: "petty_cash" | "payment";
  name: string;
  sort_order: number;
  is_active: boolean;
}

function SettingsPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("super_admin");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Company profile and category lists used across the app.
          {!canEdit && " Only super admins can make changes."}
        </p>
      </div>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="petty_cash">Petty Cash Categories</TabsTrigger>
          <TabsTrigger value="payment">Payment Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <CompanyProfile canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="petty_cash" className="mt-4">
          <CategoryEditor kind="petty_cash" canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="payment" className="mt-4">
          <CategoryEditor kind="payment" canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Company Profile                                                            */
/* -------------------------------------------------------------------------- */

function CompanyProfile({ canEdit }: { canEdit: boolean }) {
  const { user } = useAuth();
  const [row, setRow] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [currency, setCurrency] = useState("INR");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("*")
        .maybeSingle();
      if (data) {
        const r = data as AppSettings;
        setRow(r);
        setCompanyName(r.company_name);
        setAddress(r.address ?? "");
        setGstin(r.gstin ?? "");
        setPhone(r.phone ?? "");
        setEmail(r.email ?? "");
        setCurrency(r.currency);
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!row || !user) return;
    if (!companyName.trim()) return toast.error("Company name is required");
    setSaving(true);
    const patch = {
      company_name: companyName.trim(),
      address: address.trim() || null,
      gstin: gstin.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      currency: currency.trim() || "INR",
      updated_by: user.id,
    };
    const { error } = await supabase
      .from("app_settings")
      .update(patch as never)
      .eq("id", row.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit("settings", "company_profile_updated", row.id, patch);
    toast.success("Company profile saved");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company profile</CardTitle>
        <CardDescription>
          Shown on printed reports and exports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Company name</Label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={5}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>GSTIN</Label>
            <Input
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              disabled={!canEdit}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Address</Label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              disabled={!canEdit}
            />
          </div>
        </div>
        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

function CategoryEditor({
  kind,
  canEdit,
}: {
  kind: "petty_cash" | "payment";
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("kind", kind)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Category[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [kind]);

  async function addRow() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const nextOrder = (rows[rows.length - 1]?.sort_order ?? 0) + 10;
    const { error } = await supabase.from("categories").insert({
      kind,
      name,
      sort_order: nextOrder,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    await logAudit("settings", "category_added", null, { kind, name });
    setNewName("");
    await load();
  }

  async function updateRow(id: string, patch: Partial<Category>) {
    setBusy(true);
    const { error } = await supabase
      .from("categories")
      .update(patch as never)
      .eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await load();
  }

  async function deleteRow(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    setBusy(true);
    const { error } = await supabase.from("categories").delete().eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await logAudit("settings", "category_deleted", id, { kind, name });
    await load();
  }

  async function move(idx: number, dir: -1 | 1) {
    const a = rows[idx];
    const b = rows[idx + dir];
    if (!a || !b) return;
    setBusy(true);
    // swap sort_order values
    await supabase
      .from("categories")
      .update({ sort_order: b.sort_order } as never)
      .eq("id", a.id);
    await supabase
      .from("categories")
      .update({ sort_order: a.sort_order } as never)
      .eq("id", b.id);
    setBusy(false);
    await load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {kind === "petty_cash" ? "Petty cash categories" : "Payment categories"}
        </CardTitle>
        <CardDescription>
          Reorder, rename, deactivate or add new options.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label>New category</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addRow();
                }}
                placeholder="e.g. Blasting"
              />
            </div>
            <Button onClick={addRow} disabled={busy || !newName.trim()}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            No categories yet.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Order</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-24">Active</TableHead>
                  {canEdit && <TableHead className="w-32 text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, idx) => (
                  <CategoryRow
                    key={r.id}
                    row={r}
                    canEdit={canEdit}
                    canUp={idx > 0}
                    canDown={idx < rows.length - 1}
                    busy={busy}
                    onSave={(patch) => updateRow(r.id, patch)}
                    onDelete={() => deleteRow(r.id, r.name)}
                    onMoveUp={() => move(idx, -1)}
                    onMoveDown={() => move(idx, 1)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryRow({
  row,
  canEdit,
  canUp,
  canDown,
  busy,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  row: Category;
  canEdit: boolean;
  canUp: boolean;
  canDown: boolean;
  busy: boolean;
  onSave: (patch: Partial<Category>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [name, setName] = useState(row.name);
  const dirty = name.trim() !== row.name && name.trim().length > 0;

  useEffect(() => {
    setName(row.name);
  }, [row.name]);

  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{row.sort_order}</TableCell>
      <TableCell>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!canEdit}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={row.is_active}
          onCheckedChange={(v) => onSave({ is_active: v })}
          disabled={!canEdit || busy}
        />
      </TableCell>
      {canEdit && (
        <TableCell>
          <div className="flex items-center justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={onMoveUp}
              disabled={!canUp || busy}
              className="h-8 w-8"
              title="Move up"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onMoveDown}
              disabled={!canDown || busy}
              className="h-8 w-8"
              title="Move down"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            {dirty && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onSave({ name: name.trim() })}
                disabled={busy}
                className="h-8 w-8 text-primary"
                title="Save"
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              disabled={busy}
              className="h-8 w-8 text-destructive"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
