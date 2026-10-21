-- The return-table column expires_at is a PL/pgSQL variable.  Qualify all
-- outbox columns so claim/expiry processing remains deterministic.
create or replace function public.internal_claim_operational_departure_push(
  p_event_id uuid default null,
  p_driver_id uuid default null,
  p_organization_id uuid default null
) returns table(event_id uuid, registration_id uuid, fcm_token text, expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare
  event_row public.checkvan_operational_departure_push_outbox%rowtype;
  registration_row public.checkvan_device_push_registrations%rowtype;
begin
  update public.checkvan_operational_departure_push_outbox as outbox
  set delivery_status='expired', updated_at=now(), last_error_code='EVENT_EXPIRED'
  where outbox.delivery_status in ('pending','retry','sending')
    and outbox.expires_at<=now();

  select outbox.* into event_row
  from public.checkvan_operational_departure_push_outbox as outbox
  where (p_event_id is null or outbox.id=p_event_id)
    and (p_driver_id is null or outbox.driver_id=p_driver_id)
    and (p_organization_id is null or outbox.organization_id=p_organization_id)
    and outbox.delivery_status in ('pending','retry')
    and outbox.next_attempt_at<=now()
    and outbox.expires_at>now()
  order by outbox.created_at
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  if not exists(
    select 1
    from public.checkvan_operational_departure_queue_items as queue_item
    where queue_item.id=event_row.queue_item_id
      and queue_item.status='called'
      and queue_item.timeout_at>now()
  ) then
    update public.checkvan_operational_departure_push_outbox as outbox
    set delivery_status='expired', updated_at=now(), last_error_code='CALL_NO_LONGER_ACTIVE'
    where outbox.id=event_row.id;
    return;
  end if;

  select registration.* into registration_row
  from public.checkvan_device_push_registrations as registration
  join public.checkvan_device_driver_sessions as session_row
    on session_row.id=registration.driver_session_id
  join public.checkvan_driver_access_tokens as access_token
    on access_token.id=session_row.access_token_id
  where registration.organization_id=event_row.organization_id
    and registration.driver_id=event_row.driver_id
    and registration.active
    and registration.revoked_at is null
    and session_row.revoked_at is null
    and session_row.expires_at>now()
    and access_token.status='active'
  order by registration.updated_at desc
  for update of registration skip locked
  limit 1;

  if not found then
    update public.checkvan_operational_departure_push_outbox as outbox
    set delivery_status='retry',
        next_attempt_at=least(outbox.expires_at, now()+interval '10 seconds'),
        updated_at=now(),
        last_error_code='PUSH_TARGET_UNAVAILABLE'
    where outbox.id=event_row.id;
    return;
  end if;

  update public.checkvan_operational_departure_push_outbox as outbox
  set delivery_status='sending',
      attempts=outbox.attempts+1,
      claimed_at=now(),
      updated_at=now(),
      last_error_code=null
  where outbox.id=event_row.id;

  return query select event_row.id, registration_row.id, registration_row.fcm_token, event_row.expires_at;
end $$;

revoke all on function public.internal_claim_operational_departure_push(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.internal_claim_operational_departure_push(uuid,uuid,uuid)
  to service_role;
