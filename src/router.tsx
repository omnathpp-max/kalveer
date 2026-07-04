import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteErrorBoundary, RouteNotFound } from "./components/route-boundaries";
import { reportError } from "./lib/report-error";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          // Don't retry auth / permission / 404 errors — they won't succeed on retry.
          const msg = (error as { message?: string })?.message ?? "";
          if (/JWT|permission|denied|not\s+found|401|403|404/i.test(msg)) return false;
          return failureCount < 2;
        },
        staleTime: 30_000,
      },
      mutations: {
        retry: 0,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        const meta = query.meta as { showErrorToast?: boolean; errorTitle?: string } | undefined;
        const silent = meta?.showErrorToast === false;
        reportError(error, {
          title: meta?.errorTitle ?? "Couldn't load data",
          boundary: `query:${String(query.queryKey?.[0] ?? "unknown")}`,
          silent,
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        const meta = mutation.meta as { showErrorToast?: boolean; errorTitle?: string } | undefined;
        reportError(error, {
          title: meta?.errorTitle ?? "Action failed",
          boundary: `mutation:${String(mutation.options.mutationKey?.[0] ?? "unknown")}`,
          silent: meta?.showErrorToast === false,
        });
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    defaultErrorComponent: RouteErrorBoundary,
    defaultNotFoundComponent: RouteNotFound,
  });

  return router;
};
