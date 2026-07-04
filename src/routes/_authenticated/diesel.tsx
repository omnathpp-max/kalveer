import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/diesel")({
  component: () => (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Diesel</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming in Phase 4</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Daily diesel report, machine-wise consumption (excavators, compressors, vehicles),
          operator-wise usage and trend charts.
        </CardContent>
      </Card>
    </div>
  ),
});
