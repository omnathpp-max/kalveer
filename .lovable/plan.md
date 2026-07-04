# Kalveer Quarry Operations — Build Plan

Full internal ops app for a granite quarry: petty cash, payment requirements, diesel, approvals, reports, audit logs, and email reports. INR ₹, Asia/Kolkata, English UI. Auth is email + password (phone-OTP wiring deferred until an SMS provider is chosen).

Because the spec is very large, the build is split into 6 phases. Each phase ends in a working, testable app. You can stop at any phase.

---

## Phase 1 — Foundation (auth, roles, permissions, shell)

- Enable Lovable Cloud (Postgres + auth + storage).
- Email/password login + signup. Session timeout (auto sign-out after 30 min idle).
- Roles: `super_admin`, `admin`, `accounts_admin`, `worker` in a separate `user_roles` table with `has_role()` security-definer function (no role on profile).
- `profiles` table (name, phone, email, department/site, active flag, created_by, last_login).
- Granular `user_permissions` table (one row per user × permission key) for the 12 permission toggles in the spec.
- First signed-up user auto-promoted to `super_admin`; afterwards only super admin can create/deactivate users and assign roles/permissions.
- App shell: responsive sidebar + topbar, mobile drawer nav, status-badge system (Pending / Approved / Rejected / Processing / Paid).
- Routes scaffolded (empty pages) for every module so nav works end-to-end.
- Audit log table + helper server fn used by every subsequent module.

Deliverable: you can sign up, land in the dashboard shell, manage users/roles/permissions, see empty module pages.

## Phase 2 — Petty Cash

- **Requests**: worker creates (amount, purpose, required date, notes, attachment). Flow `Submitted → Approved/Rejected → Processing → Paid`, capturing approver, payer, timestamps, payment proof upload.
- **Ledger / cash in-out**: date, type (In/Out), amount, category, description, voucher #, paid to / received from, attachment, entered by. Auto opening/closing balance per day.
- **Denomination sheet**: ₹500/₹200/₹100/₹50/₹20/₹10/coins, auto total, mismatch warning vs closing balance.
- **Reports**: daily / weekly / monthly / custom range with opening, entries, totals, closing, denominations. Export PDF + CSV. Print-friendly view mirroring the uploaded petty cash format.
- **Petty cash dashboard**: cash in today, cash out today, current balance, pending requests, approvals due.

## Phase 3 — Payment Requirements

- Request fields per spec (vendor, amount, category, payment type, bank/UPI, invoice #, invoice date, invoice/quotation upload, priority, remarks).
- Auto request number (e.g. `PR-2026-000123`).
- Flow `Submitted → Approved/Rejected → Processing → Paid` with second-person payment step, payment proof upload, txn ID, paid date, mode.
- Reports: daily/weekly/monthly, vendor-wise, pending, approved-unpaid, paid. PDF + CSV. Print layout mirrors uploaded format (serial, particulars, amount, remarks, prepared by / approved by).
- Payment Requirement dashboard: pending, approved-unpaid, paid today, vendor totals.

## Phase 4 — Diesel

- **Daily diesel entry**: date, shift (day/night), opening L, received L, total, day consumption, closing L, remarks, prepared by, approved by.
- **Machine-wise entries** per day: category (Excavator / Compressor & Generator / Vehicle / Other), machine name, consumption L, start hour, close hour, total hours, average, operator, nature of work, tank details, tank capacity, service hours, remarks.
- **Machines & operators** master tables (so entries are consistent).
- **Diesel dashboard**: total received, consumed, closing stock, machine-wise chart, operator-wise chart, top consumers, daily/weekly/monthly trend line.
- Reports + PDF/CSV export mirroring uploaded diesel report layout.

## Phase 5 — Main Dashboard, Audit Trail, Reports Hub

- Main dashboard cards: pending petty cash requests, pending payment requirements, approved-unpaid, paid today, cash in/out today, current cash balance, diesel consumed today, weekly/monthly totals, recent activity.
- Date filters: Today / Yesterday / This week / This month / Custom.
- Audit log viewer (super admin + admin): filter by user, action, module, date.
- Global reports hub with all exports in one place.
- Every list gets search + filters (date, user, status, category, vendor/machine).

## Phase 6 — Email Reports + Notification Settings

- Enable Lovable Emails, set up sender domain, scaffold app-email templates.
- **Weekly report email** (Mondays) and **monthly report email** (1st of month) to selected recipients, with PDF + CSV attachments — note: Lovable Emails does not support file attachments, so reports will be embedded as summary HTML plus signed download links to the PDF/CSV stored in Cloud storage (I'll flag this when we hit the phase).
- Notification settings page: pick recipients per report, choose send time.
- Daily "gist" email (as WhatsApp substitute for now): totals, pending approvals, diesel summary, mismatches. WhatsApp can be added later once you pick a provider (Meta Cloud API or Twilio).

---

## Data model (high level)

`profiles`, `user_roles`, `user_permissions`, `audit_logs`,
`petty_cash_requests`, `petty_cash_ledger`, `petty_cash_denominations`,
`payment_requirements`, `payment_proofs`,
`diesel_daily_reports`, `diesel_machine_entries`, `machines`, `operators`,
`attachments`, `notification_settings`, `report_recipients`.

All tables: RLS on, `service_role` grants, per-role policies via `has_role()` and per-row ownership for workers. Attachments stored in a private Cloud storage bucket; access via signed URLs only.

## Security

- RLS on every table; workers only see their own submissions.
- Two-person rule enforced in DB triggers: approver ≠ requester, payer ≠ approver where required.
- Session timeout on client; server-side re-checks on every mutation.
- Audit log written from server functions, not client, so it can't be bypassed.
- Only `super_admin` can create/modify `super_admin` roles.
- Files served through signed URLs, never public.

## Deferred (not in v1 unless you say so)

- Real phone-number OTP login and admin 2FA (needs paid SMS provider — Twilio or MSG91/GatewayAPI).
- WhatsApp daily gist (needs Meta WhatsApp Cloud API or Twilio WhatsApp).
- Tamil UI.

## What I need from you to start Phase 1

Just approve this plan. I'll enable Lovable Cloud and build Phase 1 immediately. After each phase I'll pause so you can test before I continue.
