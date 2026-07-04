import { supabase } from "@/integrations/supabase/client";

export async function logAudit(
  module: string,
  action: string,
  entityId?: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;
  await supabase.from("audit_logs").insert({
    module,
    action,
    entity_id: entityId ?? null,
    user_id: uid,
    details: (details ?? null) as never,
  });
}
