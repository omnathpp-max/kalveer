
CREATE OR REPLACE FUNCTION public.notify_role(
  _role app_role,
  _type text,
  _title text,
  _body text,
  _module text,
  _entity_id uuid,
  _link text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, module, entity_id, link)
  SELECT ur.user_id, caller, _type, _title, _body, _module, _entity_id, _link
  FROM public.user_roles ur
  WHERE ur.role = _role AND ur.user_id <> caller;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_role(app_role, text, text, text, text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.notify_role(app_role, text, text, text, text, uuid, text) TO authenticated;
