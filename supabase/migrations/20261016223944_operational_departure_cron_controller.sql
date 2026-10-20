-- One fixed, global scheduler. It starts disabled and only internal server
-- functions can toggle it; there is never a job per organisation or per day.
--
-- This migration MUST be applied atomically through the Supabase administrative
-- migration channel. cron.schedule creates an active job by default; PostgreSQL
-- does not expose it to the scheduler until this transaction commits, and the
-- following cron.alter_job(false) is therefore required in this same transaction.
-- Do not execute individual statements from this file in the SQL editor.
create extension if not exists pg_cron with schema pg_catalog;

-- The application stores the job id itself. Runtime code must never read or
-- write cron.job directly: Supabase restricts that system table to cron admins.
create table public.checkvan_operational_departure_cron_controller (
  singleton boolean primary key default true check (singleton),
  job_id bigint not null unique,
  created_at timestamptz not null default now()
);
alter table public.checkvan_operational_departure_cron_controller enable row level security;
revoke all on table public.checkvan_operational_departure_cron_controller from public, anon, authenticated;

do $$
declare
  scheduler_job_id bigint;
begin
  scheduler_job_id := cron.schedule(
    'checkvan-operational-departure-timeouts',
    '5 seconds',
    'select public.internal_process_operational_departure_timeouts();'
  );
  perform cron.alter_job(job_id := scheduler_job_id, active := false);
  insert into public.checkvan_operational_departure_cron_controller(singleton, job_id)
  values (true, scheduler_job_id);
end;
$$;

create or replace function public.internal_refresh_operational_departure_cron()
returns void language plpgsql security definer set search_path = '' as $$
declare scheduler_job_id bigint; should_be_active boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('checkvan-operational-departure-cron-controller', 61));
  select job_id into scheduler_job_id
    from public.checkvan_operational_departure_cron_controller
   where singleton = true for update;
  if not found then
    raise exception using errcode = '55000', message = 'OPERATIONAL_DEPARTURE_CRON_UNAVAILABLE';
  end if;
  select exists (select 1 from public.checkvan_operational_departure_queues where status = 'active') into should_be_active;
  begin
    perform cron.alter_job(job_id := scheduler_job_id, active := should_be_active);
  exception when insufficient_privilege then
    raise exception using errcode = '42501', message = 'OPERATIONAL_DEPARTURE_CRON_CONTROL_UNAVAILABLE';
  end;
end;
$$;

-- A transient error for one company does not block the remaining active queues.
create or replace function public.internal_process_operational_departure_timeouts()
returns integer language plpgsql security definer set search_path = '' as $$
declare queue_row record; processed_count integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('checkvan-operational-departure-cron-controller', 61));
  for queue_row in select id from public.checkvan_operational_departure_queues where status = 'active' order by started_at, id loop
    begin
      perform public.internal_advance_operational_departure_queue(queue_row.id);
      processed_count := processed_count + 1;
    exception when others then
      raise warning 'Operational departure queue % could not advance: %', queue_row.id, sqlerrm;
    end;
  end loop;
  perform public.internal_refresh_operational_departure_cron();
  return processed_count;
end;
$$;

create or replace function public.internal_admin_start_operational_departure_queue(
  p_auth_subject uuid, p_organization_id uuid, p_date date, p_timeout_seconds integer default 30
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare day_row public.checkvan_operational_days%rowtype; queue_row public.checkvan_operational_departure_queues%rowtype; item record;
begin
  if not exists (select 1 from public.checkvan_area_memberships where auth_subject = p_auth_subject and organization_id = p_organization_id and role = 'COMPANY_ADMIN' and status = 'active') then
    raise exception using errcode = '42501', message = 'COMPANY_ADMIN_REQUIRED';
  end if;
  if p_timeout_seconds not between 10 and 600 then raise exception using errcode = '22023', message = 'INVALID_DEPARTURE_TIMEOUT'; end if;

  -- Fixed lock order avoids a start/end race that could leave Cron paused.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('checkvan-operational-departure-cron-controller', 61));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text || p_date::text, 53));
  select * into queue_row from public.checkvan_operational_departure_queues
   where organization_id = p_organization_id and operating_date = p_date for update;
  if found then
    if queue_row.status = 'active' then perform public.internal_refresh_operational_departure_cron(); end if;
    return jsonb_build_object('idempotent', true, 'queue', to_jsonb(queue_row));
  end if;

  select * into day_row from public.checkvan_operational_days
   where organization_id = p_organization_id and operating_date = p_date and status = 'confirmed' for update;
  if not found then raise exception using errcode = '22023', message = 'OPERATIONAL_DAY_NOT_CONFIRMED'; end if;
  if exists (select 1 from public.checkvan_operational_day_anomalies where organization_id = p_organization_id and operating_date = p_date and status = 'open') then
    raise exception using errcode = '22023', message = 'OPERATIONAL_DAY_ANOMALIES_OPEN';
  end if;
  if exists (select 1 from public.checkvan_operational_day_driver_rows where operational_day_id = day_row.id and work_status = 'TURNO' and departure_order is null) then
    raise exception using errcode = '22023', message = 'DEPARTURE_ORDER_MISSING';
  end if;

  insert into public.checkvan_operational_departure_queues(organization_id, operational_day_id, operating_date, timeout_seconds, started_by)
  values (p_organization_id, day_row.id, p_date, p_timeout_seconds, p_auth_subject) returning * into queue_row;
  for item in select * from public.checkvan_operational_day_driver_rows where operational_day_id = day_row.id and work_status = 'TURNO' order by departure_order loop
    insert into public.checkvan_operational_departure_queue_items(queue_id, organization_id, operational_row_id, driver_id, departure_order, departure_wave)
    values (queue_row.id, p_organization_id, item.id, item.driver_id, item.departure_order, item.departure_wave);
  end loop;
  perform public.internal_advance_operational_departure_queue(queue_row.id);
  -- Queue creation and scheduler activation are atomic: no scheduler, no start.
  perform public.internal_refresh_operational_departure_cron();
  return jsonb_build_object('idempotent', false, 'queue', to_jsonb(queue_row));
end;
$$;

revoke all on function public.internal_refresh_operational_departure_cron() from public, anon, authenticated;
revoke all on function public.internal_process_operational_departure_timeouts() from public, anon, authenticated;
revoke all on function public.internal_admin_start_operational_departure_queue(uuid, uuid, date, integer) from public, anon, authenticated;
grant execute on function public.internal_refresh_operational_departure_cron() to service_role;
grant execute on function public.internal_process_operational_departure_timeouts() to service_role;
grant execute on function public.internal_admin_start_operational_departure_queue(uuid, uuid, date, integer) to service_role;
