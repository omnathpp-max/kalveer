import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/reports")({
  component: () => (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming in Phase 5</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Daily / weekly / monthly / custom-range reports across all modules, with PDF and CSV
          export in a print-friendly layout that matches your existing paper forms.
        </CardContent>
      </Card>
    </div>
  ),
});
