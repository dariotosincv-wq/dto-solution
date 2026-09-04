create or replace function public.internal_device_set_pending_damage_photo(
  p_device_id uuid,p_organization_id uuid,p_damage_id uuid,
  p_bucket text,p_object_path text,p_hash text,p_size_bytes bigint,p_mime_type text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_d public.checkvan_vehicle_damages%rowtype;new_d public.checkvan_vehicle_damages%rowtype;
begin
  select * into old_d from public.checkvan_vehicle_damages
   where id=p_damage_id and organization_id=p_organization_id and reported_by_device_id=p_device_id for update;
  if not found then raise exception using errcode='22023',message='DAMAGE_NOT_FOUND'; end if;
  if old_d.status<>'PENDING' then raise exception using errcode='22023',message='DAMAGE_NOT_EDITABLE'; end if;
  update public.checkvan_vehicle_damages set photo_bucket=p_bucket,photo_object_path=p_object_path,photo_hash=p_hash,
    photo_size_bytes=p_size_bytes,photo_mime_type=p_mime_type,photo_upload_status='AVAILABLE',submitted_at=coalesce(submitted_at,now()),updated_at=now()
   where id=old_d.id returning * into new_d;
  insert into public.checkvan_vehicle_damage_events(damage_id,organization_id,event_type,actor_type,actor_device_id,previous_value,next_value)
  values(new_d.id,p_organization_id,'PHOTO_ATTACHED','DEVICE',p_device_id,to_jsonb(old_d),to_jsonb(new_d));
  return to_jsonb(new_d);
end$$;

create or replace function public.internal_device_remove_pending_damage_photo(
  p_device_id uuid,p_organization_id uuid,p_damage_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_d public.checkvan_vehicle_damages%rowtype;new_d public.checkvan_vehicle_damages%rowtype;
begin
  select * into old_d from public.checkvan_vehicle_damages
   where id=p_damage_id and organization_id=p_organization_id and reported_by_device_id=p_device_id for update;
  if not found then raise exception using errcode='22023',message='DAMAGE_NOT_FOUND'; end if;
  if old_d.status<>'PENDING' then raise exception using errcode='22023',message='DAMAGE_NOT_EDITABLE'; end if;
  update public.checkvan_vehicle_damages set photo_bucket=null,photo_object_path=null,photo_hash=null,photo_size_bytes=null,
    photo_mime_type=null,photo_upload_status='LEGACY',submitted_at=null,updated_at=now()
   where id=old_d.id returning * into new_d;
  insert into public.checkvan_vehicle_damage_events(damage_id,organization_id,event_type,actor_type,actor_device_id,previous_value,next_value)
  values(new_d.id,p_organization_id,'UPDATED','DEVICE',p_device_id,to_jsonb(old_d),to_jsonb(new_d));
  return to_jsonb(new_d);
end$$;

revoke all on function public.internal_device_set_pending_damage_photo(uuid,uuid,uuid,text,text,text,bigint,text),public.internal_device_remove_pending_damage_photo(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.internal_device_set_pending_damage_photo(uuid,uuid,uuid,text,text,text,bigint,text),public.internal_device_remove_pending_damage_photo(uuid,uuid,uuid) to service_role;
