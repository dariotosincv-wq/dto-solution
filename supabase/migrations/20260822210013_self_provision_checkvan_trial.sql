-- Target project: Driver Utility / CheckVan (xlsrikqeqxwgzjakgmhz).
-- Prepared locally only. Do not apply remotely without explicit approval.
begin;

create or replace function public.self_provision_checkvan_trial(
  p_auth_subject uuid,
  p_organization_name text,
  p_capacity integer default 10,
  p_trial_days integer default 30
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := btrim(coalesce(p_organization_name, ''));
  request_key text := 'self-trial:' || p_auth_subject::text;
  organization_row public.checkvan_organizations%rowtype;
  license_row public.checkvan_licenses%rowtype;
  membership_row public.checkvan_area_memberships%rowtype;
  existing_audit public.checkvan_license_audit%rowtype;
  token_value text;
  starts_at timestamptz := now();
  ends_at timestamptz;
begin
  if p_auth_subject is null then
    raise exception using errcode = '22023', message = 'INVALID_AUTH_SUBJECT';
  end if;
  if char_length(normalized_name) not between 2 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_ORGANIZATION_NAME';
  end if;
  if p_capacity is null or p_capacity < 1 or p_capacity > 100000 then
    raise exception using errcode = '22023', message = 'INVALID_CAPACITY';
  end if;
  if p_trial_days is null or p_trial_days < 1 or p_trial_days > 3650 then
    raise exception using errcode = '22023', message = 'INVALID_TRIAL_DAYS';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('checkvan-self-trial:' || p_auth_subject::text, 0)
  );

  select * into existing_audit
  from public.checkvan_license_audit
  where event_type = 'trial_provisioned'
    and metadata ->> 'request_key' = request_key;

  if found then
    if existing_audit.metadata ->> 'auth_subject' <> p_auth_subject::text
       or lower(existing_audit.metadata ->> 'organization_name') <> lower(normalized_name)
       or (existing_audit.metadata ->> 'capacity')::integer <> p_capacity
       or (existing_audit.metadata ->> 'trial_days')::integer <> p_trial_days then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_CONFLICT';
    end if;

    select * into membership_row
    from public.checkvan_area_memberships
    where auth_subject = p_auth_subject;
    select * into organization_row
    from public.checkvan_organizations
    where id = existing_audit.organization_id;
    select * into license_row
    from public.checkvan_licenses
    where id = existing_audit.license_id;

    if membership_row.id is null
       or membership_row.status <> 'active'
       or membership_row.role <> 'COMPANY_ADMIN'
       or membership_row.organization_id <> organization_row.id
       or license_row.id is null then
      raise exception using errcode = '22023', message = 'INCONSISTENT_TRIAL_PROVISIONING';
    end if;

    return jsonb_build_object(
      'status', 'existing',
      'organization_id', organization_row.id,
      'license_id', license_row.id,
      'starts_at', license_row.starts_at,
      'ends_at', license_row.ends_at,
      'capacity', license_row.capacity,
      'tokens', '[]'::jsonb,
      'tokens_recoverable', false
    );
  end if;

  select * into membership_row
  from public.checkvan_area_memberships
  where auth_subject = p_auth_subject
  for update;
  if found then
    raise exception using errcode = '22023', message = 'MEMBERSHIP_ALREADY_EXISTS';
  end if;

  -- Always create a new organization for self-provisioning. A matching display
  -- name must never allow a user to claim an organization owned by someone else.
  insert into public.checkvan_organizations(name, status)
  values (normalized_name, 'active')
  returning * into organization_row;

  ends_at := starts_at + pg_catalog.make_interval(days => p_trial_days);
  if exists (
    select 1
    from pg_catalog.pg_attribute
    where attrelid = 'public.checkvan_licenses'::pg_catalog.regclass
      and attname = 'access_grant'
      and not attisdropped
  ) then
    insert into public.checkvan_licenses(
      organization_id, kind, status, capacity, starts_at, ends_at,
      product_mode, cloud_enabled, access_grant
    ) values (
      organization_row.id, 'trial', 'active', p_capacity, starts_at, ends_at,
      'company', true, 'TRIAL'
    ) returning * into license_row;
  else
    insert into public.checkvan_licenses(
      organization_id, kind, status, capacity, starts_at, ends_at
    ) values (
      organization_row.id, 'trial', 'active', p_capacity, starts_at, ends_at
    ) returning * into license_row;
  end if;

  token_value := public.admin_create_checkvan_enrollment_token(
    license_row.id,
    now() + interval '24 hours'
  );

  insert into public.checkvan_area_memberships(
    auth_subject, organization_id, role, status
  ) values (
    p_auth_subject, organization_row.id, 'COMPANY_ADMIN', 'active'
  ) returning * into membership_row;

  insert into public.checkvan_license_audit(
    event_type, organization_id, license_id, metadata
  ) values (
    'trial_provisioned',
    organization_row.id,
    license_row.id,
    jsonb_build_object(
      'request_key', request_key,
      'auth_subject', p_auth_subject::text,
      'organization_name', normalized_name,
      'trial_days', p_trial_days,
      'capacity', p_capacity,
      'token_count', 1,
      'source', 'dto_company_self_service'
    )
  );

  return jsonb_build_object(
    'status', 'created',
    'organization_id', organization_row.id,
    'license_id', license_row.id,
    'starts_at', license_row.starts_at,
    'ends_at', license_row.ends_at,
    'capacity', license_row.capacity,
    'tokens', jsonb_build_array(token_value),
    'tokens_recoverable', true
  );
end;
$$;

revoke all on function public.self_provision_checkvan_trial(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.self_provision_checkvan_trial(uuid, text, integer, integer)
  to service_role;

commit;
