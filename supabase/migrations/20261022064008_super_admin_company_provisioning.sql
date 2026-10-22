begin;

create or replace function public.internal_super_admin_create_company(
  p_actor_auth_subject uuid,
  p_owner_email text,
  p_organization_name text,
  p_slug text,
  p_capacity integer,
  p_access_grant text default 'TESTER',
  p_organization_type text default 'internal_test',
  p_status text default 'active',
  p_trial_days integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_owner_email, '')));
  normalized_name text := btrim(coalesce(p_organization_name, ''));
  normalized_slug text := lower(btrim(coalesce(p_slug, '')));
  normalized_grant text := upper(btrim(coalesce(p_access_grant, '')));
  normalized_type text := lower(btrim(coalesce(p_organization_type, '')));
  normalized_status text := lower(btrim(coalesce(p_status, '')));
  owner_subject uuid;
  owner_banned_until timestamptz;
  organization_row public.checkvan_organizations%rowtype;
  license_row public.checkvan_licenses%rowtype;
  effective_trial_days integer;
  license_kind text;
  license_ends_at timestamptz;
begin
  if p_actor_auth_subject is null or not exists (
    select 1 from public.dto_super_admins admin
    where admin.auth_subject = p_actor_auth_subject and admin.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'SUPER_ADMIN_REQUIRED';
  end if;

  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'
     or char_length(normalized_email) > 320 then
    raise exception using errcode = '22023', message = 'INVALID_OWNER_EMAIL';
  end if;
  if char_length(normalized_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'INVALID_ORGANIZATION_NAME';
  end if;
  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(normalized_slug) > 80 then
    raise exception using errcode = '22023', message = 'INVALID_ORGANIZATION_SLUG';
  end if;
  if p_capacity is null or p_capacity < 1 or p_capacity > 10000 then
    raise exception using errcode = '22023', message = 'INVALID_LICENSE_CAPACITY';
  end if;
  if normalized_grant not in ('TESTER', 'PAID', 'TRIAL') then
    raise exception using errcode = '22023', message = 'INVALID_ACCESS_GRANT';
  end if;
  if normalized_type not in ('customer', 'internal_test') then
    raise exception using errcode = '22023', message = 'INVALID_ORGANIZATION_TYPE';
  end if;
  if normalized_status not in ('active', 'suspended') then
    raise exception using errcode = '22023', message = 'INVALID_ORGANIZATION_STATUS';
  end if;

  select users.id, users.banned_until
    into owner_subject, owner_banned_until
    from auth.users users
   where lower(users.email) = normalized_email
   limit 1
   for update;
  if owner_subject is null then
    raise exception using errcode = '22023', message = 'OWNER_AUTH_USER_NOT_FOUND';
  end if;
  if owner_banned_until is not null and owner_banned_until > now() then
    raise exception using errcode = '22023', message = 'OWNER_AUTH_USER_INACTIVE';
  end if;
  if exists (
    select 1 from public.checkvan_area_memberships membership
    where membership.auth_subject = owner_subject
  ) then
    raise exception using errcode = '23505', message = 'OWNER_ALREADY_HAS_MEMBERSHIP';
  end if;
  if exists (select 1 from public.checkvan_organizations organization where lower(organization.name) = lower(normalized_name)) then
    raise exception using errcode = '23505', message = 'ORGANIZATION_NAME_ALREADY_EXISTS';
  end if;
  if exists (select 1 from public.checkvan_organizations organization where organization.slug = normalized_slug) then
    raise exception using errcode = '23505', message = 'ORGANIZATION_SLUG_ALREADY_EXISTS';
  end if;

  if normalized_grant = 'TRIAL' then
    effective_trial_days := coalesce(p_trial_days, 30);
    if effective_trial_days not between 1 and 365 then
      raise exception using errcode = '22023', message = 'INVALID_TRIAL_DAYS';
    end if;
    license_kind := 'trial';
    license_ends_at := now() + make_interval(days => effective_trial_days);
  else
    if p_trial_days is not null then
      raise exception using errcode = '22023', message = 'TRIAL_DAYS_ONLY_FOR_TRIAL';
    end if;
    license_kind := 'commercial';
    license_ends_at := null;
  end if;

  insert into public.checkvan_organizations(name, slug, status, organization_type)
  values (normalized_name, normalized_slug, normalized_status, normalized_type)
  returning * into organization_row;

  insert into public.checkvan_licenses(
    organization_id, kind, status, capacity, starts_at, ends_at, product_mode, cloud_enabled, access_grant
  ) values (
    organization_row.id, license_kind, 'active', p_capacity, now(), license_ends_at, 'company', true, normalized_grant
  ) returning * into license_row;

  insert into public.checkvan_area_memberships(auth_subject, organization_id, role, status)
  values (owner_subject, organization_row.id, 'COMPANY_ADMIN', 'active');

  insert into public.checkvan_license_audit(event_type, organization_id, license_id, metadata)
  values ('super_admin_company_created', organization_row.id, license_row.id, jsonb_build_object(
    'actor_subject', p_actor_auth_subject,
    'owner_auth_subject', owner_subject,
    'access_grant', normalized_grant,
    'capacity', p_capacity,
    'organization_type', normalized_type,
    'organization_status', normalized_status
  ));

  return jsonb_build_object(
    'organization_id', organization_row.id,
    'organization_name', organization_row.name,
    'license_id', license_row.id,
    'owner_auth_subject', owner_subject,
    'access_grant', license_row.access_grant,
    'status', organization_row.status
  );
end;
$$;

revoke all on function public.internal_super_admin_create_company(uuid,text,text,text,integer,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.internal_super_admin_create_company(uuid,text,text,text,integer,text,text,text,integer) to service_role;

commit;
