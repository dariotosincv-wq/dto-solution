-- FCM delivery is deliberately decoupled from queue progression.  A failed
-- notification can never delay a timeout, confirmation, or the next driver.
create table public.checkvan_device_push_registrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete cascade,
  driver_id uuid not null references public.checkvan_drivers(id) on delete cascade,
  device_id uuid not null references public.checkvan_license_devices(id) on delete cascade,
  driver_session_id uuid not null references public.checkvan_device_driver_sessions(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  fcm_token text not null check (char_length(fcm_token) between 80 and 4096),
  platform text not null default 'android' check (platform = 'android'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (token_hash)
);
alter table public.checkvan_device_push_registrations enable row level security;
revoke all on table public.checkvan_device_push_registrations from public, anon, authenticated;
create unique index checkvan_device_push_active_driver_uidx
  on public.checkvan_device_push_registrations(organization_id, driver_id)
  where active and revoked_at is null;
create unique index checkvan_device_push_active_device_uidx
  on public.checkvan_device_push_registrations(device_id)
  where active and revoked_at is null;

create table public.checkvan_operational_departure_push_outbox (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.checkvan_operational_departure_queues(id) on delete cascade,
  queue_item_id uuid not null references public.checkvan_operational_departure_queue_items(id) on delete cascade,
  organization_id uuid not null references public.checkvan_organizations(id) on delete cascade,
  driver_id uuid not null references public.checkvan_drivers(id) on delete cascade,
  event_type text not null check (event_type = 'DRIVER_CALLED'),
  expires_at timestamptz not null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sending','sent','retry','expired','failed')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  provider_message_id text,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[A-Z0-9_]{1,80}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (queue_item_id, event_type)
);
alter table public.checkvan_operational_departure_push_outbox enable row level security;
revoke all on table public.checkvan_operational_departure_push_outbox from public, anon, authenticated;
create index checkvan_departure_push_outbox_due_idx
  on public.checkvan_operational_departure_push_outbox(delivery_status, next_attempt_at)
  where delivery_status in ('pending','retry');

create or replace function public.internal_revoke_device_push_on_session_revocation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.revoked_at is null and new.revoked_at is not null then
    update public.checkvan_device_push_registrations
      set active=false, revoked_at=new.revoked_at, updated_at=now()
      where driver_session_id=new.id and active and revoked_at is null;
  end if;
  return new;
end $$;
drop trigger if exists checkvan_device_push_revoke_session_trigger on public.checkvan_device_driver_sessions;
create trigger checkvan_device_push_revoke_session_trigger
  after update of revoked_at on public.checkvan_device_driver_sessions
  for each row execute function public.internal_revoke_device_push_on_session_revocation();

create or replace function public.internal_register_device_push_token(
  p_session_id uuid, p_device_id uuid, p_token text, p_token_hash text
) returns uuid language plpgsql security definer set search_path='' as $$
declare session_row public.checkvan_device_driver_sessions%rowtype; registration_id uuid;
begin
  if p_token !~ '^.{80,4096}$' or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_PUSH_TOKEN'; end if;
  select * into session_row from public.checkvan_device_driver_sessions
    where id=p_session_id and device_id=p_device_id and revoked_at is null and expires_at>now() for update;
  if not found then raise exception 'DRIVER_IDENTITY_REQUIRED'; end if;
  update public.checkvan_device_push_registrations set active=false, revoked_at=now(), updated_at=now()
    where active and revoked_at is null and (device_id=p_device_id or (organization_id=session_row.organization_id and driver_id=session_row.driver_id));
  insert into public.checkvan_device_push_registrations(organization_id,driver_id,device_id,driver_session_id,token_hash,fcm_token)
    values(session_row.organization_id,session_row.driver_id,p_device_id,session_row.id,p_token_hash,p_token)
  on conflict(token_hash) do update set organization_id=excluded.organization_id,driver_id=excluded.driver_id,device_id=excluded.device_id,
    driver_session_id=excluded.driver_session_id,fcm_token=excluded.fcm_token,active=true,revoked_at=null,updated_at=now(),last_seen_at=now()
  returning id into registration_id;
  return registration_id;
end $$;

create or replace function public.internal_enqueue_operational_departure_push(
  p_queue_id uuid, p_queue_item_id uuid, p_driver_id uuid, p_expires_at timestamptz
) returns void language plpgsql security definer set search_path='' as $$
declare organization uuid;
begin
  select organization_id into organization from public.checkvan_operational_departure_queues where id=p_queue_id;
  if organization is null then raise exception 'DEPARTURE_QUEUE_NOT_FOUND'; end if;
  insert into public.checkvan_operational_departure_push_outbox(queue_id,queue_item_id,organization_id,driver_id,event_type,expires_at)
    values(p_queue_id,p_queue_item_id,organization,p_driver_id,'DRIVER_CALLED',p_expires_at)
    on conflict(queue_item_id,event_type) do nothing;
end $$;

create or replace function public.internal_claim_operational_departure_push(p_event_id uuid default null, p_driver_id uuid default null, p_organization_id uuid default null)
returns table(event_id uuid, registration_id uuid, fcm_token text, expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare event_row public.checkvan_operational_departure_push_outbox%rowtype; registration_row public.checkvan_device_push_registrations%rowtype;
begin
  update public.checkvan_operational_departure_push_outbox
    set delivery_status='expired',updated_at=now(),last_error_code='EVENT_EXPIRED'
    where delivery_status in ('pending','retry','sending') and expires_at<=now();
  select * into event_row from public.checkvan_operational_departure_push_outbox
    where (p_event_id is null or id=p_event_id) and (p_driver_id is null or driver_id=p_driver_id) and (p_organization_id is null or organization_id=p_organization_id)
      and delivery_status in ('pending','retry') and next_attempt_at<=now() and expires_at>now()
    order by created_at for update skip locked limit 1;
  if not found then return; end if;
  if not exists(select 1 from public.checkvan_operational_departure_queue_items where id=event_row.queue_item_id and status='called' and timeout_at>now()) then
    update public.checkvan_operational_departure_push_outbox set delivery_status='expired',updated_at=now(),last_error_code='CALL_NO_LONGER_ACTIVE' where id=event_row.id;
    return;
  end if;
  select r.* into registration_row
    from public.checkvan_device_push_registrations r
    join public.checkvan_device_driver_sessions s on s.id=r.driver_session_id
    join public.checkvan_driver_access_tokens a on a.id=s.access_token_id
    where r.organization_id=event_row.organization_id and r.driver_id=event_row.driver_id and r.active and r.revoked_at is null
      and s.revoked_at is null and s.expires_at>now() and a.status='active'
    order by r.updated_at desc for update of r skip locked limit 1;
  if not found then
    update public.checkvan_operational_departure_push_outbox set delivery_status='retry',next_attempt_at=least(expires_at,now()+interval '10 seconds'),updated_at=now(),last_error_code='PUSH_TARGET_UNAVAILABLE' where id=event_row.id;
    return;
  end if;
  update public.checkvan_operational_departure_push_outbox set delivery_status='sending',attempts=attempts+1,claimed_at=now(),updated_at=now(),last_error_code=null where id=event_row.id;
  return query select event_row.id,registration_row.id,registration_row.fcm_token,event_row.expires_at;
end $$;

create or replace function public.internal_complete_operational_departure_push(
  p_event_id uuid,p_registration_id uuid,p_outcome text,p_provider_message_id text default null,p_error_code text default null
) returns void language plpgsql security definer set search_path='' as $$
begin
  if p_outcome='sent' then
    update public.checkvan_operational_departure_push_outbox set delivery_status='sent',delivered_at=now(),provider_message_id=p_provider_message_id,updated_at=now(),last_error_code=null where id=p_event_id and delivery_status='sending';
  elsif p_outcome='invalid_token' then
    update public.checkvan_device_push_registrations set active=false,revoked_at=now(),updated_at=now() where id=p_registration_id and active;
    update public.checkvan_operational_departure_push_outbox set delivery_status='failed',updated_at=now(),last_error_code='FCM_TOKEN_INVALID' where id=p_event_id and delivery_status='sending';
  else
    update public.checkvan_operational_departure_push_outbox set delivery_status=case when attempts>=3 then 'failed' else 'retry' end,
      next_attempt_at=least(expires_at,now()+make_interval(secs=>attempts*3)),updated_at=now(),last_error_code=coalesce(p_error_code,'FCM_TEMPORARY_FAILURE') where id=p_event_id and delivery_status='sending';
  end if;
end $$;

-- The queue transaction writes only durable local state.  Webhook/FCM delivery
-- happens after commit and is intentionally outside this function.
create or replace function public.internal_advance_operational_departure_queue(p_queue_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare q public.checkvan_operational_departure_queues%rowtype; current_item public.checkvan_operational_departure_queue_items%rowtype;
  next_item public.checkvan_operational_departure_queue_items%rowtype; called_item public.checkvan_operational_departure_queue_items%rowtype;
  final_item public.checkvan_operational_departure_queue_items%rowtype;
begin
  select * into q from public.checkvan_operational_departure_queues where id=p_queue_id and status='active' for update;
  if not found then return; end if;
  select * into current_item from public.checkvan_operational_departure_queue_items where queue_id=q.id and status='called' for update;
  if found and current_item.timeout_at>now() then return; end if;
  if found then update public.checkvan_operational_departure_queue_items set status='timed_out' where id=current_item.id and status='called'; end if;
  select * into next_item from public.checkvan_operational_departure_queue_items where queue_id=q.id and status='waiting' order by departure_order for update skip locked limit 1;
  if found then
    update public.checkvan_operational_departure_queue_items set status='called',called_at=now(),timeout_at=now()+make_interval(secs=>q.timeout_seconds)
      where id=next_item.id and status='waiting' returning * into called_item;
    if not found then return; end if;
    perform public.internal_enqueue_operational_departure_push(q.id,called_item.id,called_item.driver_id,called_item.timeout_at);
    if not exists(select 1 from public.checkvan_operational_departure_queue_items where queue_id=q.id and status='waiting') then
      update public.checkvan_operational_departure_queues set final_timeout_at=now()+interval '10 minutes' where id=q.id;
    end if;
    return;
  end if;
  select * into final_item from public.checkvan_operational_departure_queue_items where queue_id=q.id order by departure_order desc limit 1;
  if not found or final_item.status='departed' then update public.checkvan_operational_departure_queues set status='completed',completed_at=now() where id=q.id and status='active'; return; end if;
  if q.final_timeout_at is null then update public.checkvan_operational_departure_queues set final_timeout_at=coalesce(final_item.called_at,now())+interval '10 minutes' where id=q.id; return; end if;
  if q.final_timeout_at<=now() then update public.checkvan_operational_departure_queues set status='completed',completed_at=now() where id=q.id and status='active'; end if;
end $$;

revoke all on function public.internal_revoke_device_push_on_session_revocation() from public, anon, authenticated;
revoke all on function public.internal_register_device_push_token(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.internal_enqueue_operational_departure_push(uuid,uuid,uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.internal_claim_operational_departure_push(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.internal_complete_operational_departure_push(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.internal_register_device_push_token(uuid,uuid,text,text) to service_role;
grant execute on function public.internal_claim_operational_departure_push(uuid,uuid,uuid) to service_role;
grant execute on function public.internal_complete_operational_departure_push(uuid,uuid,text,text,text) to service_role;
