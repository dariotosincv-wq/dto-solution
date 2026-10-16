-- Historical operational days are intentionally independent from weekly planning,
-- QR, CheckVan inspections and reports. This schema never stores source documents.
-- Historical operational-day schema; migration version mirrors the production record 20261016152104.
create table public.checkvan_operational_days (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  operating_date date not null,
  revision integer not null check (revision > 0),
  status text not null check (status in ('confirmed','superseded')),
  idempotency_key uuid not null,
  correction_reason text check (correction_reason is null or length(trim(correction_reason)) between 1 and 1000),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid not null,
  superseded_at timestamptz,
  superseded_by uuid,
  superseded_reason text,
  unique (organization_id, operating_date, revision),
  unique (organization_id, idempotency_key),
  check ((status = 'confirmed' and superseded_at is null and superseded_by is null and superseded_reason is null)
      or (status = 'superseded' and superseded_at is not null and superseded_by is not null and superseded_reason is not null))
);
create unique index checkvan_operational_days_current_uidx
  on public.checkvan_operational_days(organization_id, operating_date) where status = 'confirmed';
create index checkvan_operational_days_history_idx
  on public.checkvan_operational_days(organization_id, operating_date desc, revision desc);

create table public.checkvan_operational_day_driver_rows (
  id uuid primary key default gen_random_uuid(),
  operational_day_id uuid not null references public.checkvan_operational_days(id) on delete restrict,
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  driver_id uuid not null,
  driver_code_snapshot text,
  driver_first_name_snapshot text not null check (length(trim(driver_first_name_snapshot)) between 1 and 100),
  driver_last_name_snapshot text not null check (length(trim(driver_last_name_snapshot)) between 1 and 100),
  work_status text not null check (work_status in ('TURNO','RIPOSO','FERIE','PERMESSO','MALATTIA','ALTRO')),
  vehicle_id uuid,
  vehicle_internal_code_snapshot text,
  vehicle_plate_snapshot text,
  route_snapshot text,
  departure_order integer,
  departure_group integer,
  parking_lot_position integer,
  departure_wave integer,
  source text not null default 'manual' check (source in ('manual')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  constraint checkvan_operational_row_driver_org_fk foreign key (organization_id, driver_id)
    references public.checkvan_drivers(organization_id, id) on delete restrict,
  constraint checkvan_operational_row_vehicle_org_fk foreign key (organization_id, vehicle_id)
    references public.checkvan_vehicles(organization_id, id) on delete restrict,
  unique (operational_day_id, driver_id),
  unique (operational_day_id, vehicle_id),
  check (departure_order is null or departure_order between 1 and 10000),
  check (departure_group is null or departure_group between 1 and 10000),
  check (parking_lot_position is null or parking_lot_position between 0 and 10000),
  check (departure_wave is null or departure_wave between 1 and 10000),
  check (route_snapshot is null or length(trim(route_snapshot)) between 1 and 100),
  check (notes is null or length(trim(notes)) between 1 and 2000),
  check ((work_status = 'TURNO' and vehicle_id is not null and vehicle_internal_code_snapshot is not null and vehicle_plate_snapshot is not null)
      or (work_status <> 'TURNO' and vehicle_id is null and vehicle_internal_code_snapshot is null and vehicle_plate_snapshot is null and route_snapshot is null and departure_order is null and departure_group is null and parking_lot_position is null and departure_wave is null))
);
create index checkvan_operational_rows_driver_history_idx
  on public.checkvan_operational_day_driver_rows(organization_id, driver_id, operational_day_id);
create index checkvan_operational_rows_vehicle_history_idx
  on public.checkvan_operational_day_driver_rows(organization_id, vehicle_id, operational_day_id) where vehicle_id is not null;
create unique index checkvan_operational_rows_departure_order_uidx
  on public.checkvan_operational_day_driver_rows(operational_day_id, departure_order) where departure_order is not null;

alter table public.checkvan_operational_days enable row level security;
alter table public.checkvan_operational_day_driver_rows enable row level security;
revoke all on public.checkvan_operational_days, public.checkvan_operational_day_driver_rows from public, anon, authenticated;
grant select, insert, update, delete on public.checkvan_operational_days, public.checkvan_operational_day_driver_rows to service_role;

create function public.internal_admin_confirm_operational_day(p_auth_subject uuid, p_organization_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_date date := (p_input->>'operating_date')::date;
  v_key uuid := (p_input->>'idempotency_key')::uuid;
  v_action text := p_input->>'action';
  v_reason text := nullif(trim(p_input->>'correction_reason'), '');
  v_current public.checkvan_operational_days%rowtype;
  v_existing public.checkvan_operational_days%rowtype;
  v_day public.checkvan_operational_days%rowtype;
  v_row jsonb; v_driver public.checkvan_drivers%rowtype; v_vehicle public.checkvan_vehicles%rowtype;
  v_driver_id uuid; v_vehicle_id uuid; v_status text; v_route text; v_order integer; v_group integer; v_parking_lot_position integer; v_wave integer; v_source text; v_notes text; v_constraint text;
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then
    raise exception using errcode='42501', message='COMPANY_ADMIN_REQUIRED';
  end if;
  if v_date is null or v_key is null or v_action not in ('CONFIRM','CORRECT') or jsonb_typeof(p_input->'rows') <> 'array' or jsonb_array_length(p_input->'rows') < 1 or jsonb_array_length(p_input->'rows') > 1000 then
    raise exception using errcode='22023', message='INVALID_OPERATIONAL_DAY_INPUT';
  end if;
  if v_action='CORRECT' and (v_reason is null or length(v_reason)>1000) then raise exception using errcode='22023', message='CORRECTION_REASON_REQUIRED'; end if;
  if v_action='CONFIRM' and v_reason is not null then raise exception using errcode='22023', message='INVALID_OPERATIONAL_DAY_INPUT'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text || v_date::text, 31));
  select * into v_existing from public.checkvan_operational_days where organization_id=p_organization_id and idempotency_key=v_key;
  if found then
    return jsonb_build_object('idempotent',true,'day',to_jsonb(v_existing));
  end if;
  select * into v_current from public.checkvan_operational_days where organization_id=p_organization_id and operating_date=v_date and status='confirmed' for update;
  if v_action='CONFIRM' and found then raise exception using errcode='23505', message='OPERATIONAL_DAY_ALREADY_CONFIRMED'; end if;
  if v_action='CORRECT' and not found then raise exception using errcode='22023', message='OPERATIONAL_DAY_NOT_FOUND'; end if;
  if v_action='CORRECT' then
    update public.checkvan_operational_days set status='superseded', superseded_at=now(), superseded_by=p_auth_subject, superseded_reason=v_reason where id=v_current.id;
  end if;
  insert into public.checkvan_operational_days(organization_id,operating_date,revision,status,idempotency_key,correction_reason,created_by,confirmed_by)
  values(p_organization_id,v_date,coalesce(v_current.revision,0)+1,'confirmed',v_key,case when v_action='CORRECT' then v_reason end,p_auth_subject,p_auth_subject)
  returning * into v_day;
  for v_row in select value from jsonb_array_elements(p_input->'rows') loop
    v_driver_id := (v_row->>'driver_id')::uuid; v_vehicle_id := nullif(v_row->>'vehicle_id','')::uuid;
    v_status := v_row->>'work_status'; v_route := nullif(trim(v_row->>'route'),'');
    v_order := nullif(v_row->>'departure_order','')::integer; v_group := nullif(v_row->>'departure_group','')::integer; v_parking_lot_position := nullif(v_row->>'parking_lot_position','')::integer; v_wave := nullif(v_row->>'departure_wave','')::integer; v_source := coalesce(nullif(trim(v_row->>'source'),''),'manual'); v_notes := nullif(trim(v_row->>'notes'),'');
    if v_driver_id is null or v_status not in ('TURNO','RIPOSO','FERIE','PERMESSO','MALATTIA','ALTRO') or v_source not in ('manual') or length(coalesce(v_route,''))>100 or length(coalesce(v_notes,''))>2000 or (v_order is not null and v_order not between 1 and 10000) or (v_group is not null and v_group not between 1 and 10000) or (v_parking_lot_position is not null and v_parking_lot_position not between 0 and 10000) or (v_wave is not null and v_wave not between 1 and 10000) then
      raise exception using errcode='22023', message='INVALID_OPERATIONAL_DAY_ROW';
    end if;
    if v_status='TURNO' and v_vehicle_id is null then raise exception using errcode='22023', message='OPERATIONAL_TURNO_VEHICLE_REQUIRED'; end if;
    if v_status<>'TURNO' and (v_vehicle_id is not null or v_route is not null or v_order is not null or v_group is not null or v_parking_lot_position is not null or v_wave is not null) then raise exception using errcode='22023', message='OPERATIONAL_ABSENCE_FIELDS_FORBIDDEN'; end if;
    select * into v_driver from public.checkvan_drivers where organization_id=p_organization_id and id=v_driver_id;
    if not found then raise exception using errcode='22023', message='OPERATIONAL_DRIVER_NOT_FOUND'; end if;
    if v_vehicle_id is not null then select * into v_vehicle from public.checkvan_vehicles where organization_id=p_organization_id and id=v_vehicle_id; if not found then raise exception using errcode='22023', message='OPERATIONAL_VEHICLE_NOT_FOUND'; end if; end if;
    insert into public.checkvan_operational_day_driver_rows(operational_day_id,organization_id,driver_id,driver_code_snapshot,driver_first_name_snapshot,driver_last_name_snapshot,work_status,vehicle_id,vehicle_internal_code_snapshot,vehicle_plate_snapshot,route_snapshot,departure_order,departure_group,parking_lot_position,departure_wave,source,notes,created_by)
    values(v_day.id,p_organization_id,v_driver.id,v_driver.driver_code,v_driver.first_name,v_driver.last_name,v_status,v_vehicle_id,case when v_vehicle_id is null then null else v_vehicle.internal_code end,case when v_vehicle_id is null then null else v_vehicle.plate end,v_route,v_order,v_group,v_parking_lot_position,v_wave,v_source,v_notes,p_auth_subject);
  end loop;
  return jsonb_build_object('idempotent',false,'day',to_jsonb(v_day));
exception when unique_violation then
  get stacked diagnostics v_constraint = constraint_name;
  if v_constraint like '%driver_id_key' then raise exception using errcode='22023', message='OPERATIONAL_DRIVER_DUPLICATE'; end if;
  if v_constraint like '%vehicle_id_key' then raise exception using errcode='22023', message='OPERATIONAL_VEHICLE_DUPLICATE'; end if;
  if v_constraint like '%departure_order_uidx' then raise exception using errcode='22023', message='OPERATIONAL_DEPARTURE_ORDER_DUPLICATE'; end if;
  raise;
end $$;

create function public.internal_read_current_operational_day(p_organization_id uuid, p_date date)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_build_object('day',to_jsonb(d),'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.departure_order nulls last,r.driver_last_name_snapshot,r.driver_first_name_snapshot) from public.checkvan_operational_day_driver_rows r where r.operational_day_id=d.id),'[]'::jsonb)),'null'::jsonb)
  from public.checkvan_operational_days d where d.organization_id=p_organization_id and d.operating_date=p_date and d.status='confirmed'
$$;
revoke all on function public.internal_admin_confirm_operational_day(uuid,uuid,jsonb), public.internal_read_current_operational_day(uuid,date) from public, anon, authenticated;
grant execute on function public.internal_admin_confirm_operational_day(uuid,uuid,jsonb), public.internal_read_current_operational_day(uuid,date) to service_role;
