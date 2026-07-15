
-- =============================================================
-- NEW SCHEMA
-- =============================================================

CREATE TYPE public.payment_request_status AS ENUM (
  'submitted','approved','rejected','processing','paid'
);
CREATE TYPE public.payment_request_category AS ENUM (
  'petty_cash','vendor_payment','diesel','other'
);
CREATE TYPE public.wallet_entry_type AS ENUM (
  'auto_top_up','manual_top_up','expense'
);
CREATE TYPE public.inventory_movement_type AS ENUM (
  'purchase','consumption','adjustment'
);

-- 1. payment_requests -------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.payment_request_seq;

CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no text NOT NULL UNIQUE,
  category public.payment_request_category NOT NULL,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  purpose text NOT NULL,
  required_date date NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  notes text,
  attachment_url text,
  vendor_name text,
  vendor_category text,
  payment_type text,
  bank_name text,
  bank_account_no text,
  bank_ifsc text,
  upi_id text,
  invoice_no text,
  invoice_date date,
  invoice_url text,
  status public.payment_request_status NOT NULL DEFAULT 'submitted',
  approver_id uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  approved_amount numeric(14,2),
  approval_notes text,
  rejected_reason text,
  payer_id uuid REFERENCES auth.users(id),
  paid_at timestamptz,
  paid_amount numeric(14,2),
  payment_mode text,
  payment_reference text,
  payment_proof_url text,
  payment_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.payment_requests (requester_id);
CREATE INDEX ON public.payment_requests (status);
CREATE INDEX ON public.payment_requests (category);
CREATE INDEX ON public.payment_requests (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read payment_requests" ON public.payment_requests
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert payment_requests" ON public.payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND public.has_permission(auth.uid(), 'raise_request')
  );
CREATE POLICY "update payment_requests" ON public.payment_requests
  FOR UPDATE TO authenticated
  USING (
    (requester_id = auth.uid() AND status = 'submitted')
    OR public.has_permission(auth.uid(), 'approve_request')
    OR public.has_permission(auth.uid(), 'process_payment')
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    (requester_id = auth.uid() AND status = 'submitted')
    OR public.has_permission(auth.uid(), 'approve_request')
    OR public.has_permission(auth.uid(), 'process_payment')
    OR public.has_role(auth.uid(), 'super_admin')
  );
CREATE POLICY "delete payment_requests" ON public.payment_requests
  FOR DELETE TO authenticated
  USING (
    (requester_id = auth.uid() AND status = 'submitted')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE OR REPLACE FUNCTION public.assign_payment_request_no()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.request_no IS NULL OR NEW.request_no = '' THEN
    NEW.request_no := 'REQ-' || to_char(now() AT TIME ZONE 'Asia/Kolkata','YYYY') || '-' ||
      lpad(nextval('public.payment_request_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_assign_payment_request_no
  BEFORE INSERT ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.assign_payment_request_no();

CREATE OR REPLACE FUNCTION public.enforce_payment_request_two_person()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.approver_id IS NOT NULL AND NEW.approver_id = NEW.requester_id THEN
    RAISE EXCEPTION 'Approver cannot be the requester';
  END IF;
  IF NEW.payer_id IS NOT NULL AND NEW.approver_id IS NOT NULL
     AND NEW.payer_id = NEW.approver_id THEN
    RAISE EXCEPTION 'Payer cannot be the same as approver';
  END IF;
  IF NEW.payer_id IS NOT NULL AND NEW.payer_id = NEW.requester_id THEN
    RAISE EXCEPTION 'Payer cannot be the requester';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_enforce_payment_request_two_person
  BEFORE INSERT OR UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_request_two_person();

CREATE TRIGGER trg_payment_requests_updated_at
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. expense_heads ----------------------------------------------
CREATE TABLE public.expense_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  tracks_inventory boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.expense_heads TO authenticated;
GRANT ALL ON public.expense_heads TO service_role;

ALTER TABLE public.expense_heads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read expense_heads" ON public.expense_heads
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage expense_heads" ON public.expense_heads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_expense_heads_updated_at
  BEFORE UPDATE ON public.expense_heads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.expense_heads (name, tracks_inventory, sort_order) VALUES
  ('Equipment', true, 10),
  ('Labour', false, 20),
  ('Salary Advance', false, 30),
  ('Groceries', true, 40),
  ('Fuel', true, 50),
  ('Stationery', true, 60),
  ('Repairs & Maintenance', false, 70),
  ('Transport', false, 80),
  ('Loading / Unloading', false, 90),
  ('Miscellaneous', false, 100);

-- 3. inventory_items --------------------------------------------
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  unit text NOT NULL DEFAULT 'pcs',
  reorder_level numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read inventory_items" ON public.inventory_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert inventory_items" ON public.inventory_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update inventory_items" ON public.inventory_items
  FOR UPDATE TO authenticated
  USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));
CREATE POLICY "delete inventory_items" ON public.inventory_items
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. petty_cash_wallet_entries ----------------------------------
CREATE TABLE public.petty_cash_wallet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type public.wallet_entry_type NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  expense_head_id uuid REFERENCES public.expense_heads(id),
  vendor_or_person text,
  remarks text,
  attachment_url text,
  request_id uuid REFERENCES public.payment_requests(id) ON DELETE SET NULL,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  qty numeric(14,2),
  is_voided boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.petty_cash_wallet_entries (user_id, entry_date DESC);
CREATE INDEX ON public.petty_cash_wallet_entries (request_id);
CREATE INDEX ON public.petty_cash_wallet_entries (inventory_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.petty_cash_wallet_entries TO authenticated;
GRANT ALL ON public.petty_cash_wallet_entries TO service_role;

ALTER TABLE public.petty_cash_wallet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read wallet entries" ON public.petty_cash_wallet_entries
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_permission(auth.uid(), 'manage_petty_cash_wallets')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "insert wallet entries" ON public.petty_cash_wallet_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND entry_type = 'expense')
    OR public.has_permission(auth.uid(), 'manage_petty_cash_wallets')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "update wallet entries" ON public.petty_cash_wallet_entries
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND entry_type = 'expense' AND is_voided = false)
    OR public.has_permission(auth.uid(), 'manage_petty_cash_wallets')
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    (user_id = auth.uid() AND entry_type = 'expense')
    OR public.has_permission(auth.uid(), 'manage_petty_cash_wallets')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "delete wallet entries" ON public.petty_cash_wallet_entries
  FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), 'manage_petty_cash_wallets')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE TRIGGER trg_wallet_entries_updated_at
  BEFORE UPDATE ON public.petty_cash_wallet_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.wallet_balance_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  bal numeric;
BEGIN
  IF NEW.direction = 'out' AND COALESCE(NEW.is_voided, false) = false THEN
    SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END), 0)
    INTO bal
    FROM public.petty_cash_wallet_entries
    WHERE user_id = NEW.user_id AND is_voided = false AND id <> NEW.id;

    IF (bal - NEW.amount) < 0 THEN
      RAISE EXCEPTION 'Wallet balance would go negative (available: %, attempted: %)', bal, NEW.amount;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_wallet_balance_guard
  BEFORE INSERT OR UPDATE ON public.petty_cash_wallet_entries
  FOR EACH ROW EXECUTE FUNCTION public.wallet_balance_guard();

-- 5. Auto top-up trigger on payment_requests --------------------
CREATE OR REPLACE FUNCTION public.on_payment_request_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND NEW.category = 'petty_cash'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    INSERT INTO public.petty_cash_wallet_entries
      (user_id, entry_type, direction, amount, entry_date, remarks, request_id, created_by)
    VALUES
      (NEW.requester_id, 'auto_top_up', 'in',
       COALESCE(NEW.paid_amount, NEW.approved_amount, NEW.amount),
       COALESCE(NEW.paid_at::date, CURRENT_DATE),
       'Auto top-up from ' || NEW.request_no,
       NEW.id,
       COALESCE(NEW.payer_id, NEW.requester_id));
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' AND NEW.status <> 'paid'
     AND NEW.category = 'petty_cash' THEN
    UPDATE public.petty_cash_wallet_entries
    SET is_voided = true, remarks = COALESCE(remarks,'') || ' [voided: request no longer paid]'
    WHERE request_id = NEW.id AND entry_type = 'auto_top_up' AND is_voided = false;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_on_payment_request_paid
  AFTER INSERT OR UPDATE OF status ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_payment_request_paid();

-- 6. Wallet balances view ---------------------------------------
CREATE OR REPLACE VIEW public.petty_cash_wallet_balances
WITH (security_invoker = true) AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.email,
  COALESCE(SUM(CASE WHEN e.direction='in' THEN e.amount ELSE -e.amount END) FILTER (WHERE e.is_voided = false), 0)::numeric(14,2) AS balance,
  MAX(e.entry_date) AS last_activity
FROM public.profiles p
LEFT JOIN public.petty_cash_wallet_entries e ON e.user_id = p.id
GROUP BY p.id, p.full_name, p.email;

GRANT SELECT ON public.petty_cash_wallet_balances TO authenticated;

-- 7. inventory_movements ----------------------------------------
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type public.inventory_movement_type NOT NULL,
  qty numeric(14,2) NOT NULL CHECK (qty > 0),
  entry_id uuid REFERENCES public.petty_cash_wallet_entries(id) ON DELETE SET NULL,
  request_id uuid REFERENCES public.payment_requests(id) ON DELETE SET NULL,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.inventory_movements (item_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read inventory_movements" ON public.inventory_movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert inventory_movements" ON public.inventory_movements
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "update inventory_movements" ON public.inventory_movements
  FOR UPDATE TO authenticated
  USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));
CREATE POLICY "delete inventory_movements" ON public.inventory_movements
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE VIEW public.inventory_balances
WITH (security_invoker = true) AS
SELECT
  i.id AS item_id,
  i.name,
  i.unit,
  i.reorder_level,
  i.is_active,
  COALESCE(SUM(CASE
    WHEN m.movement_type='purchase' THEN m.qty
    WHEN m.movement_type='consumption' THEN -m.qty
    WHEN m.movement_type='adjustment' THEN m.qty
    ELSE 0 END), 0)::numeric(14,2) AS balance
FROM public.inventory_items i
LEFT JOIN public.inventory_movements m ON m.item_id = i.id
GROUP BY i.id, i.name, i.unit, i.reorder_level, i.is_active;

GRANT SELECT ON public.inventory_balances TO authenticated;

-- 8. Reorder-check trigger --------------------------------------
CREATE OR REPLACE FUNCTION public.check_inventory_reorder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  itm record;
  bal numeric;
BEGIN
  SELECT id, name, unit, reorder_level INTO itm FROM public.inventory_items WHERE id = NEW.item_id;
  IF itm.reorder_level IS NULL OR itm.reorder_level <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(CASE
    WHEN movement_type='purchase' THEN qty
    WHEN movement_type='consumption' THEN -qty
    WHEN movement_type='adjustment' THEN qty
    ELSE 0 END), 0)
  INTO bal
  FROM public.inventory_movements WHERE item_id = NEW.item_id;

  IF bal <= itm.reorder_level THEN
    INSERT INTO public.notifications (user_id, actor_id, type, title, body, module, entity_id, link)
    SELECT ur.user_id, NEW.created_by, 'low_stock',
      'Low stock: ' || itm.name,
      'Current: ' || bal || ' ' || itm.unit || '. Reorder level: ' || itm.reorder_level || ' ' || itm.unit || '.',
      'inventory', itm.id, '/inventory'
    FROM public.user_roles ur
    WHERE ur.role IN ('super_admin','admin','accounts_admin');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_check_inventory_reorder
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.check_inventory_reorder();

-- 9. Lock trigger functions from direct execution --------------
REVOKE EXECUTE ON FUNCTION public.on_payment_request_paid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_inventory_reorder() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_balance_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_payment_request_no() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_payment_request_two_person() FROM PUBLIC, anon, authenticated;
