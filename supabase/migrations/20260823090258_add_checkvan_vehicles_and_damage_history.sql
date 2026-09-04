create table public.checkvan_vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  internal_code text not null check (length(trim(internal_code)) between 1 and 80),
  plate text not null check (length(trim(plate)) between 2 and 20),
  plate_normalized text not null check (plate_normalized ~ '^[A-Z0-9]{2,20}$'),
  silhouette_category text not null check (silhouette_category in ('SMALL','MEDIUM','LARGE')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, plate_normalized),
  unique (organization_id, id)
);

create table public.checkvan_vehicle_damages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  vehicle_id uuid not null,
  damage_type text not null check (damage_type in ('SCRATCH','DENT')),
  vehicle_view text not null check (vehicle_view in ('FRONT','LEFT','REAR','RIGHT')),
  normalized_x numeric(7,6) not null check (normalized_x between 0 and 1),
  normalized_y numeric(7,6) not null check (normalized_y between 0 and 1),
  status text not null check (status in ('PENDING','CONFIRMED','REJECTED','REPAIRED')),
  reported_by_device_id uuid references public.checkvan_license_devices(id) on delete restrict,
  reported_at timestamptz not null default now(),
  source_inspection_id uuid references public.checkvan_inspections(id) on delete set null,
  confirmed_by_auth_subject uuid,
  confirmed_at timestamptz,
  rejected_at timestamptz,
  repaired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checkvan_vehicle_damages_vehicle_org_fk foreign key (organization_id,vehicle_id)
    references public.checkvan_vehicles(organization_id,id) on delete restrict,
  constraint checkvan_vehicle_damages_actor_check check (
    (status='PENDING' and reported_by_device_id is not null and confirmed_by_auth_subject is null)
    or status in ('CONFIRMED','REJECTED','REPAIRED')
  )
);

create table public.checkvan_vehicle_damage_events (
  id bigint generated always as identity primary key,
  damage_id uuid not null references public.checkvan_vehicle_damages(id) on delete restrict,
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  event_type text not null check (event_type in ('CREATED','UPDATED','CONFIRMED','REJECTED','REPAIRED','DRIVER_WITHDRAWN')),
  actor_type text not null check (actor_type in ('COMPANY_ADMIN','DEVICE','SYSTEM')),
  actor_auth_subject uuid,
  actor_device_id uuid references public.checkvan_license_devices(id) on delete restrict,
  previous_value jsonb,
  next_value jsonb not null,
  created_at timestamptz not null default now(),
  check ((actor_type='COMPANY_ADMIN' and actor_auth_subject is not null and actor_device_id is null)
      or (actor_type='DEVICE' and actor_device_id is not null and actor_auth_subject is null)
      or actor_type='SYSTEM')
);

alter table public.checkvan_inspections add column if not exists vehicle_id uuid references public.checkvan_vehicles(id) on delete set null;
create index checkvan_vehicles_org_status_idx on public.checkvan_vehicles(organization_id,status,internal_code);
create index checkvan_vehicle_damages_active_idx on public.checkvan_vehicle_damages(organization_id,vehicle_id,status,reported_at desc);
create index checkvan_vehicle_damage_events_damage_idx on public.checkvan_vehicle_damage_events(damage_id,created_at);
create index if not exists checkvan_inspections_vehicle_time_idx on public.checkvan_inspections(vehicle_id,inspected_at desc) where vehicle_id is not null;

alter table public.checkvan_vehicles enable row level security;
alter table public.checkvan_vehicle_damages enable row level security;
alter table public.checkvan_vehicle_damage_events enable row level security;
revoke all on public.checkvan_vehicles,public.checkvan_vehicle_damages,public.checkvan_vehicle_damage_events from public,anon,authenticated;
grant select,insert,update,delete on public.checkvan_vehicles,public.checkvan_vehicle_damages to service_role;
grant select,insert on public.checkvan_vehicle_damage_events to service_role;
grant usage,select on sequence public.checkvan_vehicle_damage_events_id_seq to service_role;

create or replace function public.internal_admin_create_checkvan_damage(
  p_auth_subject uuid,p_organization_id uuid,p_vehicle_id uuid,p_damage_type text,p_vehicle_view text,p_x numeric,p_y numeric
) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.checkvan_vehicle_damages%rowtype;
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception using errcode='42501',message='COMPANY_ADMIN_REQUIRED'; end if;
  if not exists(select 1 from public.checkvan_vehicles where id=p_vehicle_id and organization_id=p_organization_id) then raise exception using errcode='22023',message='VEHICLE_NOT_FOUND'; end if;
  insert into public.checkvan_vehicle_damages(organization_id,vehicle_id,damage_type,vehicle_view,normalized_x,normalized_y,status,confirmed_by_auth_subject,confirmed_at)
  values(p_organization_id,p_vehicle_id,p_damage_type,p_vehicle_view,p_x,p_y,'CONFIRMED',p_auth_subject,now()) returning * into d;
  insert into public.checkvan_vehicle_damage_events(damage_id,organization_id,event_type,actor_type,actor_auth_subject,next_value)
  values(d.id,p_organization_id,'CREATED','COMPANY_ADMIN',p_auth_subject,to_jsonb(d));
  return to_jsonb(d);
end$$;

create or replace function public.internal_admin_update_checkvan_damage(
  p_auth_subject uuid,p_organization_id uuid,p_damage_id uuid,p_damage_type text,p_vehicle_view text,p_x numeric,p_y numeric
) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_d public.checkvan_vehicle_damages%rowtype;new_d public.checkvan_vehicle_damages%rowtype;
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception using errcode='42501',message='COMPANY_ADMIN_REQUIRED'; end if;
  select * into old_d from public.checkvan_vehicle_damages where id=p_damage_id and organization_id=p_organization_id for update;
  if not found or old_d.status not in ('PENDING','CONFIRMED') then raise exception using errcode='22023',message='DAMAGE_NOT_EDITABLE'; end if;
  update public.checkvan_vehicle_damages set damage_type=p_damage_type,vehicle_view=p_vehicle_view,normalized_x=p_x,normalized_y=p_y,updated_at=now() where id=p_damage_id returning * into new_d;
  insert into public.checkvan_vehicle_damage_events(damage_id,organization_id,event_type,actor_type,actor_auth_subject,previous_value,next_value) values(new_d.id,p_organization_id,'UPDATED','COMPANY_ADMIN',p_auth_subject,to_jsonb(old_d),to_jsonb(new_d));
  return to_jsonb(new_d);
end$$;

create or replace function public.internal_admin_transition_checkvan_damage(
  p_auth_subject uuid,p_organization_id uuid,p_damage_id uuid,p_action text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_d public.checkvan_vehicle_damages%rowtype;new_d public.checkvan_vehicle_damages%rowtype;next_status text;event_name text;
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception using errcode='42501',message='COMPANY_ADMIN_REQUIRED'; end if;
  select * into old_d from public.checkvan_vehicle_damages where id=p_damage_id and organization_id=p_organization_id for update;
  if not found then raise exception using errcode='22023',message='DAMAGE_NOT_FOUND'; end if;
  if p_action='CONFIRM' and old_d.status='PENDING' then next_status:='CONFIRMED';event_name:='CONFIRMED';
  elsif p_action='REJECT' and old_d.status='PENDING' then next_status:='REJECTED';event_name:='REJECTED';
  elsif p_action='REPAIR' and old_d.status='CONFIRMED' then next_status:='REPAIRED';event_name:='REPAIRED';
  else raise exception using errcode='22023',message='INVALID_DAMAGE_TRANSITION'; end if;
  update public.checkvan_vehicle_damages set status=next_status,confirmed_by_auth_subject=case when next_status='CONFIRMED' then p_auth_subject else confirmed_by_auth_subject end,confirmed_at=case when next_status='CONFIRMED' then now() else confirmed_at end,rejected_at=case when next_status='REJECTED' then now() else rejected_at end,repaired_at=case when next_status='REPAIRED' then now() else repaired_at end,updated_at=now() where id=p_damage_id returning * into new_d;
  insert into public.checkvan_vehicle_damage_events(damage_id,organization_id,event_type,actor_type,actor_auth_subject,previous_value,next_value) values(new_d.id,p_organization_id,event_name,'COMPANY_ADMIN',p_auth_subject,to_jsonb(old_d),to_jsonb(new_d));
  return to_jsonb(new_d);
end$$;

create or replace function public.internal_device_create_checkvan_damage(
  p_device_id uuid,p_organization_id uuid,p_vehicle_id uuid,p_damage_type text,p_vehicle_view text,p_x numeric,p_y numeric,p_source_inspection_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.checkvan_vehicle_damages%rowtype;
begin
  if not exists(select 1 from public.checkvan_device_assignments a join public.checkvan_licenses l on l.id=a.license_id where a.device_id=p_device_id and a.status='active' and l.organization_id=p_organization_id and l.status='active')
     and not exists(select 1 from public.checkvan_founder_entitlements f where f.device_id=p_device_id and f.organization_id=p_organization_id and f.status='active')
  then raise exception using errcode='42501',message='DEVICE_ORGANIZATION_MISMATCH'; end if;
  if not exists(select 1 from public.checkvan_vehicles where id=p_vehicle_id and organization_id=p_organization_id and status='active') then raise exception using errcode='22023',message='VEHICLE_NOT_FOUND'; end if;
  if p_source_inspection_id is not null and not exists(select 1 from public.checkvan_inspections where id=p_source_inspection_id and organization_id=p_organization_id and vehicle_id=p_vehicle_id) then raise exception using errcode='22023',message='INSPECTION_MISMATCH'; end if;
  insert into public.checkvan_vehicle_damages(organization_id,vehicle_id,damage_type,vehicle_view,normalized_x,normalized_y,status,reported_by_device_id,source_inspection_id)
  values(p_organization_id,p_vehicle_id,p_damage_type,p_vehicle_view,p_x,p_y,'PENDING',p_device_id,p_source_inspection_id) returning * into d;
  insert into public.checkvan_vehicle_damage_events(damage_id,organization_id,event_type,actor_type,actor_device_id,next_value) values(d.id,p_organization_id,'CREATED','DEVICE',p_device_id,to_jsonb(d));
  return to_jsonb(d);
end$$;

create or replace function public.internal_device_update_pending_checkvan_damage(
  p_device_id uuid,p_organization_id uuid,p_damage_id uuid,p_damage_type text,p_vehicle_view text,p_x numeric,p_y numeric,p_withdraw boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_d public.checkvan_vehicle_damages%rowtype;new_d public.checkvan_vehicle_damages%rowtype;
begin
  if not exists(select 1 from public.checkvan_device_assignments a join public.checkvan_licenses l on l.id=a.license_id where a.device_id=p_device_id and a.status='active' and l.organization_id=p_organization_id and l.status='active')
     and not exists(select 1 from public.checkvan_founder_entitlements f where f.device_id=p_device_id and f.organization_id=p_organization_id and f.status='active')
  then raise exception using errcode='42501',message='DEVICE_ORGANIZATION_MISMATCH'; end if;
  select * into old_d from public.checkvan_vehicle_damages where id=p_damage_id and organization_id=p_organization_id and reported_by_device_id=p_device_id for update;
  if not found or old_d.status<>'PENDING' then raise exception using errcode='22023',message='DAMAGE_NOT_EDITABLE'; end if;
  update public.checkvan_vehicle_damages set damage_type=case when p_withdraw then damage_type else p_damage_type end,vehicle_view=case when p_withdraw then vehicle_view else p_vehicle_view end,normalized_x=case when p_withdraw then normalized_x else p_x end,normalized_y=case when p_withdraw then normalized_y else p_y end,status=case when p_withdraw then 'REJECTED' else status end,rejected_at=case when p_withdraw then now() else rejected_at end,updated_at=now() where id=p_damage_id returning * into new_d;
  insert into public.checkvan_vehicle_damage_events(damage_id,organization_id,event_type,actor_type,actor_device_id,previous_value,next_value) values(new_d.id,p_organization_id,case when p_withdraw then 'DRIVER_WITHDRAWN' else 'UPDATED' end,'DEVICE',p_device_id,to_jsonb(old_d),to_jsonb(new_d));
  return to_jsonb(new_d);
end$$;

revoke all on function public.internal_admin_create_checkvan_damage(uuid,uuid,uuid,text,text,numeric,numeric),public.internal_admin_update_checkvan_damage(uuid,uuid,uuid,text,text,numeric,numeric),public.internal_admin_transition_checkvan_damage(uuid,uuid,uuid,text),public.internal_device_create_checkvan_damage(uuid,uuid,uuid,text,text,numeric,numeric,uuid),public.internal_device_update_pending_checkvan_damage(uuid,uuid,uuid,text,text,numeric,numeric,boolean) from public,anon,authenticated;
grant execute on function public.internal_admin_create_checkvan_damage(uuid,uuid,uuid,text,text,numeric,numeric),public.internal_admin_update_checkvan_damage(uuid,uuid,uuid,text,text,numeric,numeric),public.internal_admin_transition_checkvan_damage(uuid,uuid,uuid,text),public.internal_device_create_checkvan_damage(uuid,uuid,uuid,text,text,numeric,numeric,uuid),public.internal_device_update_pending_checkvan_damage(uuid,uuid,uuid,text,text,numeric,numeric,boolean) to service_role;
