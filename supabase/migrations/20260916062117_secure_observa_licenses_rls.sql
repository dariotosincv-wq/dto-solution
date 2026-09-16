-- OBSERVA logical pre-change state (captured 2026-09-16):
-- public.licenses: RLS disabled; no policies.
-- anon/authenticated had ALL table privileges.  The only production license
-- verification flow is the observa-license Edge Function, which calls the
-- SECURITY DEFINER RPC observa_verify_and_activate_license using service_role.
-- No browser or Android client directly reads or writes public.licenses.

begin;

alter table public.licenses enable row level security;

-- The licenses table contains license keys and owner contact data.  It is not
-- a client-facing REST resource: access is mediated by the backend RPC.
revoke all privileges on table public.licenses from public;
revoke all privileges on table public.licenses from anon;
revoke all privileges on table public.licenses from authenticated;

commit;
