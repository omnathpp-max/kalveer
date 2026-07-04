import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/audit-logs")({
  component: AuditLogsPage,
});

interface LogRow {
  id: string;
  action: string;
  module: string;
  user_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

function AuditLogsPage() {
  const { isAnyAdmin } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAnyAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data as unknown as LogRow[]) ?? []);
      setLoading(false);
    })();
  }, [isAnyAdmin]);

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
      <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No activity yet. Actions across every module will appear here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(r.created_at), "dd MMM yyyy, HH:mm")}
                    </TableCell>
                    <TableCell className="text-xs">{r.module}</TableCell>
                    <TableCell className="text-xs">{r.action}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.user_id?.slice(0, 8) ?? "system"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
