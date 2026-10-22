-- Device-only departure read model.  It deliberately returns no queue rows
-- other than the authenticated driver's aggregate status.
create or replace function public.internal_device_driver_departure_status(
  p_organization_id uuid,
  p_driver_id uuid,
  p_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  queue_item public.checkvan_operational_departure_queue_items%rowtype;
  queue_row public.checkvan_operational_departure_queues%rowtype;
  confirmed_row public.checkvan_operational_day_driver_rows%rowtype;
  ahead_count integer;
begin
  select item_value.*
  into queue_item
  from public.checkvan_operational_departure_queue_items item_value
  join public.checkvan_operational_departure_queues queue_value
    on queue_value.id = item_value.queue_id
  where queue_value.organization_id = p_organization_id
    and queue_value.operating_date = p_date
    and item_value.organization_id = p_organization_id
    and item_value.driver_id = p_driver_id;

  if found then
    select * into queue_row
    from public.checkvan_operational_departure_queues queue_value
    where queue_value.id = queue_item.queue_id
      and queue_value.organization_id = p_organization_id
      and queue_value.operating_date = p_date;

    select count(*)::integer
    into ahead_count
    from public.checkvan_operational_departure_queue_items preceding_item
    where preceding_item.queue_id = queue_row.id
      and preceding_item.organization_id = p_organization_id
      and preceding_item.departure_order < queue_item.departure_order
      and preceding_item.status in ('waiting', 'called');

    return jsonb_build_object(
      'queue_status', queue_row.status,
      'position', queue_item.departure_order,
      'drivers_ahead', ahead_count,
      'status', queue_item.status,
      'updated_at', coalesce(queue_item.departed_at, queue_item.called_at, queue_row.started_at)
    );
  end if;

  select row_value.*
  into confirmed_row
  from public.checkvan_operational_days day_value
  join public.checkvan_operational_day_driver_rows row_value
    on row_value.operational_day_id = day_value.id
  where day_value.organization_id = p_organization_id
    and day_value.operating_date = p_date
    and day_value.status = 'confirmed'
    and row_value.organization_id = p_organization_id
    and row_value.driver_id = p_driver_id
    and row_value.work_status = 'TURNO'
    and row_value.departure_order is not null;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'queue_status', 'not_started',
    'position', confirmed_row.departure_order,
    'drivers_ahead', greatest(confirmed_row.departure_order - 1, 0),
    'status', 'not_started',
    'updated_at', null
  );
end;
$$;

revoke all on function public.internal_device_driver_departure_status(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.internal_device_driver_departure_status(uuid, uuid, date) to service_role;
