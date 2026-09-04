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
  elsif p_action='REMOVE' and old_d.status in ('PENDING','CONFIRMED','REPAIRED') then next_status:='REMOVED';event_name:='REMOVED';
  elsif p_action='REOPEN' and old_d.status='REPAIRED' then next_status:='CONFIRMED';event_name:='REPAIR_REVERTED';
  else raise exception using errcode='22023',message='INVALID_DAMAGE_TRANSITION'; end if;
  update public.checkvan_vehicle_damages set
    status=next_status,
    confirmed_by_auth_subject=case when next_status='CONFIRMED' then p_auth_subject else confirmed_by_auth_subject end,
    confirmed_at=case when next_status='CONFIRMED' and old_d.status='PENDING' then now() else confirmed_at end,
    rejected_at=case when next_status='REJECTED' then now() else rejected_at end,
    repaired_at=case when next_status='REPAIRED' then now() when event_name='REPAIR_REVERTED' then null else repaired_at end,
    removed_at=case when next_status='REMOVED' then now() else removed_at end,
    updated_at=now()
  where id=p_damage_id returning * into new_d;
  insert into public.checkvan_vehicle_damage_events(damage_id,organization_id,event_type,actor_type,actor_auth_subject,previous_value,next_value)
  values(new_d.id,p_organization_id,event_name,'COMPANY_ADMIN',p_auth_subject,to_jsonb(old_d),to_jsonb(new_d));
  return to_jsonb(new_d);
end$$;

revoke all on function public.internal_admin_transition_checkvan_damage(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.internal_admin_transition_checkvan_damage(uuid,uuid,uuid,text) to service_role;
