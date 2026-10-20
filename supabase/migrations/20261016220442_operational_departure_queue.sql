-- One global queue per organization and operational date. departure_wave is copied only as descriptive metadata.
create table public.checkvan_operational_departure_queues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  operational_day_id uuid not null references public.checkvan_operational_days(id) on delete restrict,
  operating_date date not null,
  status text not null default 'active' check (status in ('active','completed')),
  timeout_seconds integer not null check (timeout_seconds between 10 and 600),
  started_at timestamptz not null default now(), started_by uuid not null,
  completed_at timestamptz,
  unique (organization_id, operating_date)
);
create table public.checkvan_operational_departure_queue_items (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.checkvan_operational_departure_queues(id) on delete restrict,
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  operational_row_id uuid not null references public.checkvan_operational_day_driver_rows(id) on delete restrict,
  driver_id uuid not null,
  departure_order integer not null check (departure_order > 0),
  departure_wave integer,
  status text not null default 'waiting' check (status in ('waiting','called','timed_out','departed')),
  called_at timestamptz,
  departed_at timestamptz,
  timeout_at timestamptz,
  departure_origin text check (departure_origin in ('driver_web','driver_utility')),
  unique (queue_id, driver_id), unique (queue_id, departure_order),
  check ((status='waiting' and called_at is null and departed_at is null and timeout_at is null) or (status='called' and called_at is not null and departed_at is null and timeout_at is not null) or (status='timed_out' and called_at is not null and departed_at is null and timeout_at is not null) or (status='departed' and called_at is not null and departed_at is not null and timeout_at is not null))
);
create unique index checkvan_departure_queue_current_called_uidx on public.checkvan_operational_departure_queue_items(queue_id) where status='called';
create index checkvan_departure_queue_items_driver_idx on public.checkvan_operational_departure_queue_items(organization_id, driver_id, queue_id);
alter table public.checkvan_operational_departure_queues enable row level security;
alter table public.checkvan_operational_departure_queue_items enable row level security;
revoke all on public.checkvan_operational_departure_queues, public.checkvan_operational_departure_queue_items from public, anon, authenticated;
grant select,insert,update,delete on public.checkvan_operational_departure_queues, public.checkvan_operational_departure_queue_items to service_role;

create function public.internal_advance_operational_departure_queue(p_queue_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare q public.checkvan_operational_departure_queues%rowtype; current_item public.checkvan_operational_departure_queue_items%rowtype; next_item public.checkvan_operational_departure_queue_items%rowtype;
begin
  select * into q from public.checkvan_operational_departure_queues where id=p_queue_id and status='active' for update;
  if not found then return; end if;
  select * into current_item from public.checkvan_operational_departure_queue_items where queue_id=q.id and status='called' for update;
  if found and current_item.timeout_at > now() then return; end if;
  if found then update public.checkvan_operational_departure_queue_items set status='timed_out' where id=current_item.id and status='called'; end if;
  select * into next_item from public.checkvan_operational_departure_queue_items where queue_id=q.id and status='waiting' order by departure_order for update skip locked limit 1;
  if found then update public.checkvan_operational_departure_queue_items set status='called',called_at=now(),timeout_at=now()+make_interval(secs=>q.timeout_seconds) where id=next_item.id; return; end if;
  if not exists(select 1 from public.checkvan_operational_departure_queue_items where queue_id=q.id and status in ('waiting','called')) then update public.checkvan_operational_departure_queues set status='completed',completed_at=now() where id=q.id; end if;
end $$;

create function public.internal_admin_start_operational_departure_queue(p_auth_subject uuid,p_organization_id uuid,p_date date,p_timeout_seconds integer default 30)
returns jsonb language plpgsql security definer set search_path='' as $$
declare day_row public.checkvan_operational_days%rowtype; queue_row public.checkvan_operational_departure_queues%rowtype; item record;
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception using errcode='42501',message='COMPANY_ADMIN_REQUIRED'; end if;
  if p_timeout_seconds not between 10 and 600 then raise exception using errcode='22023',message='INVALID_DEPARTURE_TIMEOUT'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||p_date::text,53));
  select * into queue_row from public.checkvan_operational_departure_queues where organization_id=p_organization_id and operating_date=p_date;
  if found then return jsonb_build_object('idempotent',true,'queue',to_jsonb(queue_row)); end if;
  select * into day_row from public.checkvan_operational_days where organization_id=p_organization_id and operating_date=p_date and status='confirmed';
  if not found then raise exception using errcode='22023',message='OPERATIONAL_DAY_NOT_CONFIRMED'; end if;
  if exists(select 1 from public.checkvan_operational_day_anomalies where organization_id=p_organization_id and operating_date=p_date and status='open') then raise exception using errcode='22023',message='OPERATIONAL_DAY_ANOMALIES_OPEN'; end if;
  if exists(select 1 from public.checkvan_operational_day_driver_rows where operational_day_id=day_row.id and work_status='TURNO' and departure_order is null) then raise exception using errcode='22023',message='DEPARTURE_ORDER_MISSING'; end if;
  insert into public.checkvan_operational_departure_queues(organization_id,operational_day_id,operating_date,timeout_seconds,started_by) values(p_organization_id,day_row.id,p_date,p_timeout_seconds,p_auth_subject) returning * into queue_row;
  for item in select * from public.checkvan_operational_day_driver_rows where operational_day_id=day_row.id and work_status='TURNO' order by departure_order loop
    insert into public.checkvan_operational_departure_queue_items(queue_id,organization_id,operational_row_id,driver_id,departure_order,departure_wave) values(queue_row.id,p_organization_id,item.id,item.driver_id,item.departure_order,item.departure_wave);
  end loop;
  perform public.internal_advance_operational_departure_queue(queue_row.id);
  return jsonb_build_object('idempotent',false,'queue',to_jsonb(queue_row));
end $$;

create function public.internal_process_operational_departure_timeouts()
returns integer language plpgsql security definer set search_path='' as $$ declare q record; n integer:=0; begin for q in select id from public.checkvan_operational_departure_queues where status='active' loop perform public.internal_advance_operational_departure_queue(q.id); n:=n+1; end loop; return n; end $$;

create function public.internal_driver_departure_status(p_organization_id uuid,p_driver_id uuid,p_date date)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('queue_status',q.status,'timeout_seconds',q.timeout_seconds,'item',to_jsonb(i),'row',to_jsonb(r)) from public.checkvan_operational_departure_queues q join public.checkvan_operational_departure_queue_items i on i.queue_id=q.id join public.checkvan_operational_day_driver_rows r on r.id=i.operational_row_id where q.organization_id=p_organization_id and q.operating_date=p_date and i.driver_id=p_driver_id),'null'::jsonb)
$$;

create function public.internal_driver_confirm_operational_departure(p_organization_id uuid,p_driver_id uuid,p_date date,p_origin text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare item public.checkvan_operational_departure_queue_items%rowtype; begin
 if p_origin not in ('driver_web','driver_utility') then raise exception using errcode='22023',message='INVALID_DEPARTURE_ORIGIN'; end if;
 select i.* into item from public.checkvan_operational_departure_queue_items i join public.checkvan_operational_departure_queues q on q.id=i.queue_id where q.organization_id=p_organization_id and q.operating_date=p_date and i.driver_id=p_driver_id for update;
 if not found then raise exception using errcode='42501',message='DEPARTURE_NOT_AVAILABLE'; end if;
 if item.status='departed' then return jsonb_build_object('idempotent',true,'item',to_jsonb(item)); end if;
 if item.status not in ('called','timed_out') then raise exception using errcode='42501',message='DEPARTURE_NOT_AVAILABLE'; end if;
 update public.checkvan_operational_departure_queue_items set status='departed',departed_at=now(),departure_origin=p_origin where id=item.id returning * into item;
 perform public.internal_advance_operational_departure_queue(item.queue_id);
 return jsonb_build_object('idempotent',false,'item',to_jsonb(item));
end $$;
create function public.internal_admin_read_operational_departure_queue(p_auth_subject uuid,p_organization_id uuid,p_date date)
returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.checkvan_area_memberships where auth_subject=p_auth_subject and organization_id=p_organization_id and role='COMPANY_ADMIN' and status='active') then raise exception using errcode='42501',message='COMPANY_ADMIN_REQUIRED'; end if;
 return coalesce((select jsonb_build_object('queue',to_jsonb(q),'items',coalesce((select jsonb_agg(jsonb_build_object('item',to_jsonb(i),'row',to_jsonb(r)) order by i.departure_order) from public.checkvan_operational_departure_queue_items i join public.checkvan_operational_day_driver_rows r on r.id=i.operational_row_id where i.queue_id=q.id),'[]'::jsonb)) from public.checkvan_operational_departure_queues q where q.organization_id=p_organization_id and q.operating_date=p_date),'null'::jsonb);
end $$;
revoke all on function public.internal_advance_operational_departure_queue(uuid),public.internal_process_operational_departure_timeouts(),public.internal_admin_start_operational_departure_queue(uuid,uuid,date,integer),public.internal_admin_read_operational_departure_queue(uuid,uuid,date),public.internal_driver_departure_status(uuid,uuid,date),public.internal_driver_confirm_operational_departure(uuid,uuid,date,text) from public,anon,authenticated;
grant execute on function public.internal_advance_operational_departure_queue(uuid),public.internal_process_operational_departure_timeouts(),public.internal_admin_start_operational_departure_queue(uuid,uuid,date,integer),public.internal_admin_read_operational_departure_queue(uuid,uuid,date),public.internal_driver_departure_status(uuid,uuid,date),public.internal_driver_confirm_operational_departure(uuid,uuid,date,text) to service_role;
