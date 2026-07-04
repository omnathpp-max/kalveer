import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MODULE_ACCESS, canAccess, type ModuleKey } from "@/lib/access";

export function AccessGuard({
  module,
  children,
}: {
  module: ModuleKey;
  children: ReactNode;
}) {
  const { roles, permissions, loading } = useAuth();
  if (loading) return null;

  const allowed = canAccess(MODULE_ACCESS[module], { roles, permissions });
  if (allowed) return <>{children}</>;

  return (
    <div className="mx-auto max-w-lg py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" aria-hidden="true" />
            Access restricted
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            You don&apos;t have permission to view this page. Ask a super admin
            to grant you access from Users &amp; Permissions.
          </p>
          <Button asChild variant="outline">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
