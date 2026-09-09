-- Weekly planning is server-only, like the existing driver directory.
alter table public.checkvan_drivers add column expected_weekly_days smallint
  check (expected_weekly_days between 0 and 7);

create table public.checkvan_weekly_plans (
  organization_id uuid not null references public.checkvan_organizations(id),
  week_start date not null check (extract(isodow from week_start) = 1),
  revision integer not null default 0 check (revision >= 0),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, week_start)
);
create table public.checkvan_planned_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  week_start date not null,
  assignment_date date not null,
  driver_id uuid not null,
  work_status text not null check (work_status in ('TURNO','RIPOSO','FERIE','PERMESSO','MALATTIA','ALTRO')),
  vehicle_id uuid,
  route text check (length(route) <= 100),
  notes text check (length(notes) <= 2000),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  foreign key (organization_id, week_start) references public.checkvan_weekly_plans(organization_id, week_start),
  foreign key (organization_id, driver_id) references public.checkvan_drivers(organization_id, id),
  foreign key (organization_id, vehicle_id) references public.checkvan_vehicles(organization_id, id),
  unique (organization_id, assignment_date, driver_id),
  check (assignment_date between week_start and week_start + 6),
  check (work_status = 'TURNO' or (vehicle_id is null and route is null))
);
create index checkvan_planned_week_idx on public.checkvan_planned_assignments(organization_id, week_start);
create index checkvan_planned_driver_idx on public.checkvan_planned_assignments(organization_id, driver_id, assignment_date desc);
create index checkvan_planned_vehicle_idx on public.checkvan_planned_assignments(organization_id, vehicle_id, assignment_date) where vehicle_id is not null;

create table public.checkvan_daily_requirements (
  organization_id uuid not null,
  week_start date not null,
  assignment_date date not null,
  required_drivers integer check (required_drivers between 0 and 1000),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, assignment_date),
  foreign key (organization_id, week_start) references public.checkvan_weekly_plans(organization_id, week_start),
  check (assignment_date between week_start and week_start + 6)
);
create index checkvan_requirements_week_idx on public.checkvan_daily_requirements(organization_id, week_start);

-- Full operational override, independent of the planned record and its lifetime.
create table public.checkvan_assignment_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id),
  assignment_date date not null,
  driver_id uuid not null,
  work_status text not null check (work_status in ('TURNO','RIPOSO','FERIE','PERMESSO','MALATTIA','ALTRO')),
  vehicle_id uuid,
  route text check (length(route) <= 100),
  notes text check (length(notes) <= 2000),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  foreign key (organization_id, driver_id) references public.checkvan_drivers(organization_id, id),
  foreign key (organization_id, vehicle_id) references public.checkvan_vehicles(organization_id, id),
  unique (organization_id, assignment_date, driver_id),
  check (work_status = 'TURNO' or (vehicle_id is null and route is null))
);
create index checkvan_overrides_driver_idx on public.checkvan_assignment_overrides(organization_id, driver_id, assignment_date desc);
create index checkvan_overrides_vehicle_idx on public.checkvan_assignment_overrides(organization_id, vehicle_id, assignment_date) where vehicle_id is not null;

create table public.checkvan_planning_history (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.checkvan_organizations(id),
  entity text not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  operation text not null,
  before_value jsonb,
  after_value jsonb
);
create index checkvan_planning_history_org_time_idx on public.checkvan_planning_history(organization_id, changed_at desc);

create function public.internal_checkvan_planning_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_row jsonb; after_row jsonb; actor uuid;
begin
  if TG_OP <> 'INSERT' then before_row := to_jsonb(old); end if;
  if TG_OP <> 'DELETE' then after_row := to_jsonb(new); end if;
  actor := nullif(current_setting('dto.planning_actor', true), '')::uuid;
  if TG_TABLE_NAME = 'checkvan_drivers' then
    if before_row->'expected_weekly_days' is not distinct from after_row->'expected_weekly_days' then return new; end if;
    before_row := jsonb_build_object('organization_id',old.organization_id,'driver_id',old.id,'expected_weekly_days',old.expected_weekly_days);
    after_row := jsonb_build_object('organization_id',new.organization_id,'driver_id',new.id,'expected_weekly_days',new.expected_weekly_days);
  end if;
  insert into public.checkvan_planning_history(organization_id,entity,changed_by,operation,before_value,after_value)
  values(coalesce(after_row->>'organization_id',before_row->>'organization_id')::uuid,TG_TABLE_NAME,
    coalesce(actor,(after_row->>'updated_by')::uuid,(after_row->>'assigned_by')::uuid),TG_OP,before_row,after_row);
  return coalesce(new,old);
end $$;
create trigger planning_entry_audit after insert or update or delete on public.checkvan_planned_assignments for each row execute function public.internal_checkvan_planning_audit();
create trigger planning_requirement_audit after insert or update or delete on public.checkvan_daily_requirements for each row execute function public.internal_checkvan_planning_audit();
create trigger planning_override_audit after insert or update or delete on public.checkvan_assignment_overrides for each row execute function public.internal_checkvan_planning_audit();
create trigger planning_daily_audit after insert or update or delete on public.checkvan_daily_assignments for each row execute function public.internal_checkvan_planning_audit();
create trigger planning_profile_audit after update of expected_weekly_days on public.checkvan_drivers for each row execute function public.internal_checkvan_planning_audit();

create function public.internal_admin_set_driver_profile(p_auth_subject uuid,p_organization_id uuid,p_driver_id uuid,p_days integer)
returns public.checkvan_drivers language plpgsql security invoker set search_path='' as $$
declare result public.checkvan_drivers;
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception 'COMPANY_ADMIN_REQUIRED'; end if;
  if p_days is not null and (p_days < 0 or p_days > 7) then raise exception 'INVALID_DRIVER_PROFILE'; end if;
  perform set_config('dto.planning_actor',p_auth_subject::text,true);
  update public.checkvan_drivers set expected_weekly_days=p_days,updated_at=now() where organization_id=p_organization_id and id=p_driver_id returning * into result;
  if not found then raise exception 'DRIVER_NOT_FOUND'; end if;
  return result;
end $$;

create function public.internal_admin_mutate_weekly_plan(p_auth_subject uuid,p_organization_id uuid,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  start_date date := (p_input->>'week_start')::date;
  day_date date := (p_input->>'assignment_date')::date;
  driver uuid := (p_input->>'driver_id')::uuid;
  vehicle uuid := nullif(p_input->>'vehicle_id','')::uuid;
  action text := p_input->>'action';
  state text := p_input->>'work_status';
  current_revision integer;
  copied integer := 0;
  copied_requirements integer := 0;
  changed jsonb;
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception 'COMPANY_ADMIN_REQUIRED'; end if;
  if start_date is null or extract(isodow from start_date) <> 1 or action is null or action not in ('SAVE','CLEAR','OVERRIDE','RESET_OVERRIDE','REQUIREMENT','COPY_PREVIOUS') then raise exception 'INVALID_PLANNING_INPUT'; end if;
  -- A single lock covers adjacent-week copy and all mutations in this organization.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text,8));
  perform set_config('dto.planning_actor',p_auth_subject::text,true);
  select revision into current_revision from public.checkvan_weekly_plans where organization_id=p_organization_id and week_start=start_date;
  current_revision := coalesce(current_revision,0);
  if (p_input->>'revision')::integer is distinct from current_revision then raise exception 'PLANNING_STALE'; end if;
  if action <> 'COPY_PREVIOUS' and (day_date is null or day_date < start_date or day_date > start_date+6) then raise exception 'INVALID_PLANNING_DATE'; end if;
  if action in ('SAVE','OVERRIDE','CLEAR','RESET_OVERRIDE') and not exists(select 1 from public.checkvan_drivers where id=driver and organization_id=p_organization_id and (status='active' or action in ('CLEAR','RESET_OVERRIDE'))) then raise exception 'DRIVER_NOT_FOUND'; end if;
  if action in ('SAVE','OVERRIDE') then
    if state is null or state not in ('TURNO','RIPOSO','FERIE','PERMESSO','MALATTIA','ALTRO') then raise exception 'INVALID_WORK_STATUS'; end if;
    if state <> 'TURNO' then vehicle := null; end if;
    if vehicle is not null and not exists(select 1 from public.checkvan_vehicles where id=vehicle and organization_id=p_organization_id) then raise exception 'VEHICLE_NOT_FOUND'; end if;
  end if;
  insert into public.checkvan_weekly_plans(organization_id,week_start,revision,updated_by)
  values(p_organization_id,start_date,current_revision+1,p_auth_subject)
  on conflict (organization_id,week_start) do update set revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now();

  if action='SAVE' then
    insert into public.checkvan_planned_assignments(organization_id,week_start,assignment_date,driver_id,work_status,vehicle_id,route,notes,updated_by)
    values(p_organization_id,start_date,day_date,driver,state,vehicle,case when state='TURNO' then nullif(trim(p_input->>'route'),'') end,nullif(trim(p_input->>'notes'),''),p_auth_subject)
    on conflict (organization_id,assignment_date,driver_id) do update set work_status=excluded.work_status,vehicle_id=excluded.vehicle_id,route=excluded.route,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=now()
    returning to_jsonb(checkvan_planned_assignments.*) into changed;
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
    insert into public.checkvan_daily_requirements(organization_id,week_start,assignment_date,required_drivers,updated_by)
    values(p_organization_id,start_date,day_date,(p_input->>'required_drivers')::integer,p_auth_subject)
    on conflict (organization_id,assignment_date) do update set required_drivers=excluded.required_drivers,updated_by=excluded.updated_by,updated_at=now()
    returning to_jsonb(checkvan_daily_requirements.*) into changed;
  elsif action='COPY_PREVIOUS' then
    insert into public.checkvan_planned_assignments(organization_id,week_start,assignment_date,driver_id,work_status,vehicle_id,route,notes,updated_by)
    select p_organization_id,start_date,a.assignment_date+7,a.driver_id,a.work_status,a.vehicle_id,a.route,a.notes,p_auth_subject
    from public.checkvan_planned_assignments a join public.checkvan_drivers d on d.id=a.driver_id and d.organization_id=a.organization_id
    where a.organization_id=p_organization_id and a.week_start=start_date-7 and d.status='active'
    on conflict (organization_id,assignment_date,driver_id) do nothing;
    get diagnostics copied = row_count;
    insert into public.checkvan_daily_requirements(organization_id,week_start,assignment_date,required_drivers,updated_by)
    select p_organization_id,start_date,assignment_date+7,required_drivers,p_auth_subject from public.checkvan_daily_requirements
    where organization_id=p_organization_id and week_start=start_date-7
    on conflict (organization_id,assignment_date) do nothing;
    get diagnostics copied_requirements = row_count;
  end if;
  return jsonb_build_object('revision',current_revision+1,'item',changed,'copied',copied,'copied_requirements',copied_requirements);
end $$;

-- One MVCC snapshot for revision + rows, avoiding mixed versions during concurrent edits.
create function public.internal_read_weekly_plan(p_organization_id uuid,p_start date,p_end date)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'revision',coalesce((select revision from public.checkvan_weekly_plans where organization_id=p_organization_id and week_start=p_start-(extract(isodow from p_start)::integer-1)),0),
    'entries',coalesce((select jsonb_agg(a) from public.checkvan_planned_assignments a where organization_id=p_organization_id and assignment_date between p_start and p_end),'[]'::jsonb),
    'requirements',coalesce((select jsonb_agg(r) from public.checkvan_daily_requirements r where organization_id=p_organization_id and assignment_date between p_start and p_end),'[]'::jsonb),
    'overrides',coalesce((select jsonb_agg(o) from public.checkvan_assignment_overrides o where organization_id=p_organization_id and assignment_date between p_start and p_end),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(d) from public.checkvan_daily_assignments d where organization_id=p_organization_id and assignment_date between p_start and p_end),'[]'::jsonb)
  );
$$;

alter table public.checkvan_weekly_plans enable row level security;
alter table public.checkvan_planned_assignments enable row level security;
alter table public.checkvan_daily_requirements enable row level security;
alter table public.checkvan_assignment_overrides enable row level security;
alter table public.checkvan_planning_history enable row level security;
revoke all on public.checkvan_weekly_plans,public.checkvan_planned_assignments,public.checkvan_daily_requirements,public.checkvan_assignment_overrides,public.checkvan_planning_history from public,anon,authenticated;
grant select,insert,update,delete on public.checkvan_weekly_plans,public.checkvan_planned_assignments,public.checkvan_daily_requirements,public.checkvan_assignment_overrides to service_role;
grant select on public.checkvan_planning_history to service_role;
revoke all on function public.internal_checkvan_planning_audit(),public.internal_admin_set_driver_profile(uuid,uuid,uuid,integer),public.internal_admin_mutate_weekly_plan(uuid,uuid,jsonb),public.internal_read_weekly_plan(uuid,date,date) from public,anon,authenticated;
grant execute on function public.internal_admin_set_driver_profile(uuid,uuid,uuid,integer),public.internal_admin_mutate_weekly_plan(uuid,uuid,jsonb),public.internal_read_weekly_plan(uuid,date,date) to service_role;

-- Bridge the existing daily vehicle editor. Keep its assignment semantics and audit
-- every change, while preserving the planned vehicle and explicit operational notes.
create function public.internal_admin_set_operational_vehicle(p_auth_subject uuid,p_organization_id uuid,p_date date,p_driver_id uuid,p_vehicle_id uuid)
returns public.checkvan_daily_assignments language plpgsql security invoker set search_path='' as $$
declare result public.checkvan_daily_assignments; start_date date := p_date-(extract(isodow from p_date)::integer-1);
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception 'COMPANY_ADMIN_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text,8));
  perform set_config('dto.planning_actor',p_auth_subject::text,true);
  result := public.internal_admin_set_checkvan_assignment(p_auth_subject,p_organization_id,p_date,p_driver_id,p_vehicle_id);
  update public.checkvan_assignment_overrides set work_status='TURNO',vehicle_id=p_vehicle_id,updated_by=p_auth_subject,updated_at=now()
    where organization_id=p_organization_id and assignment_date=p_date and driver_id=p_driver_id;
  insert into public.checkvan_weekly_plans(organization_id,week_start,revision,updated_by) values(p_organization_id,start_date,1,p_auth_subject)
    on conflict (organization_id,week_start) do update set revision=checkvan_weekly_plans.revision+1,updated_by=excluded.updated_by,updated_at=now();
  return result;
end $$;
revoke all on function public.internal_admin_set_operational_vehicle(uuid,uuid,date,uuid,uuid) from public,anon,authenticated;
grant execute on function public.internal_admin_set_operational_vehicle(uuid,uuid,date,uuid,uuid) to service_role;

create function public.internal_admin_copy_operational_assignments(p_auth_subject uuid,p_organization_id uuid,p_date date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; start_date date := p_date-(extract(isodow from p_date)::integer-1);
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception 'COMPANY_ADMIN_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text,8));
  perform set_config('dto.planning_actor',p_auth_subject::text,true);
  result := public.internal_admin_copy_checkvan_assignments(p_auth_subject,p_organization_id,p_date);
  if (result->>'copied')::integer > 0 then
    insert into public.checkvan_weekly_plans(organization_id,week_start,revision,updated_by) values(p_organization_id,start_date,1,p_auth_subject)
      on conflict (organization_id,week_start) do update set revision=checkvan_weekly_plans.revision+1,updated_by=excluded.updated_by,updated_at=now();
  end if;
  return result;
end $$;
revoke all on function public.internal_admin_copy_operational_assignments(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.internal_admin_copy_operational_assignments(uuid,uuid,date) to service_role;
