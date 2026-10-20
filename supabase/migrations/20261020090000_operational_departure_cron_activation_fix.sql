-- Corrects the incomplete administrative payload applied in production.
-- No cron job is created or activated by this migration.
create or replace function public.internal_admin_start_operational_departure_queue(
  p_auth_subject uuid, p_organization_id uuid, p_date date, p_timeout_seconds integer default 30
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare day_row public.checkvan_operational_days%rowtype; queue_row public.checkvan_operational_departure_queues%rowtype; item record;
begin
  if not exists (select 1 from public.checkvan_area_memberships where auth_subject = p_auth_subject and organization_id = p_organization_id and role = 'COMPANY_ADMIN' and status = 'active') then raise exception using errcode = '42501', message = 'COMPANY_ADMIN_REQUIRED'; end if;
  if p_timeout_seconds not between 10 and 600 then raise exception using errcode = '22023', message = 'INVALID_DEPARTURE_TIMEOUT'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('checkvan-operational-departure-cron-controller', 61));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text || p_date::text, 53));
  select * into queue_row from public.checkvan_operational_departure_queues where organization_id = p_organization_id and operating_date = p_date for update;
  if found then
    if queue_row.status = 'active' then perform public.internal_refresh_operational_departure_cron(); end if;
    return jsonb_build_object('idempotent', true, 'queue', to_jsonb(queue_row));
  end if;
  select * into day_row from public.checkvan_operational_days where organization_id = p_organization_id and operating_date = p_date and status = 'confirmed' for update;
  if not found then raise exception using errcode = '22023', message = 'OPERATIONAL_DAY_NOT_CONFIRMED'; end if;
  if exists(select 1 from public.checkvan_operational_day_anomalies where organization_id = p_organization_id and operating_date = p_date and status = 'open') then raise exception using errcode = '22023', message = 'OPERATIONAL_DAY_ANOMALIES_OPEN'; end if;
  if exists(select 1 from public.checkvan_operational_day_driver_rows where operational_day_id = day_row.id and work_status = 'TURNO' and departure_order is null) then raise exception using errcode = '22023', message = 'DEPARTURE_ORDER_MISSING'; end if;
  insert into public.checkvan_operational_departure_queues(organization_id, operational_day_id, operating_date, timeout_seconds, started_by) values(p_organization_id, day_row.id, p_date, p_timeout_seconds, p_auth_subject) returning * into queue_row;
  for item in select * from public.checkvan_operational_day_driver_rows where operational_day_id = day_row.id and work_status = 'TURNO' order by departure_order loop
    insert into public.checkvan_operational_departure_queue_items(queue_id, organization_id, operational_row_id, driver_id, departure_order, departure_wave) values(queue_row.id, p_organization_id, item.id, item.driver_id, item.departure_order, item.departure_wave);
  end loop;
  perform public.internal_advance_operational_departure_queue(queue_row.id);
  perform public.internal_refresh_operational_departure_cron();
  return jsonb_build_object('idempotent', false, 'queue', to_jsonb(queue_row));
end;
$$;

revoke all on function public.internal_admin_start_operational_departure_queue(uuid, uuid, date, integer) from public, anon, authenticated;
grant execute on function public.internal_admin_start_operational_departure_queue(uuid, uuid, date, integer) to service_role;
