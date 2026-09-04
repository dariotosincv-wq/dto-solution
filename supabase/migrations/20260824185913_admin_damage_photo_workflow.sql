alter table public.checkvan_vehicle_damage_events drop constraint if exists checkvan_vehicle_damage_events_event_type_check;
alter table public.checkvan_vehicle_damage_events add constraint checkvan_vehicle_damage_events_event_type_check check (event_type in ('CREATED','PHOTO_ATTACHED','UPDATED','CONFIRMED','REJECTED','REPAIRED','DRIVER_WITHDRAWN','REMOVED','REPAIR_REVERTED')) not valid;
alter table public.checkvan_vehicle_damage_events validate constraint checkvan_vehicle_damage_events_event_type_check;

create unique index if not exists checkvan_damage_admin_client_id_idx on public.checkvan_vehicle_damages(organization_id,client_generated_id) where reported_by_device_id is null and client_generated_id is not null;

create or replace function public.internal_admin_finalize_checkvan_damage_photo(p_auth_subject uuid,p_organization_id uuid,p_damage_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old_d public.checkvan_vehicle_damages%rowtype;new_d public.checkvan_vehicle_damages%rowtype;
begin
 if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception using errcode='42501',message='COMPANY_ADMIN_REQUIRED'; end if;
 select * into old_d from public.checkvan_vehicle_damages where id=p_damage_id and organization_id=p_organization_id and reported_by_device_id is null for update;
 if not found then raise exception using errcode='22023',message='DAMAGE_NOT_FOUND'; end if;
 if old_d.photo_upload_status='AVAILABLE' then return to_jsonb(old_d); end if;
 if old_d.photo_upload_status<>'UPLOADING' then raise exception using errcode='22023',message='DAMAGE_NOT_FINALIZABLE'; end if;
 update public.checkvan_vehicle_damages set photo_upload_status='AVAILABLE',submitted_at=now(),updated_at=now() where id=old_d.id returning * into new_d;
 insert into public.checkvan_vehicle_damage_events(damage_id,organization_id,event_type,actor_type,actor_auth_subject,previous_value,next_value) values(new_d.id,p_organization_id,'CREATED','COMPANY_ADMIN',p_auth_subject,to_jsonb(old_d),to_jsonb(new_d));
 return to_jsonb(new_d);
end$$;
revoke all on function public.internal_admin_finalize_checkvan_damage_photo(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.internal_admin_finalize_checkvan_damage_photo(uuid,uuid,uuid) to service_role;
