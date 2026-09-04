begin;

-- Six public.turni rows were created during the 24 hours before the hardening
-- migration. The active legacy client is outside the reviewed repositories.
-- Restore only its previous access until that client can be identified and
-- migrated to authenticated, tenant-scoped endpoints.
alter table public.aziende disable row level security;
alter table public.dipendenti disable row level security;
alter table public.turni disable row level security;

grant all privileges on table public.aziende to anon, authenticated;
grant all privileges on table public.dipendenti to anon, authenticated;
grant all privileges on table public.turni to anon, authenticated;

comment on table public.aziende is
  'CRITICAL LEGACY EXPOSURE: active unidentified client; password_accesso must be retired before deny-by-default can be restored.';
comment on table public.dipendenti is
  'CRITICAL LEGACY EXPOSURE: active unidentified client pending authenticated tenant migration.';
comment on table public.turni is
  'CRITICAL LEGACY EXPOSURE: active unidentified client observed 2026-08-31; pending authenticated tenant migration.';

commit;
