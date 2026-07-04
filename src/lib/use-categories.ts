import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CategoryKind = "petty_cash" | "payment";

/** Fetch active category names for a kind, with a fallback list while loading or if none exist. */
export function useCategories(kind: CategoryKind, fallback: readonly string[]) {
  const [names, setNames] = useState<string[]>([...fallback]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("categories")
        .select("name,sort_order,is_active")
        .eq("kind", kind)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (cancelled) return;
      const list = ((data ?? []) as { name: string }[]).map((c) => c.name);
      setNames(list.length ? list : [...fallback]);
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  return names;
}
