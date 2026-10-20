-- Isolated PostgreSQL integration test. It uses only synthetic organizations, drivers and vehicles.
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $$;
create table public.checkvan_organizations (id uuid primary key, name text not null);
create table public.checkvan_area_memberships (auth_subject uuid not null, organization_id uuid not null references public.checkvan_organizations(id), role text not null, status text not null);
create table public.checkvan_drivers (id uuid primary key, organization_id uuid not null references public.checkvan_organizations(id), first_name text not null, last_name text not null, driver_code text, status text not null default 'active', unique(organization_id,id));
create table public.checkvan_vehicles (id uuid primary key, organization_id uuid not null references public.checkvan_organizations(id), internal_code text not null, plate text not null, plate_normalized text not null, silhouette_category text not null default 'SMALL', status text not null default 'active', unique(organization_id,id));

\ir ../migrations/20261016152104_operational_day_history.sql
\ir ../migrations/20261016171406_operational_day_anomalies.sql
\ir ../migrations/20260909073620_driver_operational_qr_access.sql
\ir ../migrations/20261016215253_driver_operational_qr_self_regeneration.sql
\ir ../migrations/20261016220442_operational_departure_queue.sql
\ir ../migrations/20261016223943_operational_departure_queue_final_timeout.sql

create function public.test_assert(value boolean, message text) returns void language plpgsql as $$ begin if not value then raise exception '%',message; end if; end $$;

do $$
declare org_a uuid := '91000000-0000-4000-8000-000000000001'; org_b uuid := '92000000-0000-4000-8000-000000000002'; admin_a uuid := '91000000-0000-4000-8000-000000000010'; admin_b uuid := '92000000-0000-4000-8000-000000000010'; other uuid := '93000000-0000-4000-8000-000000000010'; result jsonb; q_id uuid; row_data jsonb := '[]'::jsonb; i integer; driver_id uuid; vehicle_id uuid;
begin
 insert into public.checkvan_organizations values(org_a,'Queue A'),(org_b,'Queue B');
 insert into public.checkvan_area_memberships values(admin_a,org_a,'COMPANY_ADMIN','active'),(admin_b,org_b,'COMPANY_ADMIN','active');
 for i in 1..45 loop
   driver_id := ('91000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
   vehicle_id := ('91000000-0000-4001-8000-' || lpad(i::text,12,'0'))::uuid;
   insert into public.checkvan_drivers(id,organization_id,first_name,last_name,driver_code) values(driver_id,org_a,'Driver',lpad(i::text,2,'0'),'D'||i);
   insert into public.checkvan_vehicles(id,organization_id,internal_code,plate,plate_normalized) values(vehicle_id,org_a,'V'||i,'AA'||lpad(i::text,3,'0')||'BB','AA'||lpad(i::text,3,'0')||'BB');
   row_data := row_data || jsonb_build_array(jsonb_build_object('driver_id',driver_id,'work_status','TURNO','vehicle_id',vehicle_id,'route','R'||i,'departure_order',i,'departure_group',case when i<=33 then 1 else 2 end,'parking_lot_position',case when i<=33 then i-1 else i-34 end,'departure_wave',case when i<=33 then 1 else 2 end));
 end loop;
 result := public.internal_admin_confirm_operational_day(admin_a,org_a,jsonb_build_object('action','CONFIRM','operating_date','2031-01-15','idempotency_key','91000000-0000-4000-8000-000000000099','rows',row_data));
 perform public.test_assert(result->>'idempotent'='false','45-driver confirmed day created');
 result := public.internal_admin_start_operational_departure_queue(admin_a,org_a,'2031-01-15',30);
 q_id := (result->'queue'->>'id')::uuid;
 perform public.test_assert(result->>'idempotent'='false','first start creates queue');
 perform public.test_assert((select count(*)=45 from public.checkvan_operational_departure_queue_items where queue_id=q_id),'45 queue items created');
 perform public.test_assert((select departure_order=1 and departure_wave=1 and status='called' from public.checkvan_operational_departure_queue_items where queue_id=q_id and departure_order=1),'first global order called');
 perform public.test_assert((select count(*)=1 from public.checkvan_operational_departure_queue_items where queue_id=q_id and status='called'),'only one driver is green');
 result := public.internal_admin_start_operational_departure_queue(admin_a,org_a,'2031-01-15',30);
 perform public.test_assert(result->>'idempotent'='true','start is idempotent');
 result := public.internal_driver_confirm_operational_departure(org_a,'91000000-0000-4000-8000-000000000001','2031-01-15','driver_web');
 perform public.test_assert(result->>'idempotent'='false','called driver can depart');
 perform public.test_assert((select status='called' from public.checkvan_operational_departure_queue_items where queue_id=q_id and departure_order=2),'confirmation advances continuous queue');
 update public.checkvan_operational_departure_queue_items set timeout_at=now()-interval '1 second' where queue_id=q_id and departure_order=2;
 perform public.internal_process_operational_departure_timeouts();
 perform public.test_assert((select status='timed_out' from public.checkvan_operational_departure_queue_items where queue_id=q_id and departure_order=2),'timeout marks late driver');
 perform public.test_assert((select status='called' from public.checkvan_operational_departure_queue_items where queue_id=q_id and departure_order=3),'timeout advances queue');
 result := public.internal_driver_confirm_operational_departure(org_a,'91000000-0000-4000-8000-000000000002','2031-01-15','driver_web');
 perform public.test_assert(result->>'idempotent'='false','late driver can depart');
 perform public.test_assert((select count(*)=1 from public.checkvan_operational_departure_queue_items where queue_id=q_id and status='called'),'late confirmation preserves one called driver');
 -- Advance synthetic drivers 3..33, proving the sequence crosses the descriptive wave boundary without a new start.
 for i in 3..33 loop
   update public.checkvan_operational_departure_queue_items set timeout_at=now()-interval '1 second' where queue_id=q_id and status='called';
   perform public.internal_process_operational_departure_timeouts();
 end loop;
 perform public.test_assert((select status='called' and departure_order=34 and departure_wave=2 from public.checkvan_operational_departure_queue_items where queue_id=q_id and departure_order=34),'wave 1 to wave 2 is continuous');
 perform public.test_assert((select count(*)=1 from public.checkvan_operational_departure_queue_items where queue_id=q_id and status='called'),'one called driver after wave transition');
 -- Final driver stays recoverable for ten minutes after its call, even after its 30-second timeout.
 for i in 34..44 loop
   result := public.internal_driver_confirm_operational_departure(org_a,('91000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'2031-01-15','driver_web');
   perform public.test_assert(result->>'idempotent'='false','each remaining driver can depart');
 end loop;
 perform public.test_assert((select status='called' from public.checkvan_operational_departure_queue_items where queue_id=q_id and departure_order=45),'final driver is called');
 perform public.test_assert((select final_timeout_at between now()+interval '9 minutes' and now()+interval '10 minutes 1 second' from public.checkvan_operational_departure_queues where id=q_id),'final recovery deadline is ten minutes');
 update public.checkvan_operational_departure_queue_items set timeout_at=now()-interval '1 second' where queue_id=q_id and departure_order=45;
 perform public.internal_process_operational_departure_timeouts();
 perform public.test_assert((select status='timed_out' from public.checkvan_operational_departure_queue_items where queue_id=q_id and departure_order=45),'final driver times out without being discarded');
 perform public.test_assert((select status='active' from public.checkvan_operational_departure_queues where id=q_id),'queue remains active during final recovery window');
 update public.checkvan_operational_departure_queues set final_timeout_at=now()-interval '1 second' where id=q_id;
 perform public.internal_process_operational_departure_timeouts();
 perform public.test_assert((select status='completed' from public.checkvan_operational_departure_queues where id=q_id),'queue closes after final ten-minute window');
 result := public.internal_driver_confirm_operational_departure(org_a,'91000000-0000-4000-8000-000000000045','2031-01-15','driver_web');
 perform public.test_assert(result->>'idempotent'='false','late final confirmation remains accepted after closure');
 perform public.test_assert((select count(*)=45 from public.checkvan_operational_departure_queue_items where queue_id=q_id),'late confirmation preserves all historical queue items');
 begin perform public.internal_admin_read_operational_departure_queue(other,org_a,'2031-01-15'); raise exception 'unauthorized admin read accepted'; exception when insufficient_privilege then perform public.test_assert(sqlerrm='COMPANY_ADMIN_REQUIRED','DSP authorization enforced'); end;
 begin perform public.internal_driver_confirm_operational_departure(org_b,'91000000-0000-4000-8000-000000000034','2031-01-15','driver_web'); raise exception 'cross organization confirm accepted'; exception when insufficient_privilege then perform public.test_assert(sqlerrm='DEPARTURE_NOT_AVAILABLE','organization isolation enforced'); end;
end $$;

-- QR revocation remains independent of queue history: invalidates session, does not alter queue data.
insert into public.checkvan_driver_access_tokens(organization_id,driver_id,token_hash,created_by) values('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000045',repeat('a',64),'91000000-0000-4000-8000-000000000045');
insert into public.checkvan_driver_access_sessions(organization_id,driver_id,session_hash,expires_at) values('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000045',repeat('1',64),now()+interval '1 hour');
select public.internal_driver_regenerate_operational_qr(repeat('1',64),repeat('b',64));
select public.test_assert((select expires_at<=now() from public.checkvan_driver_access_sessions where session_hash=repeat('1',64)),'revoked QR invalidates prior session during queue');
select public.test_assert((select count(*)=1 from public.checkvan_operational_departure_queue_items where organization_id='91000000-0000-4000-8000-000000000001' and departure_order=45 and status='departed'),'QR revocation does not alter queue history');

set role authenticated;
do $$ begin perform public.internal_admin_start_operational_departure_queue('91000000-0000-4000-8000-000000000010','91000000-0000-4000-8000-000000000001','2031-01-15',30); raise exception 'direct client execution accepted'; exception when insufficient_privilege then null; end $$;
reset role;
select public.test_assert(not has_table_privilege('authenticated','public.checkvan_operational_departure_queues','select'),'direct table access denied');
select public.test_assert((select relrowsecurity from pg_class where oid='public.checkvan_operational_departure_queues'::regclass),'queue RLS enabled');
select 'PASS: 45 drivers, global queue, final 10-minute recovery, late confirmation, wave transition, QR revocation, isolation and RLS' as result;
