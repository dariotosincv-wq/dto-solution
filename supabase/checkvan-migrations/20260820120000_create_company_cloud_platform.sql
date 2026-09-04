-- Target project: Driver Utility / CheckVan.
-- SUPERSEDED: DO NOT APPLY. This draft predates remote-schema introspection.
-- Use 20260821120000_extend_existing_checkvan_company_cloud.sql instead.

begin;

create extension if not exists pgcrypto;

create table if not exists public.checkvan_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  organization_type text not null default 'customer' check (organization_type in ('customer', 'internal_test', 'internal_founder')),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  retention_days integer not null default 730 check (retention_days between 30 and 3650),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.checkvan_organizations add column if not exists slug text;
alter table public.checkvan_organizations add column if not exists organization_type text not null default 'customer';
alter table public.checkvan_organizations add column if not exists retention_days integer not null default 730;
create unique index if not exists checkvan_organizations_slug_uidx on public.checkvan_organizations(slug) where slug is not null;

insert into public.checkvan_organizations (name, slug, organization_type, status)
values ('DTO Solution - Founder', 'dto-founder', 'internal_founder', 'active'), ('DTO Solution - Tester', 'dto-tester', 'internal_test', 'active')
on conflict (slug) do nothing;

create table if not exists public.checkvan_licenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  kind text not null check (kind in ('trial', 'commercial')),
  product_mode text not null default 'company' check (product_mode in ('company', 'personal')),
  cloud_enabled boolean not null default true,
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked', 'expired')),
  capacity integer not null check (capacity > 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.checkvan_licenses add column if not exists product_mode text not null default 'company';
alter table public.checkvan_licenses add column if not exists cloud_enabled boolean not null default true;
create index if not exists checkvan_licenses_org_dates_idx on public.checkvan_licenses(organization_id, starts_at desc);

create table if not exists public.checkvan_access_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  auth_subject uuid,
  grant_type text not null check (grant_type in ('TESTER', 'FOUNDER')),
  product_mode text not null default 'company' check (product_mode in ('company', 'personal')),
  device_capacity integer not null default 100 check (device_capacity between 1 and 1000),
  status text not null default 'active' check (status in ('active', 'revoked')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (product_mode = 'company')
);
alter table public.checkvan_access_entitlements add column if not exists device_capacity integer not null default 100;
create unique index if not exists checkvan_entitlements_subject_uidx on public.checkvan_access_entitlements(organization_id, auth_subject, grant_type) where status = 'active';
create unique index if not exists checkvan_entitlements_org_wide_uidx on public.checkvan_access_entitlements(organization_id, grant_type) where auth_subject is null and status = 'active';

insert into public.checkvan_access_entitlements (organization_id, grant_type)
select id, case organization_type when 'internal_founder' then 'FOUNDER' else 'TESTER' end
from public.checkvan_organizations where organization_type in ('internal_founder', 'internal_test')
on conflict do nothing;

create table if not exists public.checkvan_license_devices (
  id uuid primary key default gen_random_uuid(),
  key_id text not null unique,
  public_key_spki_base64 text not null,
  platform text not null default 'android',
  app_version text,
  device_model text,
  status text not null default 'active' check (status in ('active', 'revoked')),
  enrolled_at timestamptz not null default now(),
  last_validated_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.checkvan_device_assignments (
  id uuid primary key default gen_random_uuid(),
  license_id uuid references public.checkvan_licenses(id) on delete restrict,
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  entitlement_id uuid references public.checkvan_access_entitlements(id) on delete restrict,
  device_id uuid not null references public.checkvan_license_devices(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'released', 'revoked')),
  assigned_at timestamptz not null default now(),
  released_at timestamptz,
  check ((license_id is not null) <> (entitlement_id is not null))
);
alter table public.checkvan_device_assignments add column if not exists organization_id uuid references public.checkvan_organizations(id) on delete restrict;
alter table public.checkvan_device_assignments add column if not exists entitlement_id uuid references public.checkvan_access_entitlements(id) on delete restrict;
alter table public.checkvan_license_devices add column if not exists key_id text;
alter table public.checkvan_license_devices add column if not exists public_key_spki_base64 text;
alter table public.checkvan_license_devices add column if not exists status text not null default 'active';
alter table public.checkvan_license_devices add column if not exists app_version text;
alter table public.checkvan_license_devices add column if not exists device_model text;
alter table public.checkvan_license_devices add column if not exists revoked_at timestamptz;
create unique index if not exists checkvan_device_active_assignment_uidx on public.checkvan_device_assignments(device_id) where status = 'active';
create index if not exists checkvan_device_assignments_license_idx on public.checkvan_device_assignments(license_id) where status = 'active';
create index if not exists checkvan_device_assignments_org_idx on public.checkvan_device_assignments(organization_id) where status = 'active';

create table if not exists public.checkvan_enrollment_tokens (
  id uuid primary key default gen_random_uuid(),
  license_id uuid references public.checkvan_licenses(id) on delete cascade,
  entitlement_id uuid references public.checkvan_access_entitlements(id) on delete cascade,
  organization_id uuid not null references public.checkvan_organizations(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((license_id is not null) <> (entitlement_id is not null))
);

create table if not exists public.checkvan_device_request_nonces (
  device_id uuid not null references public.checkvan_license_devices(id) on delete cascade,
  request_id uuid not null,
  requested_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (device_id, request_id)
);
create index if not exists checkvan_device_nonces_created_idx on public.checkvan_device_request_nonces(created_at);

create table if not exists public.checkvan_inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  license_id uuid references public.checkvan_licenses(id) on delete restrict,
  entitlement_id uuid references public.checkvan_access_entitlements(id) on delete restrict,
  device_id uuid not null references public.checkvan_license_devices(id) on delete restrict,
  device_assignment_id uuid not null references public.checkvan_device_assignments(id) on delete restrict,
  device_generated_id uuid not null,
  inspection_type text not null check (inspection_type in ('pickup', 'return')),
  vehicle_plate text not null,
  vehicle_plate_normalized text not null,
  vehicle_description text,
  inspection_cycle_id uuid,
  inspected_at timestamptz not null,
  device_timezone text,
  document_hash text not null check (document_hash ~ '^[0-9a-f]{64}$'),
  document_size_bytes bigint not null check (document_size_bytes between 1 and 41943040),
  document_mime_type text not null default 'application/pdf' check (document_mime_type = 'application/pdf'),
  storage_bucket text not null default 'checkvan-company-inspections',
  storage_object_path text not null unique,
  upload_status text not null default 'pending' check (upload_status in ('pending', 'uploading', 'available', 'failed', 'pending_deletion', 'deleted')),
  upload_started_at timestamptz,
  uploaded_at timestamptz,
  finalized_at timestamptz,
  upload_attempts integer not null default 0,
  last_upload_error_code text,
  document_format_version integer,
  app_version text,
  retention_expires_at timestamptz not null,
  legal_hold boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(device_id, device_generated_id),
  check ((license_id is not null) <> (entitlement_id is not null))
);
create index if not exists checkvan_inspections_org_time_idx on public.checkvan_inspections(organization_id, inspected_at desc);
create index if not exists checkvan_inspections_org_plate_idx on public.checkvan_inspections(organization_id, vehicle_plate_normalized, inspected_at desc);
create index if not exists checkvan_inspections_retention_idx on public.checkvan_inspections(retention_expires_at) where upload_status = 'available' and legal_hold = false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checkvan-company-inspections', 'checkvan-company-inspections', false, 41943040, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.checkvan_organizations enable row level security;
alter table public.checkvan_licenses enable row level security;
alter table public.checkvan_access_entitlements enable row level security;
alter table public.checkvan_license_devices enable row level security;
alter table public.checkvan_device_assignments enable row level security;
alter table public.checkvan_enrollment_tokens enable row level security;
alter table public.checkvan_device_request_nonces enable row level security;
alter table public.checkvan_inspections enable row level security;

revoke all on public.checkvan_organizations, public.checkvan_licenses, public.checkvan_access_entitlements,
  public.checkvan_license_devices, public.checkvan_device_assignments, public.checkvan_enrollment_tokens,
  public.checkvan_device_request_nonces, public.checkvan_inspections from public, anon, authenticated;
grant select, insert, update, delete on public.checkvan_organizations, public.checkvan_licenses, public.checkvan_access_entitlements,
  public.checkvan_license_devices, public.checkvan_device_assignments, public.checkvan_enrollment_tokens,
  public.checkvan_device_request_nonces, public.checkvan_inspections to service_role;


create or replace function public.admin_create_checkvan_enrollment_token(p_license_id uuid, p_expires_at timestamptz)
returns text language plpgsql security definer set search_path = '' as $$
declare v_raw text; v_org uuid;
begin
  select organization_id into v_org from public.checkvan_licenses
  where id = p_license_id and product_mode = 'company' and status = 'active' and cloud_enabled = true for update;
  if v_org is null then raise exception 'LICENSE_NOT_ELIGIBLE'; end if;
  v_raw := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  insert into public.checkvan_enrollment_tokens(license_id, organization_id, token_hash, expires_at)
  values (p_license_id, v_org, encode(extensions.digest(v_raw, 'sha256'), 'hex'), p_expires_at);
  return v_raw;
end $$;

create or replace function public.admin_create_checkvan_entitlement_enrollment_token(p_entitlement_id uuid, p_expires_at timestamptz)
returns text language plpgsql security definer set search_path = '' as $$
declare v_raw text; v_org uuid;
begin
  select organization_id into v_org from public.checkvan_access_entitlements
  where id = p_entitlement_id and product_mode = 'company' and grant_type in ('TESTER','FOUNDER') and status = 'active'
    and starts_at <= now() and (ends_at is null or ends_at > now()) for update;
  if v_org is null then raise exception 'ENTITLEMENT_NOT_ELIGIBLE'; end if;
  v_raw := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  insert into public.checkvan_enrollment_tokens(entitlement_id, organization_id, token_hash, expires_at)
  values (p_entitlement_id, v_org, encode(extensions.digest(v_raw, 'sha256'), 'hex'), p_expires_at);
  return v_raw;
end $$;

create or replace function public.consume_checkvan_enrollment_token(
  p_token text, p_key_id text, p_public_key_spki_base64 text, p_device_model text, p_app_version text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token public.checkvan_enrollment_tokens; v_device uuid; v_assignment uuid; v_capacity integer; v_active integer;
begin
  select * into v_token from public.checkvan_enrollment_tokens
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and consumed_at is null and expires_at > now() for update;
  if v_token.id is null then raise exception 'ENROLLMENT_TOKEN_INVALID'; end if;
  if length(p_key_id) < 16 or length(p_public_key_spki_base64) < 64 then raise exception 'DEVICE_KEY_INVALID'; end if;
  if v_token.license_id is not null then
    select capacity into v_capacity from public.checkvan_licenses where id = v_token.license_id and status = 'active' for update;
    select count(*) into v_active from public.checkvan_device_assignments where license_id = v_token.license_id and status = 'active';
    if v_capacity is null or v_active >= v_capacity then raise exception 'NO_DEVICE_SLOTS'; end if;
  end if;
  insert into public.checkvan_license_devices(key_id, public_key_spki_base64, device_model, app_version)
  values (p_key_id, p_public_key_spki_base64, p_device_model, p_app_version) returning id into v_device;
  insert into public.checkvan_device_assignments(license_id, entitlement_id, organization_id, device_id)
  values (v_token.license_id, v_token.entitlement_id, v_token.organization_id, v_device) returning id into v_assignment;
  update public.checkvan_enrollment_tokens set consumed_at = now() where id = v_token.id;
  return jsonb_build_object('deviceId', v_device, 'assignmentId', v_assignment, 'organizationId', v_token.organization_id, 'keyId', p_key_id);
end $$;

revoke all on function public.admin_create_checkvan_enrollment_token(uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.admin_create_checkvan_entitlement_enrollment_token(uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.consume_checkvan_enrollment_token(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.admin_create_checkvan_enrollment_token(uuid,timestamptz) to service_role;
grant execute on function public.admin_create_checkvan_entitlement_enrollment_token(uuid,timestamptz) to service_role;
grant execute on function public.consume_checkvan_enrollment_token(text,text,text,text,text) to service_role;

commit;
