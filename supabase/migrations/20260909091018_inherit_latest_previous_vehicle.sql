-- A new TURNO inherits only the latest preceding planned vehicle in its week.
-- Explicit selections, routes and effective overrides remain untouched.
create or replace function public.internal_admin_mutate_weekly_plan(p_auth_subject uuid,p_organization_id uuid,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  start_date date := (p_input->>'week_start')::date; day_date date := (p_input->>'assignment_date')::date;
  driver uuid := (p_input->>'driver_id')::uuid; vehicle uuid := nullif(p_input->>'vehicle_id','')::uuid;
  action text := p_input->>'action'; state text := p_input->>'work_status'; current_revision integer;
  copied integer := 0; copied_requirements integer := 0; changed jsonb; propagated jsonb := '[]'::jsonb;
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception 'COMPANY_ADMIN_REQUIRED'; end if;
  if start_date is null or extract(isodow from start_date) <> 1 or action is null or action not in ('SAVE','CLEAR','OVERRIDE','RESET_OVERRIDE','REQUIREMENT','COPY_PREVIOUS') then raise exception 'INVALID_PLANNING_INPUT'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text,8)); perform set_config('dto.planning_actor',p_auth_subject::text,true);
  select revision into current_revision from public.checkvan_weekly_plans where organization_id=p_organization_id and week_start=start_date; current_revision := coalesce(current_revision,0);
  if (p_input->>'revision')::integer is distinct from current_revision then raise exception 'PLANNING_STALE'; end if;
  if action <> 'COPY_PREVIOUS' and (day_date is null or day_date < start_date or day_date > start_date+6) then raise exception 'INVALID_PLANNING_DATE'; end if;
  if action in ('SAVE','OVERRIDE','CLEAR','RESET_OVERRIDE') and not exists(select 1 from public.checkvan_drivers where id=driver and organization_id=p_organization_id and (status='active' or action in ('CLEAR','RESET_OVERRIDE'))) then raise exception 'DRIVER_NOT_FOUND'; end if;
  if action in ('SAVE','OVERRIDE') then
    if state is null or state not in ('TURNO','RIPOSO','FERIE','PERMESSO','MALATTIA','ALTRO') then raise exception 'INVALID_WORK_STATUS'; end if;
    if state <> 'TURNO' then vehicle := null; end if;
    if vehicle is not null and not exists(select 1 from public.checkvan_vehicles where id=vehicle and organization_id=p_organization_id) then raise exception 'VEHICLE_NOT_FOUND'; end if;
  end if;
  insert into public.checkvan_weekly_plans(organization_id,week_start,revision,updated_by) values(p_organization_id,start_date,current_revision+1,p_auth_subject)
    on conflict (organization_id,week_start) do update set revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now();
  if action='SAVE' then
    if state='TURNO' and vehicle is null then
      select a.vehicle_id into vehicle from public.checkvan_planned_assignments a
      where a.organization_id=p_organization_id and a.week_start=start_date and a.driver_id=driver and a.assignment_date<day_date and a.work_status='TURNO' and a.vehicle_id is not null
      order by a.assignment_date desc limit 1;
    end if;
    insert into public.checkvan_planned_assignments(organization_id,week_start,assignment_date,driver_id,work_status,vehicle_id,route,notes,updated_by)
      values(p_organization_id,start_date,day_date,driver,state,vehicle,case when state='TURNO' then nullif(trim(p_input->>'route'),'') end,nullif(trim(p_input->>'notes'),''),p_auth_subject)
      on conflict (organization_id,assignment_date,driver_id) do update set work_status=excluded.work_status,vehicle_id=excluded.vehicle_id,route=excluded.route,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=now()
      returning to_jsonb(checkvan_planned_assignments.*) into changed;
    if state='TURNO' and vehicle is not null then
      with updated as (update public.checkvan_planned_assignments set vehicle_id=vehicle,updated_by=p_auth_subject,updated_at=now()
        where organization_id=p_organization_id and week_start=start_date and driver_id=driver and assignment_date>day_date and work_status='TURNO' and vehicle_id is null returning *)
      select coalesce(jsonb_agg(to_jsonb(updated)),'[]'::jsonb) into propagated from updated;
    end if;
  elsif action='CLEAR' then
    delete from public.checkvan_planned_assignments where organization_id=p_organization_id and assignment_date=day_date and driver_id=driver;
  elsif action='OVERRIDE' then
    insert into public.checkvan_assignment_overrides(organization_id,assignment_date,driver_id,work_status,vehicle_id,route,notes,updated_by)
      values(p_organization_id,day_date,driver,state,vehicle,case when state='TURNO' then nullif(trim(p_input->>'route'),'') end,nullif(trim(p_input->>'notes'),''),p_auth_subject)
      on conflict (organization_id,assignment_date,driver_id) do update set work_status=excluded.work_status,vehicle_id=excluded.vehicle_id,route=excluded.route,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=now()
      returning to_jsonb(checkvan_assignment_overrides.*) into changed;
  elsif action='RESET_OVERRIDE' then
    delete from public.checkvan_assignment_overrides where organization_id=p_organization_id and assignment_date=day_date and driver_id=driver;
    delete from public.checkvan_daily_assignments where organization_id=p_organization_id and assignment_date=day_date and driver_id=driver;
  elsif action='REQUIREMENT' then
    insert into public.checkvan_daily_requirements(organization_id,week_start,assignment_date,required_drivers,updated_by) values(p_organization_id,start_date,day_date,(p_input->>'required_drivers')::integer,p_auth_subject)
      on conflict (organization_id,assignment_date) do update set required_drivers=excluded.required_drivers,updated_by=excluded.updated_by,updated_at=now() returning to_jsonb(checkvan_daily_requirements.*) into changed;
  elsif action='COPY_PREVIOUS' then
    insert into public.checkvan_planned_assignments(organization_id,week_start,assignment_date,driver_id,work_status,vehicle_id,route,notes,updated_by)
      select p_organization_id,start_date,a.assignment_date+7,a.driver_id,a.work_status,a.vehicle_id,a.route,a.notes,p_auth_subject from public.checkvan_planned_assignments a join public.checkvan_drivers d on d.id=a.driver_id and d.organization_id=a.organization_id where a.organization_id=p_organization_id and a.week_start=start_date-7 and d.status='active' on conflict (organization_id,assignment_date,driver_id) do nothing;
    get diagnostics copied = row_count;
    insert into public.checkvan_daily_requirements(organization_id,week_start,assignment_date,required_drivers,updated_by) select p_organization_id,start_date,assignment_date+7,required_drivers,p_auth_subject from public.checkvan_daily_requirements where organization_id=p_organization_id and week_start=start_date-7 on conflict (organization_id,assignment_date) do nothing;
    get diagnostics copied_requirements = row_count;
  end if;
  return jsonb_build_object('revision',current_revision+1,'item',changed,'propagated',propagated,'copied',copied,'copied_requirements',copied_requirements);
end $$;
