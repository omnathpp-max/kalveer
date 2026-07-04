import { toast } from "sonner";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/**
 * Normalize any thrown value into a user-friendly message.
 * Supabase Postgrest errors come through as objects with .message.
 */
export function toErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "object") {
    const anyErr = err as { message?: string; error_description?: string; msg?: string };
    return anyErr.message || anyErr.error_description || anyErr.msg || fallback;
  }
  return fallback;
}

/**
 * Toast + console.error a caught error. Safe to call from event handlers,
 * async mutations, or global handlers.
 */
export function reportError(
  err: unknown,
  context?: { title?: string; boundary?: string; silent?: boolean },
) {
  const message = toErrorMessage(err, context?.title ?? "Something went wrong");
  console.error(`[${context?.boundary ?? "app"}]`, err);
  try {
    reportLovableError(err instanceof Error ? err : new Error(message), {
      boundary: context?.boundary ?? "app",
    });
  } catch {
    // reporter must never itself throw
  }
  if (!context?.silent && typeof window !== "undefined") {
    if (context?.title) toast.error(context.title, { description: message });
    else toast.error(message);
  }
}

/**
 * Throw when a Supabase call returned an error. Use as:
 *   const { data, error } = await supabase.from(...).select();
 *   assertSupabase(error, "Failed to load requests");
 */
export function assertSupabase(
  error: { message: string } | null | undefined,
  title = "Request failed",
): void {
  if (error) {
    const e = new Error(`${title}: ${error.message}`);
    throw e;
  }
}
