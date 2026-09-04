create table public.checkvan_drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  driver_code text,
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text not null check (length(trim(last_name)) between 1 and 100),
  status text not null default 'active' check (status in ('active','archived')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  check (driver_code is null or length(trim(driver_code)) between 1 and 80)
);
create unique index checkvan_drivers_org_code_uidx on public.checkvan_drivers(organization_id,upper(driver_code)) where driver_code is not null;
create index checkvan_drivers_org_status_name_idx on public.checkvan_drivers(organization_id,status,last_name,first_name);

create table public.checkvan_daily_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  assignment_date date not null,
  driver_id uuid not null,
  vehicle_id uuid not null,
  assigned_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checkvan_assignment_driver_org_fk foreign key (organization_id,driver_id) references public.checkvan_drivers(organization_id,id) on delete restrict,
  constraint checkvan_assignment_vehicle_org_fk foreign key (organization_id,vehicle_id) references public.checkvan_vehicles(organization_id,id) on delete restrict,
  unique (organization_id,assignment_date,driver_id),
  unique (organization_id,assignment_date,vehicle_id)
);
create index checkvan_assignments_org_date_idx on public.checkvan_daily_assignments(organization_id,assignment_date desc);

alter table public.checkvan_inspections
  add column if not exists driver_id uuid references public.checkvan_drivers(id) on delete set null,
  add column if not exists driver_first_name text,
  add column if not exists driver_last_name text,
  add column if not exists assignment_date date;
create index if not exists checkvan_inspections_driver_time_idx on public.checkvan_inspections(driver_id,inspected_at desc) where driver_id is not null;

alter table public.checkvan_drivers enable row level security;
alter table public.checkvan_daily_assignments enable row level security;
revoke all on public.checkvan_drivers,public.checkvan_daily_assignments from public,anon,authenticated;
grant select,insert,update,delete on public.checkvan_drivers,public.checkvan_daily_assignments to service_role;

create or replace function public.internal_admin_import_checkvan_drivers(p_auth_subject uuid,p_organization_id uuid,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb;code text;first_value text;last_value text;created public.checkvan_drivers%rowtype;results jsonb:='[]'::jsonb;imported integer:=0;skipped integer:=0;ordinal integer:=0;
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception using errcode='42501',message='COMPANY_ADMIN_REQUIRED'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>500 then raise exception using errcode='22023',message='INVALID_DRIVER_BATCH'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text,1));
  for item in select value from jsonb_array_elements(p_rows) loop
    ordinal:=ordinal+1;code:=nullif(upper(trim(coalesce(item->>'driver_code',''))),'');first_value:=trim(coalesce(item->>'first_name',''));last_value:=trim(coalesce(item->>'last_name',''));
    if first_value='' or last_value='' or length(first_value)>100 or length(last_value)>100 or length(coalesce(code,''))>80 then skipped:=skipped+1;results:=results||jsonb_build_array(jsonb_build_object('row',ordinal,'status','INVALID'));
    elsif code is not null and exists(select 1 from public.checkvan_drivers where organization_id=p_organization_id and upper(driver_code)=code) then skipped:=skipped+1;results:=results||jsonb_build_array(jsonb_build_object('row',ordinal,'status','EXISTING_CODE'));
    elsif code is null and exists(select 1 from public.checkvan_drivers where organization_id=p_organization_id and lower(first_name)=lower(first_value) and lower(last_name)=lower(last_value)) then skipped:=skipped+1;results:=results||jsonb_build_array(jsonb_build_object('row',ordinal,'status','EXISTING_NAME'));
    else insert into public.checkvan_drivers(organization_id,driver_code,first_name,last_name) values(p_organization_id,code,first_value,last_value) returning * into created;imported:=imported+1;results:=results||jsonb_build_array(jsonb_build_object('row',ordinal,'status','IMPORTED','driver',to_jsonb(created))); end if;
  end loop;
  return jsonb_build_object('imported',imported,'skipped',skipped,'results',results);
end$$;

revoke all on function public.internal_admin_import_checkvan_drivers(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.internal_admin_import_checkvan_drivers(uuid,uuid,jsonb) to service_role;
