-- QR Hub is a public, shared catalogue. It is intentionally separate from
-- CheckVan organizations and from every company table.
alter table public.qr_locali enable row level security;
revoke all on table public.qr_locali from public, anon, authenticated;
grant usage on schema public to anon;
grant select (id, pdv, city, province, driver, qr_text, latitude, longitude, accuracy, created_at)
  on table public.qr_locali to anon;

drop policy if exists qr_locali_public_read on public.qr_locali;
create policy qr_locali_public_read on public.qr_locali
  for select to anon using (true);

create table if not exists public.qr_hub_submission_rate_limits (
  rate_key text primary key check (rate_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  submission_count integer not null default 0 check (submission_count >= 0 and submission_count <= 10)
);
alter table public.qr_hub_submission_rate_limits enable row level security;
revoke all on table public.qr_hub_submission_rate_limits from public, anon, authenticated;

create or replace function public.internal_submit_public_qr_hub(
  p_rate_key text, p_pdv text, p_city text, p_province text, p_driver text,
  p_qr_text text, p_latitude double precision, p_longitude double precision,
  p_accuracy double precision
) returns table(id text, created_at timestamptz, reused_existing boolean)
language plpgsql security definer set search_path = '' as $$
declare v_existing public.qr_locali%rowtype; v_now timestamptz := now();
begin
  if p_rate_key !~ '^[a-f0-9]{64}$' then raise exception 'QR_HUB_RATE_KEY_INVALID'; end if;
  if length(trim(coalesce(p_pdv,''))) not between 1 and 160 then raise exception 'QR_HUB_PDV_INVALID'; end if;
  if length(trim(coalesce(p_city,''))) not between 1 and 160 then raise exception 'QR_HUB_CITY_INVALID'; end if;
  if trim(coalesce(p_province,'')) !~ '^[A-Z]{2}$' then raise exception 'QR_HUB_PROVINCE_INVALID'; end if;
  if length(trim(coalesce(p_qr_text,''))) not between 1 and 4096 then raise exception 'QR_HUB_QR_INVALID'; end if;
  if length(coalesce(p_driver,'')) > 40 then raise exception 'QR_HUB_TEXT_INVALID'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_rate_key, 41));
  select * into v_existing from public.qr_hub_submission_rate_limits where rate_key=p_rate_key for update;
  if not found then
    insert into public.qr_hub_submission_rate_limits(rate_key,window_started_at,submission_count) values(p_rate_key,v_now,1);
  elsif v_existing.window_started_at <= v_now - interval '1 hour' then
    update public.qr_hub_submission_rate_limits set window_started_at=v_now,submission_count=1 where rate_key=p_rate_key;
  elsif v_existing.submission_count >= 10 then
    raise exception using errcode='P0001', message='QR_HUB_RATE_LIMITED';
  else
    update public.qr_hub_submission_rate_limits set submission_count=submission_count+1 where rate_key=p_rate_key;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(upper(trim(p_driver)) || chr(1) || lower(trim(p_city)) || chr(1) || trim(p_qr_text), 42));
  select * into v_existing from public.qr_locali
   where coalesce(upper(trim(driver)),'')=coalesce(upper(trim(p_driver)),'')
     and lower(trim(city))=lower(trim(p_city)) and trim(qr_text)=trim(p_qr_text)
   order by created_at,id limit 1 for update;
  if found then
    update public.qr_locali set pdv=coalesce(nullif(trim(p_pdv),''),v_existing.pdv), province=upper(trim(p_province)),
      latitude=coalesce(p_latitude,v_existing.latitude),
      longitude=coalesce(p_longitude,v_existing.longitude), accuracy=coalesce(p_accuracy,v_existing.accuracy)
      where qr_locali.id=v_existing.id;
    return query select v_existing.id,v_existing.created_at,true;
  end if;
  return query insert into public.qr_locali(id,pdv,city,province,driver,qr_text,latitude,longitude,accuracy,created_at)
    values(gen_random_uuid()::text,trim(p_pdv),trim(p_city),upper(trim(p_province)),nullif(upper(trim(p_driver)),''),trim(p_qr_text),p_latitude,p_longitude,p_accuracy,v_now)
    returning qr_locali.id,qr_locali.created_at,false;
end $$;

revoke all on function public.internal_submit_public_qr_hub(text,text,text,text,text,text,double precision,double precision,double precision) from public, anon, authenticated;
grant execute on function public.internal_submit_public_qr_hub(text,text,text,text,text,text,double precision,double precision,double precision) to service_role;
