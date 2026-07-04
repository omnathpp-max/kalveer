
CREATE TYPE public.payment_req_status AS ENUM ('submitted','approved','rejected','processing','paid');

CREATE TABLE public.payment_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no TEXT NOT NULL UNIQUE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  vendor_name TEXT NOT NULL,
  vendor_category TEXT,
  payment_type TEXT NOT NULL,   -- Bank Transfer / UPI / Cash / Cheque / Other
  bank_name TEXT,
  bank_account_no TEXT,
  bank_ifsc TEXT,
  upi_id TEXT,

  invoice_no TEXT,
  invoice_date DATE,
  invoice_url TEXT,

  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  approved_amount NUMERIC(14,2),
  paid_amount NUMERIC(14,2),

  priority TEXT NOT NULL DEFAULT 'normal',  -- low / normal / high / urgent
  required_date DATE NOT NULL,
  purpose TEXT NOT NULL,
  notes TEXT,
  attachment_url TEXT,

  status public.payment_req_status NOT NULL DEFAULT 'submitted',
  approver_id UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  rejected_reason TEXT,

  payer_id UUID REFERENCES auth.users(id),
  paid_at TIMESTAMPTZ,
  payment_mode TEXT,
  payment_reference TEXT,
  payment_proof_url TEXT,
  payment_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_pr_requester ON public.payment_requirements(requester_id);
CREATE INDEX ix_pr_status ON public.payment_requirements(status);
CREATE INDEX ix_pr_vendor ON public.payment_requirements(vendor_name);
CREATE INDEX ix_pr_created ON public.payment_requirements(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_requirements TO authenticated;
GRANT ALL ON public.payment_requirements TO service_role;

ALTER TABLE public.payment_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pr_select_own_or_admin" ON public.payment_requirements FOR SELECT TO authenticated
USING (requester_id = auth.uid() OR public.has_any_admin_role(auth.uid()));

CREATE POLICY "pr_insert_own" ON public.payment_requirements FOR INSERT TO authenticated
WITH CHECK (
  requester_id = auth.uid()
  AND public.has_permission(auth.uid(), 'raise_payment_requirement')
  AND status = 'submitted'
);

CREATE POLICY "pr_update_own_pending" ON public.payment_requirements FOR UPDATE TO authenticated
USING (requester_id = auth.uid() AND status = 'submitted')
WITH CHECK (requester_id = auth.uid() AND status = 'submitted');

CREATE POLICY "pr_update_admin_workflow" ON public.payment_requirements FOR UPDATE TO authenticated
USING (
  public.has_permission(auth.uid(), 'approve_payment_requirement')
  OR public.has_permission(auth.uid(), 'process_payment_requirement')
)
WITH CHECK (
  public.has_permission(auth.uid(), 'approve_payment_requirement')
  OR public.has_permission(auth.uid(), 'process_payment_requirement')
);

CREATE POLICY "pr_delete_super_admin" ON public.payment_requirements FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Two-person rule (mirrors petty cash)
CREATE OR REPLACE FUNCTION public.enforce_payment_req_two_person()
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

CREATE TRIGGER trg_pr_two_person
BEFORE INSERT OR UPDATE ON public.payment_requirements
FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_req_two_person();

CREATE TRIGGER trg_pr_updated_at
BEFORE UPDATE ON public.payment_requirements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE SEQUENCE public.payment_req_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_payment_req_no()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.request_no IS NULL OR NEW.request_no = '' THEN
    NEW.request_no := 'PR-' || to_char(now() AT TIME ZONE 'Asia/Kolkata','YYYY') || '-' ||
      lpad(nextval('public.payment_req_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_pr_assign_no
BEFORE INSERT ON public.payment_requirements
FOR EACH ROW EXECUTE FUNCTION public.assign_payment_req_no();
