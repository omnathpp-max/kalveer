
-- 1. Tighten attachments SELECT policy: owner or admin only
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON storage.objects;

CREATE POLICY "Owner or admin can view attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (owner = auth.uid() OR public.has_any_admin_role(auth.uid()))
  );

-- 2. Remove anon EXECUTE on notify_role (keep authenticated only)
REVOKE EXECUTE ON FUNCTION public.notify_role(app_role, text, text, text, text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_role(app_role, text, text, text, text, uuid, text) FROM PUBLIC;
