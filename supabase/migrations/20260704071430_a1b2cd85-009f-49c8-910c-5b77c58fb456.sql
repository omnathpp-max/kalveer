
-- Scope SELECT policies to reduce over-exposure to authenticated users.

-- app_settings: keep readable by any signed-in user (shared company profile),
-- but restrict to admins only to hide sensitive contact/tax fields.
DROP POLICY IF EXISTS "Signed-in users can view company profile" ON public.app_settings;
CREATE POLICY "Admins can view company profile"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

-- diesel_daily_reports: only admins, diesel managers, approvers, report viewers, or the preparer.
DROP POLICY IF EXISTS ddr_select_auth ON public.diesel_daily_reports;
CREATE POLICY ddr_select_scoped
  ON public.diesel_daily_reports FOR SELECT
  TO authenticated
  USING (
    public.has_any_admin_role(auth.uid())
    OR public.has_permission(auth.uid(), 'manage_diesel_entries')
    OR public.has_permission(auth.uid(), 'approve_diesel_report')
    OR public.has_permission(auth.uid(), 'view_reports')
    OR prepared_by = auth.uid()
  );

-- diesel_machine_entries: same scope as parent reports.
DROP POLICY IF EXISTS dme_select_auth ON public.diesel_machine_entries;
CREATE POLICY dme_select_scoped
  ON public.diesel_machine_entries FOR SELECT
  TO authenticated
  USING (
    public.has_any_admin_role(auth.uid())
    OR public.has_permission(auth.uid(), 'manage_diesel_entries')
    OR public.has_permission(auth.uid(), 'approve_diesel_report')
    OR public.has_permission(auth.uid(), 'view_reports')
  );

-- machines: readable by admins, diesel managers/approvers, and report viewers.
DROP POLICY IF EXISTS machines_select_auth ON public.machines;
CREATE POLICY machines_select_scoped
  ON public.machines FOR SELECT
  TO authenticated
  USING (
    public.has_any_admin_role(auth.uid())
    OR public.has_permission(auth.uid(), 'manage_diesel_entries')
    OR public.has_permission(auth.uid(), 'approve_diesel_report')
    OR public.has_permission(auth.uid(), 'view_reports')
  );

-- operators: contains PII (names, phones). Restrict to admins and diesel roles.
DROP POLICY IF EXISTS operators_select_auth ON public.operators;
CREATE POLICY operators_select_scoped
  ON public.operators FOR SELECT
  TO authenticated
  USING (
    public.has_any_admin_role(auth.uid())
    OR public.has_permission(auth.uid(), 'manage_diesel_entries')
    OR public.has_permission(auth.uid(), 'approve_diesel_report')
    OR public.has_permission(auth.uid(), 'view_reports')
  );
