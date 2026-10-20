-- Keep an unanswered final driver recoverable for ten minutes after its call.
alter table public.checkvan_operational_departure_queues
  add column final_timeout_at timestamptz;

create or replace function public.internal_advance_operational_departure_queue(p_queue_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  q public.checkvan_operational_departure_queues%rowtype;
  current_item public.checkvan_operational_departure_queue_items%rowtype;
  next_item public.checkvan_operational_departure_queue_items%rowtype;
  final_item public.checkvan_operational_departure_queue_items%rowtype;
begin
  select * into q from public.checkvan_operational_departure_queues where id=p_queue_id and status='active' for update;
  if not found then return; end if;

  select * into current_item from public.checkvan_operational_departure_queue_items where queue_id=q.id and status='called' for update;
  if found and current_item.timeout_at > now() then return; end if;
  if found then
    update public.checkvan_operational_departure_queue_items set status='timed_out' where id=current_item.id and status='called';
  end if;

  select * into next_item from public.checkvan_operational_departure_queue_items where queue_id=q.id and status='waiting' order by departure_order for update skip locked limit 1;
  if found then
    update public.checkvan_operational_departure_queue_items
      set status='called', called_at=now(), timeout_at=now()+make_interval(secs=>q.timeout_seconds)
      where id=next_item.id;
    if not exists(select 1 from public.checkvan_operational_departure_queue_items where queue_id=q.id and status='waiting') then
      update public.checkvan_operational_departure_queues set final_timeout_at=now()+interval '10 minutes' where id=q.id;
    end if;
    return;
  end if;

  select * into final_item from public.checkvan_operational_departure_queue_items where queue_id=q.id order by departure_order desc limit 1;
  if not found or final_item.status='departed' then
    update public.checkvan_operational_departure_queues set status='completed', completed_at=now() where id=q.id and status='active';
    return;
  end if;

  -- Existing active queues created before this migration receive the same safe deadline.
  if q.final_timeout_at is null then
    update public.checkvan_operational_departure_queues
      set final_timeout_at=coalesce(final_item.called_at,now())+interval '10 minutes'
      where id=q.id;
    return;
  end if;
  if q.final_timeout_at <= now() then
    update public.checkvan_operational_departure_queues set status='completed', completed_at=now() where id=q.id and status='active';
  end if;
end $$;
