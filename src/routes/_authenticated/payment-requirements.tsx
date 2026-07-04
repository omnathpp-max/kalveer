import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/payment-requirements")({
  component: () => (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Payment Requirements</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming in Phase 3</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Vendor payment requests, approvals, payment processing with proof upload, and
          vendor-wise reports.
        </CardContent>
      </Card>
    </div>
  ),
});
