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
        // Only toast for queries that opted in via meta.showErrorToast (default: silent).
        // This avoids double-toasting when a component also handles the error.
        const meta = query.meta as { showErrorToast?: boolean; errorTitle?: string } | undefined;
        if (meta?.showErrorToast !== false) {
          reportError(error, {
            title: meta?.errorTitle ?? "Couldn't load data",
            boundary: `query:${String(query.queryKey?.[0] ?? "unknown")}`,
            silent: meta?.showErrorToast === false,
          });
        } else {
          console.error("[query silent]", query.queryKey, error);
        }
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
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteErrorBoundary,
    defaultNotFoundComponent: RouteNotFound,
  });

  return router;
};
