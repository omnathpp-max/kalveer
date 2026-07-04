import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/permissions";

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  body: string | null;
  module: string | null;
  entity_id: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

interface NotifyArgs {
  userId: string;
  type: string;
  title: string;
  body?: string;
  module?: string;
  entityId?: string;
  link?: string;
}

export async function notifyUser(args: NotifyArgs): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const caller = userData.user?.id ?? null;
  if (!args.userId || args.userId === caller) return;
  await supabase.from("notifications").insert({
    user_id: args.userId,
    actor_id: caller,
    type: args.type,
    title: args.title,
    body: args.body ?? null,
    module: args.module ?? null,
    entity_id: args.entityId ?? null,
    link: args.link ?? null,
  } as never);
}

export async function notifyUsers(
  userIds: (string | null | undefined)[],
  args: Omit<NotifyArgs, "userId">,
): Promise<void> {
  const unique = Array.from(new Set(userIds.filter((x): x is string => !!x)));
  await Promise.all(unique.map((userId) => notifyUser({ ...args, userId })));
}

interface NotifyRoleArgs {
  role: AppRole;
  type: string;
  title: string;
  body?: string;
  module?: string;
  entityId?: string;
  link?: string;
}

export async function notifyRole(args: NotifyRoleArgs): Promise<void> {
  await supabase.rpc("notify_role" as never, {
    _role: args.role,
    _type: args.type,
    _title: args.title,
    _body: args.body ?? null,
    _module: args.module ?? null,
    _entity_id: args.entityId ?? null,
    _link: args.link ?? null,
  } as never);
}
