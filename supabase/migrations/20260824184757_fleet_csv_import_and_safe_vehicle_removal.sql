alter table public.checkvan_vehicles
  drop constraint if exists checkvan_vehicles_status_check;
alter table public.checkvan_vehicles
  add constraint checkvan_vehicles_status_check check (status in ('active','inactive','archived')) not valid;
alter table public.checkvan_vehicles validate constraint checkvan_vehicles_status_check;
alter table public.checkvan_vehicles add column if not exists archived_at timestamptz;

create table if not exists public.checkvan_vehicle_events (
  id bigint generated always as identity primary key,
  vehicle_id uuid not null,
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  event_type text not null check (event_type in ('ARCHIVED','DELETED')),
  actor_auth_subject uuid not null,
  previous_value jsonb not null,
  next_value jsonb,
  created_at timestamptz not null default now()
);
create index if not exists checkvan_vehicle_events_vehicle_idx on public.checkvan_vehicle_events(organization_id,vehicle_id,created_at);
alter table public.checkvan_vehicle_events enable row level security;
revoke all on public.checkvan_vehicle_events from public,anon,authenticated;
grant select,insert on public.checkvan_vehicle_events to service_role;
grant usage,select on sequence public.checkvan_vehicle_events_id_seq to service_role;

create or replace function public.internal_admin_remove_checkvan_vehicle(
  p_auth_subject uuid,p_organization_id uuid,p_vehicle_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_v public.checkvan_vehicles%rowtype;new_v public.checkvan_vehicles%rowtype;has_history boolean;
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception using errcode='42501',message='COMPANY_ADMIN_REQUIRED'; end if;
  select * into old_v from public.checkvan_vehicles where id=p_vehicle_id and organization_id=p_organization_id for update;
  if not found then raise exception using errcode='22023',message='VEHICLE_NOT_FOUND'; end if;
  select exists(select 1 from public.checkvan_inspections where vehicle_id=p_vehicle_id)
    or exists(select 1 from public.checkvan_vehicle_damages where organization_id=p_organization_id and vehicle_id=p_vehicle_id)
    or exists(select 1 from public.checkvan_vehicle_events where organization_id=p_organization_id and vehicle_id=p_vehicle_id)
    into has_history;
  if has_history then
    update public.checkvan_vehicles set status='archived',archived_at=now(),updated_at=now() where id=p_vehicle_id returning * into new_v;
    insert into public.checkvan_vehicle_events(vehicle_id,organization_id,event_type,actor_auth_subject,previous_value,next_value) values(p_vehicle_id,p_organization_id,'ARCHIVED',p_auth_subject,to_jsonb(old_v),to_jsonb(new_v));
    return jsonb_build_object('mode','ARCHIVED','vehicle',to_jsonb(new_v));
  end if;
  delete from public.checkvan_vehicles where id=p_vehicle_id;
  insert into public.checkvan_vehicle_events(vehicle_id,organization_id,event_type,actor_auth_subject,previous_value,next_value) values(p_vehicle_id,p_organization_id,'DELETED',p_auth_subject,to_jsonb(old_v),null);
  return jsonb_build_object('mode','DELETED','vehicle',to_jsonb(old_v));
end$$;

create or replace function public.internal_admin_import_checkvan_vehicles(
  p_auth_subject uuid,p_organization_id uuid,p_rows jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb;code text;plate_value text;plate_key text;category text;created public.checkvan_vehicles%rowtype;results jsonb:='[]'::jsonb;imported integer:=0;skipped integer:=0;ordinal integer:=0;
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception using errcode='42501',message='COMPANY_ADMIN_REQUIRED'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 then raise exception using errcode='22023',message='INVALID_VEHICLE_BATCH'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text,0));
  for item in select value from jsonb_array_elements(p_rows) loop
    ordinal:=ordinal+1;code:=upper(trim(coalesce(item->>'internal_code','')));plate_value:=upper(trim(coalesce(item->>'plate','')));plate_key:=upper(regexp_replace(plate_value,'[^A-Z0-9]','','g'));category:=upper(trim(coalesce(item->>'silhouette_category','')));
    if code='' or length(code)>80 or plate_key !~ '^[A-Z0-9]{2,20}$' or category not in ('EXTRA_SMALL','SMALL','MEDIUM','LARGE') then
      skipped:=skipped+1;results:=results||jsonb_build_array(jsonb_build_object('row',ordinal,'status','INVALID'));
    elsif exists(select 1 from public.checkvan_vehicles where organization_id=p_organization_id and upper(internal_code)=code) then
      skipped:=skipped+1;results:=results||jsonb_build_array(jsonb_build_object('row',ordinal,'status','EXISTING_CODE'));
    elsif exists(select 1 from public.checkvan_vehicles where organization_id=p_organization_id and plate_normalized=plate_key) then
      skipped:=skipped+1;results:=results||jsonb_build_array(jsonb_build_object('row',ordinal,'status','EXISTING_PLATE'));
    else
      insert into public.checkvan_vehicles(organization_id,internal_code,plate,plate_normalized,silhouette_category,status) values(p_organization_id,code,plate_value,plate_key,category,'active') returning * into created;
      imported:=imported+1;results:=results||jsonb_build_array(jsonb_build_object('row',ordinal,'status','IMPORTED','vehicle',to_jsonb(created)));
    end if;
  end loop;
  return jsonb_build_object('imported',imported,'skipped',skipped,'results',results);
end$$;

revoke all on function public.internal_admin_remove_checkvan_vehicle(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.internal_admin_import_checkvan_vehicles(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.internal_admin_remove_checkvan_vehicle(uuid,uuid,uuid) to service_role;
grant execute on function public.internal_admin_import_checkvan_vehicles(uuid,uuid,jsonb) to service_role;
