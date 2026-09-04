-- DTO Solution internal administration only. This migration is prepared and
-- tested locally; it must not be applied remotely without explicit approval.
begin;

create unique index checkvan_trial_provision_request_uidx
  on public.checkvan_license_audit ((metadata->>'request_key'))
  where event_type='trial_provisioned' and metadata ? 'request_key';

create or replace function public.admin_provision_checkvan_trial(
  p_organization_name text,
  p_capacity integer default 10,
  p_trial_days integer default 30,
  p_token_count integer default 1,
  p_starts_at timestamptz default now(),
  p_internal_label text default null,
  p_request_key text default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  normalized_name text := btrim(coalesce(p_organization_name,''));
  request_key text := btrim(coalesce(p_request_key,''));
  organization_row public.checkvan_organizations%rowtype;
  license_row public.checkvan_licenses%rowtype;
  existing_audit public.checkvan_license_audit%rowtype;
  proposed_ends_at timestamptz;
  token_value text;
  tokens jsonb := '[]'::jsonb;
begin
  if char_length(normalized_name) not between 2 and 200 then
    raise exception using errcode='22023',message='INVALID_ORGANIZATION_NAME';
  end if;
  if p_capacity is null or p_capacity < 1 or p_capacity > 100000 then
    raise exception using errcode='22023',message='INVALID_CAPACITY';
  end if;
  if p_trial_days is null or p_trial_days < 1 or p_trial_days > 3650 then
    raise exception using errcode='22023',message='INVALID_TRIAL_DAYS';
  end if;
  if p_token_count is null or p_token_count < 1 or p_token_count > p_capacity then
    raise exception using errcode='22023',message='INVALID_TOKEN_COUNT';
  end if;
  if p_starts_at is null then
    raise exception using errcode='22023',message='INVALID_START_DATE';
  end if;
  if char_length(request_key) not between 8 and 200 then
    raise exception using errcode='22023',message='INVALID_REQUEST_KEY';
  end if;
  if p_internal_label is not null and char_length(btrim(p_internal_label)) not between 1 and 500 then
    raise exception using errcode='22023',message='INVALID_INTERNAL_LABEL';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('checkvan-trial:' || request_key,0));

  select * into existing_audit
  from public.checkvan_license_audit
  where event_type='trial_provisioned' and metadata->>'request_key'=request_key;
  if found then
    select * into organization_row from public.checkvan_organizations where id=existing_audit.organization_id;
    select * into license_row from public.checkvan_licenses where id=existing_audit.license_id;
    if lower(btrim(organization_row.name))<>lower(normalized_name)
       or license_row.capacity<>p_capacity
       or (existing_audit.metadata->>'trial_days')::integer<>p_trial_days
       or (existing_audit.metadata->>'token_count')::integer<>p_token_count then
      raise exception using errcode='22023',message='IDEMPOTENCY_KEY_CONFLICT';
    end if;
    return jsonb_build_object(
      'status','existing','organization_id',organization_row.id,'license_id',license_row.id,
      'starts_at',license_row.starts_at,'ends_at',license_row.ends_at,'capacity',license_row.capacity,
      'tokens','[]'::jsonb,'tokens_recoverable',false,
      'message','Trial already provisioned; enrollment tokens are returned only on first creation.'
    );
  end if;

  select * into organization_row
  from public.checkvan_organizations
  where lower(btrim(name))=lower(normalized_name)
  order by created_at
  limit 1
  for update;
  if not found then
    insert into public.checkvan_organizations(name,status)
    values (normalized_name,'active') returning * into organization_row;
  elsif organization_row.status<>'active' then
    raise exception using errcode='22023',message='ORGANIZATION_NOT_ACTIVE';
  end if;

  proposed_ends_at := p_starts_at + pg_catalog.make_interval(days=>p_trial_days);
  perform 1 from public.checkvan_licenses
  where organization_id=organization_row.id
    and status in ('active','suspended')
    and starts_at < proposed_ends_at
    and coalesce(ends_at,'infinity'::timestamptz) > p_starts_at;
  if found then
    raise exception using errcode='22023',message='OVERLAPPING_LICENSE_EXISTS';
  end if;

  -- The production licensing core uses the base columns. DTO's local Company
  -- Cloud reconstruction adds three entitlement columns. Support both without
  -- altering either schema or any existing license.
  if exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid='public.checkvan_licenses'::pg_catalog.regclass
      and attname='access_grant' and not attisdropped
  ) then
    insert into public.checkvan_licenses(
      organization_id,kind,status,capacity,starts_at,ends_at,product_mode,cloud_enabled,access_grant
    ) values (
      organization_row.id,'trial','active',p_capacity,p_starts_at,proposed_ends_at,'company',true,'TRIAL'
    ) returning * into license_row;
  else
    insert into public.checkvan_licenses(
      organization_id,kind,status,capacity,starts_at,ends_at
    ) values (
      organization_row.id,'trial','active',p_capacity,p_starts_at,proposed_ends_at
    ) returning * into license_row;
  end if;

  for i in 1..p_token_count loop
    token_value := public.admin_create_checkvan_enrollment_token(license_row.id,now()+interval '24 hours');
    tokens := tokens || jsonb_build_array(token_value);
  end loop;

  insert into public.checkvan_license_audit(event_type,organization_id,license_id,metadata)
  values ('trial_provisioned',organization_row.id,license_row.id,jsonb_build_object(
    'request_key',request_key,'trial_days',p_trial_days,'capacity',p_capacity,
    'token_count',p_token_count,'internal_label',nullif(btrim(p_internal_label),'')
  ));

  return jsonb_build_object(
    'status','created','organization_id',organization_row.id,'license_id',license_row.id,
    'starts_at',license_row.starts_at,'ends_at',license_row.ends_at,'capacity',license_row.capacity,
    'tokens',tokens,'tokens_recoverable',true,'message','Trial and enrollment tokens created.'
  );
end $$;

revoke all on function public.admin_provision_checkvan_trial(text,integer,integer,integer,timestamptz,text,text)
  from public,anon,authenticated;
grant execute on function public.admin_provision_checkvan_trial(text,integer,integer,integer,timestamptz,text,text)
  to service_role;

commit;
