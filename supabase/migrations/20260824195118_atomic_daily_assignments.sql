create or replace function public.internal_admin_set_checkvan_assignment(p_auth_subject uuid,p_organization_id uuid,p_date date,p_driver_id uuid,p_vehicle_id uuid)
returns public.checkvan_daily_assignments language plpgsql security definer set search_path='' as $$
declare result public.checkvan_daily_assignments%rowtype;
begin
 if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception using errcode='42501',message='COMPANY_ADMIN_REQUIRED'; end if;
 if not exists(select 1 from public.checkvan_drivers where id=p_driver_id and organization_id=p_organization_id and status='active') or not exists(select 1 from public.checkvan_vehicles where id=p_vehicle_id and organization_id=p_organization_id and status='active') then raise exception using errcode='22023',message='ASSIGNMENT_TARGET_UNAVAILABLE'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||p_date::text,2));
 delete from public.checkvan_daily_assignments where organization_id=p_organization_id and assignment_date=p_date and (driver_id=p_driver_id or vehicle_id=p_vehicle_id);
 insert into public.checkvan_daily_assignments(organization_id,assignment_date,driver_id,vehicle_id,assigned_by) values(p_organization_id,p_date,p_driver_id,p_vehicle_id,p_auth_subject) returning * into result;
 return result;
end$$;
create or replace function public.internal_admin_copy_checkvan_assignments(p_auth_subject uuid,p_organization_id uuid,p_date date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare source_date date;item record;copied integer:=0;
begin
 if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception using errcode='42501',message='COMPANY_ADMIN_REQUIRED'; end if;
 select max(assignment_date) into source_date from public.checkvan_daily_assignments where organization_id=p_organization_id and assignment_date<p_date;
 if source_date is null then return jsonb_build_object('copied',0,'source_date',null); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||p_date::text,3));
 for item in select driver_id,vehicle_id from public.checkvan_daily_assignments where organization_id=p_organization_id and assignment_date=source_date loop
  if exists(select 1 from public.checkvan_drivers where id=item.driver_id and status='active') and exists(select 1 from public.checkvan_vehicles where id=item.vehicle_id and status='active') and not exists(select 1 from public.checkvan_daily_assignments where organization_id=p_organization_id and assignment_date=p_date and (driver_id=item.driver_id or vehicle_id=item.vehicle_id)) then insert into public.checkvan_daily_assignments(organization_id,assignment_date,driver_id,vehicle_id,assigned_by) values(p_organization_id,p_date,item.driver_id,item.vehicle_id,p_auth_subject);copied:=copied+1; end if;
 end loop;
 return jsonb_build_object('copied',copied,'source_date',source_date);
end$$;
revoke all on function public.internal_admin_set_checkvan_assignment(uuid,uuid,date,uuid,uuid),public.internal_admin_copy_checkvan_assignments(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.internal_admin_set_checkvan_assignment(uuid,uuid,date,uuid,uuid),public.internal_admin_copy_checkvan_assignments(uuid,uuid,date) to service_role;
