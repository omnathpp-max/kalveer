import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportError } from "../lib/report-error";
import { RouteErrorBoundary } from "../components/route-boundaries";
import { Toaster } from "../components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Kalveer Quarry Operations" },
      {
        name: "description",
        content:
          "Kalveer Exports quarry operations — petty cash, payment approvals, diesel reports and audit trail.",
      },
      { property: "og:title", content: "Kalveer Quarry Operations" },
      {
        property: "og:description",
        content: "Petty cash, payment approvals, diesel tracking and reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Kalveer Quarry Operations" },
      { name: "description", content: "Kalveer Exports quarry operations — petty cash, payment approvals, diesel reports and audit trail." },
      { property: "og:description", content: "Kalveer Exports quarry operations — petty cash, payment approvals, diesel reports and audit trail." },
      { name: "twitter:description", content: "Kalveer Exports quarry operations — petty cash, payment approvals, diesel reports and audit trail." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2f839a06-af85-43d9-867f-dae2f1f4526f/id-preview-437b4a2a--8892ddc8-a682-4802-8292-b3e034e3862f.lovable.app-1783149320329.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2f839a06-af85-43d9-867f-dae2f1f4526f/id-preview-437b4a2a--8892ddc8-a682-4802-8292-b3e034e3862f.lovable.app-1783149320329.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: RouteErrorBoundary,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const onErr = (e: ErrorEvent) => {
      reportError(e.error ?? e.message, {
        title: "Unexpected error",
        boundary: "window.onerror",
        silent: true,
      });
    };
    const onRej = (e: PromiseRejectionEvent) => {
      reportError(e.reason, {
        title: "Unhandled promise rejection",
        boundary: "window.onunhandledrejection",
        silent: true,
      });
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
