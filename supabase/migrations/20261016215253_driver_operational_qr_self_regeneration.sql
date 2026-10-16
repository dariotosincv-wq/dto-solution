create table public.checkvan_driver_access_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  driver_id uuid not null,
  event_type text not null check (event_type in ('SELF_REGENERATED')),
  previous_token_id uuid,
  new_token_id uuid not null,
  revoked_session_count integer not null check (revoked_session_count >= 0),
  created_at timestamptz not null default now(),
  constraint checkvan_driver_access_event_driver_fk foreign key (organization_id, driver_id) references public.checkvan_drivers(organization_id, id) on delete restrict
);
create index checkvan_driver_access_events_driver_idx on public.checkvan_driver_access_events(organization_id, driver_id, created_at desc);
alter table public.checkvan_driver_access_events enable row level security;
revoke all on public.checkvan_driver_access_events from public, anon, authenticated;
grant select, insert on public.checkvan_driver_access_events to service_role;

create function public.internal_driver_regenerate_operational_qr(p_session_hash text, p_new_token_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_session public.checkvan_driver_access_sessions%rowtype; previous_token_id uuid; new_token public.checkvan_driver_access_tokens%rowtype; revoked_sessions integer;
begin
  if p_session_hash !~ '^[0-9a-f]{64}$' or p_new_token_hash !~ '^[0-9a-f]{64}$' then raise exception using errcode='22023', message='INVALID_OPERATIONAL_ACCESS_SECRET'; end if;
  select * into current_session from public.checkvan_driver_access_sessions where session_hash=p_session_hash and expires_at>now();
  if not found then raise exception using errcode='42501', message='OPERATIONAL_ACCESS_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(current_session.organization_id::text || current_session.driver_id::text, 11));
  select * into current_session from public.checkvan_driver_access_sessions where session_hash=p_session_hash and expires_at>now() for update;
  if not found then raise exception using errcode='42501', message='OPERATIONAL_ACCESS_REQUIRED'; end if;
  if not exists(select 1 from public.checkvan_drivers where organization_id=current_session.organization_id and id=current_session.driver_id and status='active') then raise exception using errcode='42501', message='OPERATIONAL_ACCESS_REQUIRED'; end if;
  select id into previous_token_id from public.checkvan_driver_access_tokens where organization_id=current_session.organization_id and driver_id=current_session.driver_id and status='active' for update;
  update public.checkvan_driver_access_tokens set status='revoked', revoked_at=now() where organization_id=current_session.organization_id and driver_id=current_session.driver_id and status='active';
  update public.checkvan_driver_access_sessions set expires_at=now() where organization_id=current_session.organization_id and driver_id=current_session.driver_id and expires_at>now();
  get diagnostics revoked_sessions = row_count;
  insert into public.checkvan_driver_access_tokens(organization_id, driver_id, token_hash, created_by) values(current_session.organization_id, current_session.driver_id, p_new_token_hash, current_session.driver_id) returning * into new_token;
  insert into public.checkvan_driver_access_events(organization_id, driver_id, event_type, previous_token_id, new_token_id, revoked_session_count) values(current_session.organization_id, current_session.driver_id, 'SELF_REGENERATED', previous_token_id, new_token.id, revoked_sessions);
  return jsonb_build_object('organization_id', current_session.organization_id, 'driver_id', current_session.driver_id, 'token_id', new_token.id);
end $$;
revoke all on function public.internal_driver_regenerate_operational_qr(text, text) from public, anon, authenticated;
grant execute on function public.internal_driver_regenerate_operational_qr(text, text) to service_role;
