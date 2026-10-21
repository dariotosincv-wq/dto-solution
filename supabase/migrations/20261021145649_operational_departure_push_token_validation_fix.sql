-- Correct PostgreSQL token-length validation without changing the identity,
-- session, ownership, RLS, or privilege model introduced by the FCM outbox.
create or replace function public.internal_register_device_push_token(
  p_session_id uuid, p_device_id uuid, p_token text, p_token_hash text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  session_row public.checkvan_device_driver_sessions%rowtype;
  registration_id uuid;
begin
  if char_length(p_token) not between 80 and 4096
     or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_PUSH_TOKEN';
  end if;

  select * into session_row
  from public.checkvan_device_driver_sessions
  where id=p_session_id
    and device_id=p_device_id
    and revoked_at is null
    and expires_at>now()
  for update;

  if not found then
    raise exception 'DRIVER_IDENTITY_REQUIRED';
  end if;

  update public.checkvan_device_push_registrations
  set active=false, revoked_at=now(), updated_at=now()
  where active and revoked_at is null
    and (device_id=p_device_id or (organization_id=session_row.organization_id and driver_id=session_row.driver_id));

  insert into public.checkvan_device_push_registrations(
    organization_id, driver_id, device_id, driver_session_id, token_hash, fcm_token
  ) values(
    session_row.organization_id, session_row.driver_id, p_device_id, session_row.id, p_token_hash, p_token
  )
  on conflict(token_hash) do update
  set organization_id=excluded.organization_id,
      driver_id=excluded.driver_id,
      device_id=excluded.device_id,
      driver_session_id=excluded.driver_session_id,
      fcm_token=excluded.fcm_token,
      active=true,
      revoked_at=null,
      updated_at=now(),
      last_seen_at=now()
  returning id into registration_id;

  return registration_id;
end $$;

revoke all on function public.internal_register_device_push_token(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.internal_register_device_push_token(uuid,uuid,text,text)
  to service_role;
