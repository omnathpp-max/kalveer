
DROP POLICY IF EXISTS "insert inventory_items" ON public.inventory_items;
CREATE POLICY "insert inventory_items" ON public.inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_admin_role(auth.uid()));
