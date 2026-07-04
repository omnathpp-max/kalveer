
-- Company profile (singleton row)
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'Kalveer Quarry',
  address TEXT,
  gstin TEXT,
  phone TEXT,
  email TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  singleton BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT app_settings_singleton_unique UNIQUE (singleton)
);

GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view company profile"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins can insert company profile"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update company profile"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_settings (company_name) VALUES ('Kalveer Quarry');

-- Categories
CREATE TYPE public.category_kind AS ENUM ('petty_cash', 'payment');

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.category_kind NOT NULL,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view categories"
  ON public.categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins can insert categories"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update categories"
  ON public.categories FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete categories"
  ON public.categories FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults from hardcoded lists
INSERT INTO public.categories (kind, name, sort_order) VALUES
  ('petty_cash', 'Diesel', 10),
  ('petty_cash', 'Repairs & Maintenance', 20),
  ('petty_cash', 'Consumables', 30),
  ('petty_cash', 'Wages / Labour', 40),
  ('petty_cash', 'Food & Refreshments', 50),
  ('petty_cash', 'Transport', 60),
  ('petty_cash', 'Office Expense', 70),
  ('petty_cash', 'Miscellaneous', 80),
  ('payment', 'Diesel Supplier', 10),
  ('payment', 'Spares & Parts', 20),
  ('payment', 'Machinery Rental', 30),
  ('payment', 'Contractor / Sub-contractor', 40),
  ('payment', 'Transport / Freight', 50),
  ('payment', 'Utilities', 60),
  ('payment', 'Government / Taxes', 70),
  ('payment', 'Other', 80);
