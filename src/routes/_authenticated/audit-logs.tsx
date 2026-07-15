import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import { toCSV, downloadFile } from "@/lib/format";
import { Download, Search } from "lucide-react";

import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/_authenticated/audit-logs")({
  component: () => (
    <AccessGuard module="audit_logs">
      <AuditLogsPage />
    </AccessGuard>
  ),
});

interface LogRow {
  id: string;
  action: string;
  module: string;
  user_id: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const MODULES = ["all", "auth", "payment_requests", "petty_cash_wallet", "inventory", "diesel", "users", "settings"];

function AuditLogsPage() {
  const { isAnyAdmin, hasPermission } = useAuth();
  const canExport = hasPermission("export_reports");
  const [rows, setRows] = useState<LogRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!isAnyAdmin) return;
    (async () => {
      setLoading(true);
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (module !== "all") query = query.eq("module", module);
      const { data } = await query;
      const logs = (data as unknown as LogRow[]) ?? [];
      setRows(logs);

      const userIds = Array.from(new Set(logs.map((r) => r.user_id).filter(Boolean))) as string[];
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", userIds);
        const map: Record<string, string> = {};
        for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
          map[p.id] = p.full_name;
        }
        setProfiles(map);
      }
      setLoading(false);
    })();
  }, [isAnyAdmin, module]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.action.toLowerCase().includes(needle) ||
        r.module.toLowerCase().includes(needle) ||
        (r.user_id && (profiles[r.user_id] ?? "").toLowerCase().includes(needle)),
    );
  }, [rows, q, profiles]);

  const exportCsv = () => {
    downloadFile(
      `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(
        filtered.map((r) => ({
          time: r.created_at,
          module: r.module,
          action: r.action,
          user: r.user_id ? (profiles[r.user_id] ?? r.user_id) : "system",
          entity_id: r.entity_id ?? "",
          details: r.details ? JSON.stringify(r.details) : "",
        })),
        ["time", "module", "action", "user", "entity_id", "details"],
      ),
    );
  };

  if (!isAnyAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You don't have permission to view audit logs.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            Every approval, payment, edit and login is recorded here.
          </p>
        </div>
        {canExport && (
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select value={module} onValueChange={setModule}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODULES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m === "all" ? "All modules" : m.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search action, user…"
              className="pl-8"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {filtered.length} of {rows.length}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No matching activity.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Time</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(r.created_at), "dd MMM yyyy, HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {r.module}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.action}</TableCell>
                      <TableCell className="text-xs">
                        {r.user_id ? (profiles[r.user_id] ?? r.user_id.slice(0, 8)) : "system"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {r.details ? JSON.stringify(r.details) : "—"}
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
