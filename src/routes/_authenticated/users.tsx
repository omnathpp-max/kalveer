import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  ROLE_ORDER,
  type AppRole,
  type PermissionKey,
} from "@/lib/permissions";
import { Settings2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

interface UserRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  site: string | null;
  is_active: boolean;
  roles: AppRole[];
  permissions: Set<PermissionKey>;
}

function UsersPage() {
  const { hasRole } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const canManage = hasRole("super_admin");

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: perms }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_permissions").select("user_id, permission, enabled"),
    ]);
    const rolesByUser = new Map<string, AppRole[]>();
    ((roles ?? []) as { user_id: string; role: AppRole }[]).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    const permsByUser = new Map<string, Set<PermissionKey>>();
    ((perms ?? []) as { user_id: string; permission: PermissionKey; enabled: boolean }[]).forEach(
      (p) => {
        if (!p.enabled) return;
        const s = permsByUser.get(p.user_id) ?? new Set<PermissionKey>();
        s.add(p.permission);
        permsByUser.set(p.user_id, s);
      },
    );
    setRows(
      ((profiles ?? []) as Array<{
        id: string;
        full_name: string;
        email: string | null;
        phone: string | null;
        department: string | null;
        site: string | null;
        is_active: boolean;
      }>).map((p) => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
        permissions: permsByUser.get(p.id) ?? new Set<PermissionKey>(),
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users & Permissions</h1>
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "Assign roles and toggle module permissions for each team member."
              : "Read-only view."}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-sm">{u.email ?? "—"}</TableCell>
                      <TableCell className="text-sm">{u.phone ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 ? (
                            <Badge variant="outline">No role</Badge>
                          ) : (
                            u.roles.map((r) => (
                              <Badge key={r} variant="secondary" className="text-xs">
                                {ROLE_LABELS[r]}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.is_active ? (
                          <Badge className="bg-emerald-600 text-white">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(u)}
                            aria-label="Manage user"
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <ManageUserDialog
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ManageUserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<AppRole>(user.roles[0] ?? "worker");
  const [active, setActive] = useState(user.is_active);
  const [permState, setPermState] = useState<Record<PermissionKey, boolean>>(
    useMemo(() => {
      const o = {} as Record<PermissionKey, boolean>;
      PERMISSION_KEYS.forEach((k) => (o[k] = user.permissions.has(k)));
      return o;
    }, [user]),
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      // update profile active
      await supabase.from("profiles").update({ is_active: active }).eq("id", user.id);

      // replace roles: delete existing, insert chosen
      await supabase.from("user_roles").delete().eq("user_id", user.id);
      await supabase.from("user_roles").insert({ user_id: user.id, role });

      // upsert permissions
      const perms = PERMISSION_KEYS.map((p) => ({
        user_id: user.id,
        permission: p,
        enabled: permState[p],
      }));
      // delete + insert to keep it simple
      await supabase.from("user_permissions").delete().eq("user_id", user.id);
      await supabase.from("user_permissions").insert(perms);

      await supabase.from("audit_logs").insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        module: "users",
        action: "user_updated",
        entity_id: user.id,
        details: { role, active, permissions: permState },
      });

      toast.success("User updated");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg flex-col gap-0 p-0 sm:w-full">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Manage {user.full_name || "user"}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_ORDER.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Account active</div>
              <div className="text-xs text-muted-foreground">
                Inactive users cannot access the app.
              </div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Permissions</div>
            <div className="rounded-md border">
              {PERMISSION_KEYS.map((p, i) => (
                <div
                  key={p}
                  className={`flex items-center justify-between gap-3 p-3 ${i > 0 ? "border-t" : ""}`}
                >
                  <div className="min-w-0 text-sm">{PERMISSION_LABELS[p]}</div>
                  <Switch
                    checked={permState[p]}
                    onCheckedChange={(v) => setPermState((s) => ({ ...s, [p]: v }))}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Super admins bypass individual permissions and can do everything.
            </p>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t bg-background px-6 py-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  );
}
