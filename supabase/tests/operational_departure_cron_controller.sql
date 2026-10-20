-- Isolated pg_cron controller test; all data below is synthetic.
-- The Supabase PostgreSQL image already ships pgcrypto.
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
\ir ../migrations/20261016220442_operational_departure_queue.sql
\ir ../migrations/20261016223943_operational_departure_queue_final_timeout.sql
-- The scheduler is created and disabled in one transaction.  A cron worker
-- cannot see an uncommitted job, so this test never exposes an active job.
begin;
\ir ../migrations/20261016223944_operational_departure_cron_controller.sql
commit;

create function public.test_assert(value boolean, message text) returns void language plpgsql as $$ begin if not value then raise exception '%', message; end if; end $$;

do $$
declare
  org_a uuid := 'a1000000-0000-4000-8000-000000000001';
  org_b uuid := 'b1000000-0000-4000-8000-000000000001';
  admin_a uuid := 'a1000000-0000-4000-8000-000000000010';
  admin_b uuid := 'b1000000-0000-4000-8000-000000000010';
  driver_a uuid := 'a1000000-0000-4000-8000-000000000011';
  driver_b uuid := 'b1000000-0000-4000-8000-000000000011';
  vehicle_a uuid := 'a1000000-0000-4000-8000-000000000012';
  vehicle_b uuid := 'b1000000-0000-4000-8000-000000000012';
  result jsonb;
  rows_a jsonb;
  rows_b jsonb;
begin
  perform public.test_assert((select schedule='5 seconds' and not active from cron.job where jobname='checkvan-operational-departure-timeouts'),'fixed five-second job starts inactive');
  insert into public.checkvan_organizations values(org_a,'Cron A'),(org_b,'Cron B');
  insert into public.checkvan_area_memberships values(admin_a,org_a,'COMPANY_ADMIN','active'),(admin_b,org_b,'COMPANY_ADMIN','active');
  insert into public.checkvan_drivers(id,organization_id,first_name,last_name,driver_code) values(driver_a,org_a,'Driver','A','A1'),(driver_b,org_b,'Driver','B','B1');
  insert into public.checkvan_vehicles(id,organization_id,internal_code,plate,plate_normalized) values(vehicle_a,org_a,'VA','AA001AA','AA001AA'),(vehicle_b,org_b,'VB','BB001BB','BB001BB');
  rows_a := jsonb_build_array(jsonb_build_object('driver_id',driver_a,'work_status','TURNO','vehicle_id',vehicle_a,'route','RA','departure_order',1));
  rows_b := jsonb_build_array(jsonb_build_object('driver_id',driver_b,'work_status','TURNO','vehicle_id',vehicle_b,'route','RB','departure_order',1));
  perform public.internal_admin_confirm_operational_day(admin_a,org_a,jsonb_build_object('action','CONFIRM','operating_date','2032-01-15','idempotency_key','a1000000-0000-4000-8000-000000000101','rows',rows_a));
  perform public.internal_admin_confirm_operational_day(admin_b,org_b,jsonb_build_object('action','CONFIRM','operating_date','2032-01-15','idempotency_key','b1000000-0000-4000-8000-000000000101','rows',rows_b));
  perform public.internal_admin_confirm_operational_day(admin_a,org_a,jsonb_build_object('action','CONFIRM','operating_date','2032-01-16','idempotency_key','a1000000-0000-4000-8000-000000000102','rows',rows_a));
  perform public.internal_admin_confirm_operational_day(admin_a,org_a,jsonb_build_object('action','CONFIRM','operating_date','2032-01-17','idempotency_key','a1000000-0000-4000-8000-000000000103','rows',rows_a));
  perform public.internal_admin_confirm_operational_day(admin_b,org_b,jsonb_build_object('action','CONFIRM','operating_date','2032-01-17','idempotency_key','b1000000-0000-4000-8000-000000000102','rows',rows_b));

  perform public.internal_admin_start_operational_departure_queue(admin_a,org_a,'2032-01-15',30);
  perform public.test_assert((select active from cron.job where jobname='checkvan-operational-departure-timeouts'),'first active queue enables job');
  perform public.internal_admin_start_operational_departure_queue(admin_b,org_b,'2032-01-15',30);
  perform public.internal_driver_confirm_operational_departure(org_a,driver_a,'2032-01-15','driver_web');
  perform public.internal_process_operational_departure_timeouts();
  perform public.test_assert((select active from cron.job where jobname='checkvan-operational-departure-timeouts'),'completing A leaves scheduler enabled while B is active');
  perform public.internal_driver_confirm_operational_departure(org_b,driver_b,'2032-01-15','driver_web');
  perform public.internal_process_operational_departure_timeouts();
  perform public.test_assert((select not active from cron.job where jobname='checkvan-operational-departure-timeouts'),'all completed queues disable job');

  perform cron.unschedule((select jobid from cron.job where jobname='checkvan-operational-departure-timeouts'));
  begin
    perform public.internal_admin_start_operational_departure_queue(admin_a,org_a,'2032-01-16',30);
    raise exception 'start accepted without scheduler';
  exception when object_not_in_prerequisite_state then
    perform public.test_assert(sqlerrm='OPERATIONAL_DEPARTURE_CRON_UNAVAILABLE','missing scheduler fails clearly');
  end;
  perform public.test_assert(not exists(select 1 from public.checkvan_operational_departure_queues where organization_id=org_a and operating_date='2032-01-16'),'failed scheduler activation rolls queue creation back');
  -- Recreate-and-disable is atomic because this DO block is one transaction:
  -- do not allow a test job to commit active.
  perform cron.schedule('checkvan-operational-departure-timeouts','5 seconds','select public.internal_process_operational_departure_timeouts();');
  perform cron.alter_job(job_id := (select jobid from cron.job where jobname='checkvan-operational-departure-timeouts'), active := false);
  perform public.internal_admin_start_operational_departure_queue(admin_a,org_a,'2032-01-16',30);
  perform public.test_assert((select active from cron.job where jobname='checkvan-operational-departure-timeouts'),'scheduler reactivates on following day');
  perform public.internal_driver_confirm_operational_departure(org_a,driver_a,'2032-01-16','driver_web');
  perform public.internal_process_operational_departure_timeouts();
  perform public.test_assert((select not active from cron.job where jobname='checkvan-operational-departure-timeouts'),'scheduler stops again after following day');
end $$;

select 'READY_FOR_CONCURRENT_STARTS' as result;
