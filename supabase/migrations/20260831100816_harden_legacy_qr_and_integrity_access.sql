begin;

do $$
declare
  required_table text;
begin
  foreach required_table in array array['aziende', 'dipendenti', 'turni', 'qr_locali']
  loop
    if to_regclass(format('public.%I', required_table)) is null then
      raise exception 'SECURITY_HARDENING_PRECONDITION_FAILED: missing public.%', required_table;
    end if;
  end loop;
end
$$;

-- The legacy Driver Utility tables are not used by the current DTO or Android
-- clients. Keep their data intact, but remove them from client roles.
alter table public.aziende enable row level security;
alter table public.dipendenti enable row level security;
alter table public.turni enable row level security;

revoke all privileges on table public.aziende from public, anon, authenticated;
revoke all privileges on table public.dipendenti from public, anon, authenticated;
revoke all privileges on table public.turni from public, anon, authenticated;

comment on table public.aziende is
  'Legacy table. Private to trusted backend roles; password_accesso requires manual credential retirement.';
comment on table public.dipendenti is
  'Legacy table. Private to trusted backend roles pending explicit deprecation decision.';
comment on table public.turni is
  'Legacy table. Private to trusted backend roles pending explicit deprecation decision.';

-- qr_locali has no tenant/user ownership column. Any client policy would expose
-- driver aliases, locations, QR payloads and notes globally, so keep it private
-- until an authenticated ownership model and an adjudication plan for old rows exist.
revoke all privileges on table public.qr_locali from public, anon, authenticated;

drop policy if exists qr_locali_anon_select_intermediate on public.qr_locali;
drop policy if exists qr_locali_anon_insert_intermediate on public.qr_locali;
drop policy if exists qr_locali_anon_update_intermediate on public.qr_locali;

-- Anonymous callers can currently register arbitrary keys and certifications:
-- the functions validate shape but do not prove key ownership or verify ECDSA.
-- Public hash verification remains read-only and intentionally available.
revoke all on function public.register_checkvan_device_key(text, uuid, integer, text, text)
  from public, anon, authenticated;
revoke all on function public.register_checkvan_document_certification(uuid, text, integer, text, text, text, text, text, integer)
  from public, anon, authenticated;

revoke all on function public.verify_checkvan_document_hash(text)
  from public, authenticated, anon;
grant execute on function public.verify_checkvan_document_hash(text) to anon;

commit;
