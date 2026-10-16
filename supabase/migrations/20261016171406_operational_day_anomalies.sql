-- Minimal normalized anomaly metadata only. Source PDFs and extracted text are never stored.
create table public.checkvan_operational_day_anomalies (
  id uuid primary key default gen_random_uuid(),
  operational_day_id uuid not null references public.checkvan_operational_days(id) on delete restrict,
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  operating_date date not null,
  client_row_id uuid not null,
  driver_id uuid,
  vehicle_id uuid,
  driver_name_key text,
  vehicle_internal_code_key text,
  vehicle_plate_key text,
  route_snapshot text,
  departure_order integer,
  departure_group integer,
  parking_lot_position integer,
  departure_wave integer,
  reason_code text not null check (reason_code in ('DRIVER_MISSING','DRIVER_ARCHIVED','DRIVER_AMBIGUOUS','VEHICLE_MISSING','MATCH_AMBIGUOUS','ROW_INCOMPLETE')),
  status text not null default 'open' check (status in ('open','resolved','excluded')),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  resolved_at timestamptz,
  resolved_by uuid,
  resolved_in_operational_day_id uuid references public.checkvan_operational_days(id) on delete restrict,
  resolution_idempotency_key uuid,
  exclusion_reason text,
  excluded_at timestamptz,
  excluded_by uuid,
  constraint checkvan_operational_anomaly_driver_org_fk foreign key (organization_id, driver_id) references public.checkvan_drivers(organization_id,id) on delete restrict,
  constraint checkvan_operational_anomaly_vehicle_org_fk foreign key (organization_id, vehicle_id) references public.checkvan_vehicles(organization_id,id) on delete restrict,
  unique (operational_day_id, client_row_id),
  check (departure_order is null or departure_order between 1 and 10000),
  check (departure_group is null or departure_group between 1 and 10000),
  check (parking_lot_position is null or parking_lot_position between 0 and 10000),
  check (departure_wave is null or departure_wave between 1 and 10000),
  check (route_snapshot is null or length(trim(route_snapshot)) between 1 and 100),
  check ((status='open' and resolved_at is null and resolved_by is null and resolved_in_operational_day_id is null and excluded_at is null and excluded_by is null and exclusion_reason is null)
      or (status='resolved' and resolved_at is not null and resolved_by is not null and resolved_in_operational_day_id is not null and excluded_at is null and excluded_by is null and exclusion_reason is null)
      or (status='excluded' and excluded_at is not null and excluded_by is not null and length(trim(exclusion_reason)) between 1 and 1000 and resolved_at is null and resolved_by is null and resolved_in_operational_day_id is null))
);
create index checkvan_operational_anomalies_open_idx on public.checkvan_operational_day_anomalies(organization_id, operating_date, departure_order) where status='open';
create index checkvan_operational_anomalies_day_idx on public.checkvan_operational_day_anomalies(operational_day_id);
create unique index checkvan_operational_anomalies_resolution_key_uidx on public.checkvan_operational_day_anomalies(organization_id, resolution_idempotency_key) where resolution_idempotency_key is not null;
alter table public.checkvan_operational_day_anomalies enable row level security;
revoke all on public.checkvan_operational_day_anomalies from public, anon, authenticated;
grant select, insert, update, delete on public.checkvan_operational_day_anomalies to service_role;

create function public.internal_admin_confirm_operational_day_partial(p_auth_subject uuid, p_organization_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_day_id uuid; v_row jsonb; v_reason text; v_row_id uuid;
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception using errcode='42501',message='COMPANY_ADMIN_REQUIRED'; end if;
  if p_input->>'action'<>'CONFIRM_PARTIAL' or jsonb_typeof(p_input->'anomalies')<>'array' or jsonb_array_length(p_input->'anomalies')<1 then raise exception using errcode='22023',message='INVALID_OPERATIONAL_PARTIAL_INPUT'; end if;
  v_result:=public.internal_admin_confirm_operational_day(p_auth_subject,p_organization_id,jsonb_set(p_input,'{action}','"CONFIRM"'::jsonb)-'anomalies');
  if coalesce((v_result->>'idempotent')::boolean,false) then return v_result; end if;
  v_day_id:=(v_result->'day'->>'id')::uuid;
  for v_row in select value from jsonb_array_elements(p_input->'anomalies') loop
    v_row_id:=nullif(v_row->>'client_row_id','')::uuid; v_reason:=v_row->>'reason_code';
    if v_row_id is null or v_reason not in ('DRIVER_MISSING','DRIVER_ARCHIVED','DRIVER_AMBIGUOUS','VEHICLE_MISSING','MATCH_AMBIGUOUS','ROW_INCOMPLETE') then raise exception using errcode='22023',message='INVALID_OPERATIONAL_ANOMALY'; end if;
    insert into public.checkvan_operational_day_anomalies(operational_day_id,organization_id,operating_date,client_row_id,driver_id,vehicle_id,driver_name_key,vehicle_internal_code_key,vehicle_plate_key,route_snapshot,departure_order,departure_group,parking_lot_position,departure_wave,reason_code,created_by)
    values(v_day_id,p_organization_id,(p_input->>'operating_date')::date,v_row_id,nullif(v_row->>'driver_id','')::uuid,nullif(v_row->>'vehicle_id','')::uuid,nullif(trim(v_row->>'driver_name_key'),''),nullif(trim(v_row->>'vehicle_internal_code_key'),''),nullif(trim(v_row->>'vehicle_plate_key'),''),nullif(trim(v_row->>'route'),''),nullif(v_row->>'departure_order','')::integer,nullif(v_row->>'departure_group','')::integer,nullif(v_row->>'parking_lot_position','')::integer,nullif(v_row->>'departure_wave','')::integer,v_reason,p_auth_subject);
  end loop;
  return v_result || jsonb_build_object('anomalies_created',jsonb_array_length(p_input->'anomalies'));
end $$;

create function public.internal_read_operational_day_anomalies(p_auth_subject uuid,p_organization_id uuid,p_date date)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(a) order by a.departure_order nulls last,a.created_at),'[]'::jsonb)
 from public.checkvan_operational_day_anomalies a
 where a.organization_id=p_organization_id and a.operating_date=p_date
 and exists(select 1 from public.checkvan_area_memberships m where m.auth_subject=p_auth_subject and m.organization_id=p_organization_id and m.role='COMPANY_ADMIN' and m.status='active')
$$;
revoke all on function public.internal_admin_confirm_operational_day_partial(uuid,uuid,jsonb), public.internal_read_operational_day_anomalies(uuid,uuid,date) from public, anon, authenticated;
grant execute on function public.internal_admin_confirm_operational_day_partial(uuid,uuid,jsonb), public.internal_read_operational_day_anomalies(uuid,uuid,date) to service_role;

create function public.internal_admin_resolve_operational_day_anomaly(p_auth_subject uuid,p_organization_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_anomaly public.checkvan_operational_day_anomalies%rowtype;
  v_action text := p_input->>'action'; v_key uuid := nullif(p_input->>'idempotency_key','')::uuid;
  v_driver public.checkvan_drivers%rowtype; v_vehicle public.checkvan_vehicles%rowtype;
  v_rows jsonb; v_result jsonb; v_date date; v_reason text := nullif(trim(p_input->>'exclusion_reason'),'');
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception using errcode='42501',message='COMPANY_ADMIN_REQUIRED'; end if;
  if nullif(p_input->>'anomaly_id','') is null or v_action not in ('RESOLVE','EXCLUDE') then raise exception using errcode='22023',message='INVALID_OPERATIONAL_ANOMALY_RESOLUTION'; end if;
  select * into v_anomaly from public.checkvan_operational_day_anomalies where id=(p_input->>'anomaly_id')::uuid and organization_id=p_organization_id for update;
  if not found then raise exception using errcode='22023',message='OPERATIONAL_ANOMALY_NOT_FOUND'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text || v_anomaly.operating_date::text, 31));
  if v_anomaly.status <> 'open' then return jsonb_build_object('idempotent',true,'anomaly',to_jsonb(v_anomaly)); end if;
  if v_action='EXCLUDE' then
    if v_reason is null or length(v_reason)>1000 then raise exception using errcode='22023',message='EXCLUSION_REASON_REQUIRED'; end if;
    update public.checkvan_operational_day_anomalies set status='excluded',exclusion_reason=v_reason,excluded_at=now(),excluded_by=p_auth_subject where id=v_anomaly.id;
    return jsonb_build_object('idempotent',false,'anomaly_id',v_anomaly.id,'status','excluded');
  end if;
  if v_key is null or nullif(p_input->>'driver_id','') is null then raise exception using errcode='22023',message='INVALID_OPERATIONAL_ANOMALY_RESOLUTION'; end if;
  select * into v_driver from public.checkvan_drivers where id=(p_input->>'driver_id')::uuid and organization_id=p_organization_id and status='active';
  if not found then raise exception using errcode='22023',message='OPERATIONAL_DRIVER_NOT_ACTIVE'; end if;
  select * into v_vehicle from public.checkvan_vehicles where id=coalesce(nullif(p_input->>'vehicle_id','')::uuid,v_anomaly.vehicle_id) and organization_id=p_organization_id and status='active';
  if not found then raise exception using errcode='22023',message='OPERATIONAL_VEHICLE_NOT_ACTIVE'; end if;
  if v_anomaly.departure_order is null then raise exception using errcode='22023',message='OPERATIONAL_ANOMALY_ORDER_REQUIRED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('driver_id',r.driver_id,'work_status',r.work_status,'vehicle_id',r.vehicle_id,'route',r.route_snapshot,'departure_order',r.departure_order,'departure_group',r.departure_group,'parking_lot_position',r.parking_lot_position,'departure_wave',r.departure_wave,'source','manual','notes',r.notes) order by r.departure_order),'[]'::jsonb) into v_rows
  from public.checkvan_operational_day_driver_rows r join public.checkvan_operational_days d on d.id=r.operational_day_id
  where d.organization_id=p_organization_id and d.operating_date=v_anomaly.operating_date and d.status='confirmed';
  if jsonb_array_length(v_rows)=0 then raise exception using errcode='22023',message='OPERATIONAL_DAY_NOT_FOUND'; end if;
  if exists(select 1 from jsonb_array_elements(v_rows) as item(value) where item.value->>'driver_id'=v_driver.id::text or nullif(item.value->>'departure_order','')::integer=v_anomaly.departure_order or item.value->>'vehicle_id'=v_vehicle.id::text) then raise exception using errcode='22023',message='OPERATIONAL_ANOMALY_CONFLICT'; end if;
  v_rows:=v_rows || jsonb_build_array(jsonb_build_object('driver_id',v_driver.id,'work_status','TURNO','vehicle_id',v_vehicle.id,'route',v_anomaly.route_snapshot,'departure_order',v_anomaly.departure_order,'departure_group',v_anomaly.departure_group,'parking_lot_position',v_anomaly.parking_lot_position,'departure_wave',v_anomaly.departure_wave,'source','manual','notes',null));
  v_result:=public.internal_admin_confirm_operational_day(p_auth_subject,p_organization_id,jsonb_build_object('action','CORRECT','operating_date',v_anomaly.operating_date,'idempotency_key',v_key,'correction_reason','Recupero anomalia giornata','rows',v_rows));
  update public.checkvan_operational_day_anomalies set status='resolved',resolved_at=now(),resolved_by=p_auth_subject,resolved_in_operational_day_id=(v_result->'day'->>'id')::uuid,resolution_idempotency_key=v_key where id=v_anomaly.id;
  return v_result || jsonb_build_object('anomaly_id',v_anomaly.id,'status','resolved');
end $$;
revoke all on function public.internal_admin_resolve_operational_day_anomaly(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.internal_admin_resolve_operational_day_anomaly(uuid,uuid,jsonb) to service_role;
