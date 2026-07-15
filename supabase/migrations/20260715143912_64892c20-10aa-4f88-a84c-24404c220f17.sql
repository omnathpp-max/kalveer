
-- =============================================================
-- UNIFIED PAYMENT REQUESTS + PETTY CASH WALLETS + INVENTORY
-- =============================================================

-- 1. Drop old objects (per user choice: discard existing data) ---
DROP TABLE IF EXISTS public.petty_cash_denominations CASCADE;
DROP TABLE IF EXISTS public.petty_cash_ledger CASCADE;
DROP TABLE IF EXISTS public.petty_cash_requests CASCADE;
DROP TABLE IF EXISTS public.payment_requirements CASCADE;
DROP FUNCTION IF EXISTS public.assign_petty_cash_request_no() CASCADE;
DROP FUNCTION IF EXISTS public.assign_payment_req_no() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_petty_cash_two_person() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_payment_req_two_person() CASCADE;
DROP SEQUENCE IF EXISTS public.petty_cash_request_seq CASCADE;
DROP SEQUENCE IF EXISTS public.payment_req_seq CASCADE;
DROP TYPE IF EXISTS public.petty_cash_status CASCADE;
DROP TYPE IF EXISTS public.payment_req_status CASCADE;

-- Clear old per-user permission grants (users will re-assign in UI).
-- We keep the old permission_key enum values in place to avoid the deep
-- dependency cascade (diesel policies, has_permission signature, etc.).
DELETE FROM public.user_permissions;

-- Add new permission enum values (Postgres can add, not remove)
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'raise_request';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'approve_request';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'process_payment';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'manage_petty_cash_wallets';
