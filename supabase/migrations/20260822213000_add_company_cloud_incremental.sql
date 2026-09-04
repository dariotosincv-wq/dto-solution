-- Target: CheckVan production project xlsrikqeqxwgzjakgmhz.
-- Incremental Company Cloud migration derived from read-only catalog inspection.
-- It deliberately performs no DML on existing organizations, licenses, Founder
-- entitlements, memberships, enrollment tokens, devices, or audit records.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'public.checkvan_organizations',
    'public.checkvan_licenses',
    'public.checkvan_founder_entitlements',
    'public.checkvan_license_devices',
    'public.checkvan_device_assignments',
    'public.checkvan_document_certifications',
    'public.checkvan_enrollment_tokens',
    'public.checkvan_license_audit',
    'public.checkvan_license_challenges'
  ] loop
    if to_regclass(dependency) is null then
      raise exception 'Company Cloud prerequisite is missing: %', dependency;
    end if;
  end loop;
end
$$;

alter table public.checkvan_organizations
  add column if not exists slug text,
  add column if not exists organization_type text default 'customer',
  add column if not exists retention_days integer default 730;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.checkvan_organizations'::regclass and conname = 'checkvan_organizations_slug_check') then
    alter table public.checkvan_organizations add constraint checkvan_organizations_slug_check check (slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.checkvan_organizations'::regclass and conname = 'checkvan_organizations_type_check') then
    alter table public.checkvan_organizations add constraint checkvan_organizations_type_check check (organization_type is null or organization_type in ('customer','internal_test','internal_founder'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.checkvan_organizations'::regclass and conname = 'checkvan_organizations_retention_check') then
    alter table public.checkvan_organizations add constraint checkvan_organizations_retention_check check (retention_days is null or retention_days between 30 and 3650);
  end if;
end
$$;

create unique index if not exists checkvan_organizations_slug_uidx
  on public.checkvan_organizations(slug) where slug is not null;

alter table public.checkvan_licenses
  add column if not exists product_mode text,
  add column if not exists cloud_enabled boolean,
  add column if not exists access_grant text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.checkvan_licenses'::regclass and conname = 'checkvan_licenses_product_mode_check') then
    alter table public.checkvan_licenses add constraint checkvan_licenses_product_mode_check check (product_mode is null or product_mode in ('company','personal'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.checkvan_licenses'::regclass and conname = 'checkvan_licenses_access_grant_check') then
    alter table public.checkvan_licenses add constraint checkvan_licenses_access_grant_check check (access_grant is null or access_grant in ('PAID','TRIAL','TESTER'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.checkvan_licenses'::regclass and conname = 'checkvan_licenses_trial_grant_check') then
    alter table public.checkvan_licenses add constraint checkvan_licenses_trial_grant_check check (access_grant is null or ((kind = 'trial') = (access_grant = 'TRIAL')));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.checkvan_licenses'::regclass and conname = 'checkvan_licenses_public_personal_disabled_check') then
    alter table public.checkvan_licenses add constraint checkvan_licenses_public_personal_disabled_check check (product_mode is null or product_mode = 'company' or coalesce(cloud_enabled, false) = false);
  end if;
end
$$;

alter table public.checkvan_founder_entitlements
  add column if not exists organization_id uuid references public.checkvan_organizations(id) on delete restrict,
  add column if not exists auth_subject uuid,
  add column if not exists device_capacity integer default 1,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.checkvan_founder_entitlements'::regclass and conname = 'checkvan_founder_capacity_check') then
    alter table public.checkvan_founder_entitlements add constraint checkvan_founder_capacity_check check (device_capacity is null or device_capacity between 1 and 1000);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.checkvan_founder_entitlements'::regclass and conname = 'checkvan_founder_dates_check') then
    alter table public.checkvan_founder_entitlements add constraint checkvan_founder_dates_check check (ends_at is null or starts_at is null or ends_at > starts_at);
  end if;
end
$$;

create unique index if not exists checkvan_founder_auth_subject_uidx
  on public.checkvan_founder_entitlements(auth_subject)
  where auth_subject is not null and status = 'active';
create index if not exists checkvan_founder_organization_idx
  on public.checkvan_founder_entitlements(organization_id)
  where organization_id is not null and status = 'active';

create table if not exists public.checkvan_device_request_nonces (
  device_id uuid not null references public.checkvan_license_devices(id) on delete cascade,
  request_id uuid not null,
  requested_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (device_id, request_id)
);

create index if not exists checkvan_device_nonces_created_idx
  on public.checkvan_device_request_nonces(created_at);

create table if not exists public.checkvan_inspections (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  license_id uuid references public.checkvan_licenses(id) on delete restrict,
  founder_entitlement_id uuid references public.checkvan_founder_entitlements(id) on delete restrict,
  device_id uuid not null references public.checkvan_license_devices(id) on delete restrict,
  device_assignment_id uuid references public.checkvan_device_assignments(id) on delete restrict,
  device_generated_id uuid not null,
  inspection_type text not null check (inspection_type in ('pickup','return')),
  vehicle_plate text not null,
  vehicle_plate_normalized text not null,
  vehicle_description text,
  inspection_cycle_id uuid,
  inspected_at timestamptz not null,
  device_timezone text,
  document_hash text not null check (document_hash ~ '^[a-f0-9]{64}$'),
  document_size_bytes bigint not null check (document_size_bytes between 1 and 41943040),
  document_mime_type text not null default 'application/pdf' check (document_mime_type = 'application/pdf'),
  storage_bucket text not null default 'checkvan-company-inspections',
  storage_object_path text not null unique,
  upload_status text not null default 'pending' check (upload_status in ('pending','uploading','available','failed','pending_deletion','deleted')),
  upload_started_at timestamptz,
  uploaded_at timestamptz,
  finalized_at timestamptz,
  upload_attempts integer not null default 0 check (upload_attempts >= 0),
  last_upload_error_code text,
  document_format_version integer,
  app_version text,
  retention_expires_at timestamptz not null,
  legal_hold boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, device_generated_id),
  constraint checkvan_inspections_entitlement_check check ((license_id is not null) <> (founder_entitlement_id is not null)),
  constraint checkvan_inspections_assignment_check check ((license_id is null and device_assignment_id is null) or (license_id is not null and device_assignment_id is not null))
);

create index if not exists checkvan_inspections_org_time_idx on public.checkvan_inspections(organization_id, inspected_at desc);
create index if not exists checkvan_inspections_org_plate_idx on public.checkvan_inspections(organization_id, vehicle_plate_normalized, inspected_at desc);
create index if not exists checkvan_inspections_retention_idx on public.checkvan_inspections(retention_expires_at) where upload_status = 'available' and legal_hold = false;
create index if not exists checkvan_document_certifications_key_id_idx on public.checkvan_document_certifications(key_id);
create index if not exists checkvan_device_assignments_replaced_by_idx on public.checkvan_device_assignments(replaced_by_device_id) where replaced_by_device_id is not null;
create index if not exists checkvan_enrollment_tokens_license_idx on public.checkvan_enrollment_tokens(license_id);
create index if not exists checkvan_enrollment_tokens_used_device_idx on public.checkvan_enrollment_tokens(used_by_device_id) where used_by_device_id is not null;
create index if not exists checkvan_license_audit_organization_idx on public.checkvan_license_audit(organization_id) where organization_id is not null;
create index if not exists checkvan_license_audit_license_idx on public.checkvan_license_audit(license_id) where license_id is not null;
create index if not exists checkvan_license_audit_device_idx on public.checkvan_license_audit(device_id) where device_id is not null;
create index if not exists checkvan_license_challenges_used_device_idx on public.checkvan_license_challenges(used_by_device_id) where used_by_device_id is not null;

alter table public.checkvan_device_request_nonces enable row level security;
alter table public.checkvan_inspections enable row level security;
revoke all on public.checkvan_device_request_nonces, public.checkvan_inspections from public, anon, authenticated;
grant select, insert, update, delete on public.checkvan_device_request_nonces, public.checkvan_inspections to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'checkvan-company-inspections', 'checkvan-company-inspections', false, 41943040, array['application/pdf']::text[]
where not exists (select 1 from storage.buckets where id = 'checkvan-company-inspections');

do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'checkvan-company-inspections'
      and public is false
      and file_size_limit = 41943040
      and allowed_mime_types = array['application/pdf']::text[]
  ) then
    raise exception 'Existing CheckVan inspection bucket is not private or has an unexpected configuration';
  end if;
end
$$;

commit;
