-- The private `checkvan-vehicle-damages` bucket must be provisioned through the
-- Supabase Storage API (10 MiB, image/jpeg,image/png,image/webp). Storage schema
-- writes from SQL migrations are no longer supported on hosted projects.
alter table public.checkvan_vehicle_damages
  add column description text check (description is null or length(description) <= 1000),
  add column client_generated_id uuid,
  add column photo_bucket text,
  add column photo_object_path text,
  add column photo_hash text check (photo_hash is null or photo_hash ~ '^[0-9a-f]{64}$'),
  add column photo_size_bytes bigint check (photo_size_bytes is null or photo_size_bytes between 1 and 10485760),
  add column photo_mime_type text check (photo_mime_type is null or photo_mime_type in ('image/jpeg','image/png','image/webp')),
  add column photo_upload_status text not null default 'LEGACY' check (photo_upload_status in ('LEGACY','UPLOADING','AVAILABLE')),
  add column submitted_at timestamptz,
  add column decided_by_auth_subject uuid,
  add column decided_at timestamptz,
  add column decision_note text check (decision_note is null or length(decision_note) <= 1000);

create unique index checkvan_damage_device_client_id_idx
  on public.checkvan_vehicle_damages(reported_by_device_id,client_generated_id)
  where client_generated_id is not null;
create unique index checkvan_damage_photo_path_idx
  on public.checkvan_vehicle_damages(photo_bucket,photo_object_path)
  where photo_object_path is not null;

alter table public.checkvan_vehicle_damage_events
  drop constraint checkvan_vehicle_damage_events_event_type_check,
  add constraint checkvan_vehicle_damage_events_event_type_check check
    (event_type in ('CREATED','PHOTO_ATTACHED','UPDATED','CONFIRMED','REJECTED','REPAIRED','DRIVER_WITHDRAWN','REMOVED','REPAIR_REVERTED'));

create or replace function public.internal_device_finalize_checkvan_damage(
  p_device_id uuid,p_organization_id uuid,p_damage_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_d public.checkvan_vehicle_damages%rowtype;new_d public.checkvan_vehicle_damages%rowtype;
begin
  select * into old_d from public.checkvan_vehicle_damages
   where id=p_damage_id and organization_id=p_organization_id and reported_by_device_id=p_device_id for update;
  if not found then raise exception using errcode='22023',message='DAMAGE_NOT_FOUND'; end if;
  if old_d.photo_upload_status='AVAILABLE' then return to_jsonb(old_d); end if;
  if old_d.status<>'PENDING' or old_d.photo_upload_status<>'UPLOADING' then
    raise exception using errcode='22023',message='DAMAGE_NOT_FINALIZABLE';
  end if;
  update public.checkvan_vehicle_damages set photo_upload_status='AVAILABLE',submitted_at=now(),updated_at=now()
   where id=old_d.id returning * into new_d;
  insert into public.checkvan_vehicle_damage_events(damage_id,organization_id,event_type,actor_type,actor_device_id,previous_value,next_value)
  values(new_d.id,p_organization_id,'PHOTO_ATTACHED','DEVICE',p_device_id,to_jsonb(old_d),to_jsonb(new_d));
  return to_jsonb(new_d);
end$$;

create or replace function public.internal_admin_decide_checkvan_damage(
  p_auth_subject uuid,p_organization_id uuid,p_damage_id uuid,p_action text,p_note text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_d public.checkvan_vehicle_damages%rowtype;new_d public.checkvan_vehicle_damages%rowtype;next_status text;event_name text;
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active')
    then raise exception using errcode='42501',message='COMPANY_ADMIN_REQUIRED'; end if;
  select * into old_d from public.checkvan_vehicle_damages where id=p_damage_id and organization_id=p_organization_id for update;
  if not found then raise exception using errcode='22023',message='DAMAGE_NOT_FOUND'; end if;
  if old_d.status<>'PENDING' or old_d.photo_upload_status<>'AVAILABLE' then raise exception using errcode='22023',message='DAMAGE_NOT_DECIDABLE'; end if;
  if p_action='APPROVE' then next_status:='CONFIRMED';event_name:='CONFIRMED';
  elsif p_action='REJECT' then next_status:='REJECTED';event_name:='REJECTED';
  else raise exception using errcode='22023',message='INVALID_DAMAGE_TRANSITION'; end if;
  update public.checkvan_vehicle_damages set status=next_status,decision_note=nullif(trim(p_note),''),decided_by_auth_subject=p_auth_subject,decided_at=now(),
    confirmed_by_auth_subject=case when next_status='CONFIRMED' then p_auth_subject else confirmed_by_auth_subject end,
    confirmed_at=case when next_status='CONFIRMED' then now() else confirmed_at end,
    rejected_at=case when next_status='REJECTED' then now() else rejected_at end,updated_at=now()
   where id=old_d.id returning * into new_d;
  insert into public.checkvan_vehicle_damage_events(damage_id,organization_id,event_type,actor_type,actor_auth_subject,previous_value,next_value)
  values(new_d.id,p_organization_id,event_name,'COMPANY_ADMIN',p_auth_subject,to_jsonb(old_d),to_jsonb(new_d));
  return to_jsonb(new_d);
end$$;

revoke all on function public.internal_device_finalize_checkvan_damage(uuid,uuid,uuid),public.internal_admin_decide_checkvan_damage(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.internal_device_finalize_checkvan_damage(uuid,uuid,uuid),public.internal_admin_decide_checkvan_damage(uuid,uuid,uuid,text,text) to service_role;
