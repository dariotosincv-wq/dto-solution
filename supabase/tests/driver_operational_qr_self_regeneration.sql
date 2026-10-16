create extension if not exists pgcrypto;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;

create table public.checkvan_organizations (id uuid primary key, name text not null);
create table public.checkvan_drivers (
  id uuid primary key,
  organization_id uuid not null references public.checkvan_organizations(id),
  first_name text not null,
  last_name text not null,
  status text not null check (status in ('active', 'archived')),
  unique (organization_id, id)
);

\ir ../migrations/20260909073620_driver_operational_qr_access.sql
\ir ../migrations/20261016215253_driver_operational_qr_self_regeneration.sql

create function public.test_assert(p_condition boolean, p_message text) returns void language plpgsql as $$ begin if not p_condition then raise exception '%', p_message; end if; end $$;

insert into public.checkvan_organizations values
  ('10000000-0000-0000-0000-000000000001', 'Org A'),
  ('20000000-0000-0000-0000-000000000002', 'Org B');
insert into public.checkvan_drivers values
  ('10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'Driver', 'Uno', 'active'),
  ('10000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'Driver', 'Due', 'active'),
  ('20000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000002', 'Driver', 'Tre', 'active');

insert into public.checkvan_driver_access_tokens(organization_id, driver_id, token_hash, created_by) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', repeat('a', 64), '10000000-0000-0000-0000-000000000011'),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000012', repeat('b', 64), '10000000-0000-0000-0000-000000000012'),
  ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000021', repeat('c', 64), '20000000-0000-0000-0000-000000000021');
insert into public.checkvan_driver_access_sessions(organization_id, driver_id, session_hash, expires_at) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', repeat('1', 64), now() + interval '1 hour'),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', repeat('2', 64), now() + interval '1 hour'),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000012', repeat('3', 64), now() + interval '1 hour'),
  ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000021', repeat('4', 64), now() + interval '1 hour');

select public.internal_driver_regenerate_operational_qr(repeat('1', 64), repeat('d', 64));
select public.test_assert((select count(*) = 1 from public.checkvan_driver_access_tokens where organization_id='10000000-0000-0000-0000-000000000001' and driver_id='10000000-0000-0000-0000-000000000011' and status='active'), 'exactly one active QR remains');
select public.test_assert((select status = 'revoked' from public.checkvan_driver_access_tokens where token_hash=repeat('a', 64)), 'previous QR is revoked');
select public.test_assert((select count(*) = 2 from public.checkvan_driver_access_sessions where driver_id='10000000-0000-0000-0000-000000000011' and expires_at <= now()), 'all prior sessions are invalidated');
select public.test_assert((select count(*) = 1 from public.checkvan_driver_access_events where driver_id='10000000-0000-0000-0000-000000000011' and event_type='SELF_REGENERATED' and revoked_session_count=2), 'audit records metadata only');
select public.test_assert((select count(*) = 1 from public.checkvan_driver_access_tokens where driver_id='10000000-0000-0000-0000-000000000012' and token_hash=repeat('b', 64) and status='active'), 'another driver cannot be changed by this session');
select public.test_assert((select count(*) = 1 from public.checkvan_driver_access_tokens where organization_id='20000000-0000-0000-0000-000000000002' and token_hash=repeat('c', 64) and status='active'), 'another organization remains isolated');

do $$ begin
  begin perform public.internal_driver_regenerate_operational_qr(repeat('1', 64), repeat('e', 64)); raise exception 'expected revoked session failure';
  exception when insufficient_privilege then if sqlerrm <> 'OPERATIONAL_ACCESS_REQUIRED' then raise; end if; end;
end $$;

update public.checkvan_drivers set status='archived' where id='10000000-0000-0000-0000-000000000012';
do $$ begin
  begin perform public.internal_driver_regenerate_operational_qr(repeat('3', 64), repeat('e', 64)); raise exception 'expected archived driver failure';
  exception when insufficient_privilege then if sqlerrm <> 'OPERATIONAL_ACCESS_REQUIRED' then raise; end if; end;
end $$;
select public.test_assert((select count(*) = 1 from public.checkvan_driver_access_tokens where driver_id='10000000-0000-0000-0000-000000000012' and status='active'), 'failed regeneration leaves the existing QR valid');
select public.test_assert((select count(*) = 1 from public.checkvan_driver_access_sessions where session_hash=repeat('3', 64) and expires_at > now()), 'failed regeneration leaves the existing session valid');

set role authenticated;
do $$ begin
  begin perform public.internal_driver_regenerate_operational_qr(repeat('4', 64), repeat('f', 64)); raise exception 'expected direct client execution denial';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
