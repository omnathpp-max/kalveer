
-- ============ STATUS ENUMS ============
CREATE TYPE public.petty_cash_status AS ENUM ('submitted','approved','rejected','processing','paid');
CREATE TYPE public.cash_flow_type AS ENUM ('in','out');

-- ============ REQUESTS ============
CREATE TABLE public.petty_cash_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no TEXT NOT NULL UNIQUE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  purpose TEXT NOT NULL,
  required_date DATE NOT NULL,
  notes TEXT,
  attachment_url TEXT,
  status public.petty_cash_status NOT NULL DEFAULT 'submitted',
  approver_id UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  rejected_reason TEXT,
  payer_id UUID REFERENCES auth.users(id),
  paid_at TIMESTAMPTZ,
  payment_proof_url TEXT,
  payment_mode TEXT,
  payment_reference TEXT,
  payment_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_pcr_requester ON public.petty_cash_requests(requester_id);
CREATE INDEX ix_pcr_status ON public.petty_cash_requests(status);
CREATE INDEX ix_pcr_created ON public.petty_cash_requests(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.petty_cash_requests TO authenticated;
GRANT ALL ON public.petty_cash_requests TO service_role;

ALTER TABLE public.petty_cash_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcr_select_own_or_admin" ON public.petty_cash_requests FOR SELECT TO authenticated
USING (requester_id = auth.uid() OR public.has_any_admin_role(auth.uid()));

CREATE POLICY "pcr_insert_own" ON public.petty_cash_requests FOR INSERT TO authenticated
WITH CHECK (
  requester_id = auth.uid()
  AND public.has_permission(auth.uid(), 'raise_petty_cash_request')
  AND status = 'submitted'
);

-- Requester can edit their own while still submitted (fix typo, add notes)
CREATE POLICY "pcr_update_own_pending" ON public.petty_cash_requests FOR UPDATE TO authenticated
USING (requester_id = auth.uid() AND status = 'submitted')
WITH CHECK (requester_id = auth.uid() AND status = 'submitted');

-- Approver / payer path (admins with approve or process permission).
CREATE POLICY "pcr_update_admin_workflow" ON public.petty_cash_requests FOR UPDATE TO authenticated
USING (
  public.has_permission(auth.uid(), 'approve_petty_cash')
  OR public.has_permission(auth.uid(), 'process_petty_cash_payment')
)
WITH CHECK (
  public.has_permission(auth.uid(), 'approve_petty_cash')
  OR public.has_permission(auth.uid(), 'process_petty_cash_payment')
);

CREATE POLICY "pcr_delete_super_admin" ON public.petty_cash_requests FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Two-person rule enforced by trigger
CREATE OR REPLACE FUNCTION public.enforce_petty_cash_two_person()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
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

CREATE TRIGGER trg_pcr_two_person
BEFORE INSERT OR UPDATE ON public.petty_cash_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_petty_cash_two_person();

CREATE TRIGGER trg_pcr_updated_at
BEFORE UPDATE ON public.petty_cash_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sequence-based request number PC-YYYY-NNNNNN (via trigger, restart yearly)
CREATE SEQUENCE public.petty_cash_request_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_petty_cash_request_no()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.request_no IS NULL OR NEW.request_no = '' THEN
    NEW.request_no := 'PC-' || to_char(now() AT TIME ZONE 'Asia/Kolkata','YYYY') || '-' ||
      lpad(nextval('public.petty_cash_request_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_pcr_assign_no
BEFORE INSERT ON public.petty_cash_requests
FOR EACH ROW EXECUTE FUNCTION public.assign_petty_cash_request_no();

-- ============ LEDGER ============
CREATE TABLE public.petty_cash_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL,
  type public.cash_flow_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  description TEXT,
  voucher_no TEXT,
  party TEXT,
  attachment_url TEXT,
  linked_request_id UUID REFERENCES public.petty_cash_requests(id) ON DELETE SET NULL,
  entered_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_pcl_date ON public.petty_cash_ledger(entry_date DESC);
CREATE INDEX ix_pcl_type ON public.petty_cash_ledger(type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.petty_cash_ledger TO authenticated;
GRANT ALL ON public.petty_cash_ledger TO service_role;

ALTER TABLE public.petty_cash_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcl_select_admins" ON public.petty_cash_ledger FOR SELECT TO authenticated
USING (public.has_any_admin_role(auth.uid()) OR entered_by = auth.uid());

CREATE POLICY "pcl_insert_permitted" ON public.petty_cash_ledger FOR INSERT TO authenticated
WITH CHECK (
  entered_by = auth.uid()
  AND public.has_permission(auth.uid(), 'add_petty_cash_ledger')
);

CREATE POLICY "pcl_update_super_admin" ON public.petty_cash_ledger FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "pcl_delete_super_admin" ON public.petty_cash_ledger FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_pcl_updated_at
BEFORE UPDATE ON public.petty_cash_ledger
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ DENOMINATIONS ============
CREATE TABLE public.petty_cash_denominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL UNIQUE,
  notes_500 INT NOT NULL DEFAULT 0 CHECK (notes_500 >= 0),
  notes_200 INT NOT NULL DEFAULT 0 CHECK (notes_200 >= 0),
  notes_100 INT NOT NULL DEFAULT 0 CHECK (notes_100 >= 0),
  notes_50 INT NOT NULL DEFAULT 0 CHECK (notes_50 >= 0),
  notes_20 INT NOT NULL DEFAULT 0 CHECK (notes_20 >= 0),
  notes_10 INT NOT NULL DEFAULT 0 CHECK (notes_10 >= 0),
  coins NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (coins >= 0),
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  expected_closing NUMERIC(14,2),
  mismatch_note TEXT,
  entered_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.petty_cash_denominations TO authenticated;
GRANT ALL ON public.petty_cash_denominations TO service_role;

ALTER TABLE public.petty_cash_denominations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcd_select_admins" ON public.petty_cash_denominations FOR SELECT TO authenticated
USING (public.has_any_admin_role(auth.uid()) OR entered_by = auth.uid());

CREATE POLICY "pcd_insert_permitted" ON public.petty_cash_denominations FOR INSERT TO authenticated
WITH CHECK (
  entered_by = auth.uid()
  AND public.has_permission(auth.uid(), 'add_petty_cash_ledger')
);

CREATE POLICY "pcd_update_permitted" ON public.petty_cash_denominations FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'add_petty_cash_ledger'))
WITH CHECK (public.has_permission(auth.uid(), 'add_petty_cash_ledger'));

CREATE POLICY "pcd_delete_super_admin" ON public.petty_cash_denominations FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_pcd_updated_at
BEFORE UPDATE ON public.petty_cash_denominations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
