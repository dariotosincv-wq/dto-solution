-- Company-admin read model for the DSP departures board. It deliberately
-- derives the list from the confirmed day, not from enrolled devices or an
-- already started queue.
create or replace function public.internal_admin_read_operational_departure_board(
  p_auth_subject uuid,
  p_organization_id uuid,
  p_date date,
  p_connected_within_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  day_row public.checkvan_operational_days%rowtype;
  queue_row public.checkvan_operational_departure_queues%rowtype;
begin
  if p_connected_within_seconds not between 30 and 3600 then
    raise exception using errcode = '22023', message = 'INVALID_CONNECTION_ACTIVITY_WINDOW';
  end if;

  if not exists (
    select 1
    from public.checkvan_area_memberships membership
    where membership.auth_subject = p_auth_subject
      and membership.organization_id = p_organization_id
      and membership.role = 'COMPANY_ADMIN'
      and membership.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'COMPANY_ADMIN_REQUIRED';
  end if;

  select * into day_row
  from public.checkvan_operational_days day_value
  where day_value.organization_id = p_organization_id
    and day_value.operating_date = p_date
    and day_value.status = 'confirmed';

  if not found then
    return jsonb_build_object('day', null, 'queue', null, 'items', '[]'::jsonb);
  end if;

  select * into queue_row
  from public.checkvan_operational_departure_queues queue_value
  where queue_value.organization_id = p_organization_id
    and queue_value.operating_date = p_date;

  return jsonb_build_object(
    'day', to_jsonb(day_row),
    'queue', case when queue_row.id is null then null else to_jsonb(queue_row) end,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'row', to_jsonb(row_value),
          'item', case when queue_item.id is null then null else to_jsonb(queue_item) end,
          'departure_state', case
            when queue_row.id is null then 'not_started'
            when queue_item.status = 'waiting' then 'waiting'
            when queue_item.status = 'called' then 'called'
            when queue_item.status = 'departed' then 'departed'
            when queue_item.status = 'timed_out' then 'timed_out'
            else 'anomaly'
          end,
          'connection', jsonb_build_object(
            'state', case
              when driver_session.id is not null
                and driver_session.revoked_at is null
                and driver_session.expires_at > now()
                and driver_token.status = 'active'
                and driver_session.last_used_at >= now() - make_interval(secs => p_connected_within_seconds)
              then 'connected'
              else 'disconnected'
            end,
            'last_contact_at', greatest(driver_session.last_used_at, device.last_validated_at),
            'last_qr_activity_at', driver_session.last_used_at,
            'last_device_validation_at', device.last_validated_at
          )
        )
        order by row_value.departure_order
      )
      from public.checkvan_operational_day_driver_rows row_value
      left join public.checkvan_operational_departure_queue_items queue_item
        on queue_item.queue_id = queue_row.id
       and queue_item.operational_row_id = row_value.id
      left join lateral (
        select session_value.*
        from public.checkvan_device_driver_sessions session_value
        where session_value.organization_id = p_organization_id
          and session_value.driver_id = row_value.driver_id
        order by session_value.last_used_at desc nulls last, session_value.created_at desc
        limit 1
      ) driver_session on true
      left join public.checkvan_driver_access_tokens driver_token
        on driver_token.id = driver_session.access_token_id
      left join public.checkvan_license_devices device
        on device.id = driver_session.device_id
      where row_value.operational_day_id = day_row.id
        and row_value.organization_id = p_organization_id
        and row_value.work_status = 'TURNO'
        and row_value.departure_order is not null
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.internal_admin_read_operational_departure_board(uuid, uuid, date, integer) from public, anon, authenticated;
grant execute on function public.internal_admin_read_operational_departure_board(uuid, uuid, date, integer) to service_role;
