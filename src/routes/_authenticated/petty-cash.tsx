import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/petty-cash")({
  component: () => <Placeholder title="Petty Cash" phase="Phase 2" />,
});

function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming in {phase}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Requests, ledger, denominations, reports and PDF/CSV export — built on top of the
          foundation you just approved. Approve Phase 2 to have this module built.
        </CardContent>
      </Card>
    </div>
  );
}
