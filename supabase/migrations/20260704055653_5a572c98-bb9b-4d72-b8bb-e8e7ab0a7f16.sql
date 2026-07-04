
-- Masters
CREATE TABLE public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('excavator','compressor','vehicle','other')),
  tank_capacity NUMERIC(12,2),
  service_hours_interval NUMERIC(12,2),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;
GRANT ALL ON public.machines TO service_role;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "machines_select_auth" ON public.machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "machines_write_manage" ON public.machines FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'manage_diesel_entries'))
  WITH CHECK (public.has_permission(auth.uid(),'manage_diesel_entries'));
CREATE TRIGGER trg_machines_updated BEFORE UPDATE ON public.machines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operators TO authenticated;
GRANT ALL ON public.operators TO service_role;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operators_select_auth" ON public.operators FOR SELECT TO authenticated USING (true);
CREATE POLICY "operators_write_manage" ON public.operators FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'manage_diesel_entries'))
  WITH CHECK (public.has_permission(auth.uid(),'manage_diesel_entries'));
CREATE TRIGGER trg_operators_updated BEFORE UPDATE ON public.operators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Daily diesel report
CREATE TABLE public.diesel_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  shift TEXT NOT NULL CHECK (shift IN ('day','night','full')),
  opening_litres NUMERIC(12,2) NOT NULL DEFAULT 0,
  received_litres NUMERIC(12,2) NOT NULL DEFAULT 0,
  consumption_litres NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_litres NUMERIC(12,2) NOT NULL DEFAULT 0,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  prepared_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_date, shift)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diesel_daily_reports TO authenticated;
GRANT ALL ON public.diesel_daily_reports TO service_role;
ALTER TABLE public.diesel_daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ddr_select_auth" ON public.diesel_daily_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "ddr_insert_manage" ON public.diesel_daily_reports FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'manage_diesel_entries'));
CREATE POLICY "ddr_update_manage_or_approve" ON public.diesel_daily_reports FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'manage_diesel_entries') OR public.has_permission(auth.uid(),'approve_diesel_report'))
  WITH CHECK (public.has_permission(auth.uid(),'manage_diesel_entries') OR public.has_permission(auth.uid(),'approve_diesel_report'));
CREATE POLICY "ddr_delete_admin" ON public.diesel_daily_reports FOR DELETE TO authenticated
  USING (public.has_any_admin_role(auth.uid()));
CREATE TRIGGER trg_ddr_updated BEFORE UPDATE ON public.diesel_daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Machine entries per report
CREATE TABLE public.diesel_machine_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id UUID NOT NULL REFERENCES public.diesel_daily_reports(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('excavator','compressor','vehicle','other')),
  machine_name TEXT NOT NULL,
  operator_name TEXT,
  consumption_litres NUMERIC(12,2) NOT NULL DEFAULT 0,
  hour_start NUMERIC(12,2),
  hour_close NUMERIC(12,2),
  total_hours NUMERIC(12,2),
  average_lph NUMERIC(12,2),
  nature_of_work TEXT,
  tank_details TEXT,
  tank_capacity NUMERIC(12,2),
  service_hours NUMERIC(12,2),
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diesel_machine_entries TO authenticated;
GRANT ALL ON public.diesel_machine_entries TO service_role;
ALTER TABLE public.diesel_machine_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dme_select_auth" ON public.diesel_machine_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "dme_write_manage" ON public.diesel_machine_entries FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'manage_diesel_entries'))
  WITH CHECK (public.has_permission(auth.uid(),'manage_diesel_entries'));
CREATE TRIGGER trg_dme_updated BEFORE UPDATE ON public.diesel_machine_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_dme_report ON public.diesel_machine_entries(daily_report_id);
CREATE INDEX idx_ddr_date ON public.diesel_daily_reports(report_date DESC);
