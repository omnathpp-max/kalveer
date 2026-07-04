import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/settings")({
  component: () => (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Notification & report settings</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Weekly and monthly email report recipients and timing will land here in Phase 6.
        </CardContent>
      </Card>
    </div>
  ),
});
