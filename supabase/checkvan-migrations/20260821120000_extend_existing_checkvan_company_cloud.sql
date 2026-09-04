-- Target project: Driver Utility / CheckVan (xlsrikqeqxwgzjakgmhz).
-- Incremental migration prepared from read-only remote-schema introspection on 2026-08-21.
-- DO NOT APPLY until reviewed. The Storage bucket is provisioned separately through the Storage API.

begin;

alter table public.checkvan_organizations
  add column slug text,
  add column organization_type text not null default 'customer',
  add column retention_days integer not null default 730;

alter table public.checkvan_organizations
  add constraint checkvan_organizations_slug_check check (slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint checkvan_organizations_type_check check (organization_type in ('customer','internal_test','internal_founder')),
  add constraint checkvan_organizations_retention_check check (retention_days between 30 and 3650);

create unique index checkvan_organizations_slug_uidx on public.checkvan_organizations(slug) where slug is not null;

insert into public.checkvan_organizations(name,slug,organization_type,status)
values ('DTO Solution - Founder','dto-founder','internal_founder','active'),
       ('DTO Solution - Tester','dto-tester','internal_test','active');

alter table public.checkvan_licenses
  add column product_mode text not null default 'company',
  add column cloud_enabled boolean not null default true,
  add column access_grant text;

update public.checkvan_licenses
set access_grant = case when kind='trial' then 'TRIAL' else 'PAID' end
where access_grant is null;

alter table public.checkvan_licenses
  alter column access_grant set not null,
  add constraint checkvan_licenses_product_mode_check check (product_mode in ('company','personal')),
  add constraint checkvan_licenses_access_grant_check check (access_grant in ('PAID','TRIAL','TESTER')),
  add constraint checkvan_licenses_trial_grant_check check ((kind='trial') = (access_grant='TRIAL')),
  add constraint checkvan_licenses_public_personal_disabled_check check (product_mode='company' or cloud_enabled=false);

insert into public.checkvan_licenses(organization_id,kind,status,capacity,starts_at,product_mode,cloud_enabled,access_grant)
select id,'commercial','active',100,now(),'company',true,'TESTER'
from public.checkvan_organizations where slug='dto-tester';

create unique index checkvan_licenses_internal_tester_uidx
  on public.checkvan_licenses(organization_id,access_grant)
  where access_grant='TESTER' and status='active';

alter table public.checkvan_founder_entitlements
  add column organization_id uuid references public.checkvan_organizations(id) on delete restrict,
  add column auth_subject uuid,
  add column product_mode text not null default 'company',
  add column device_capacity integer not null default 1,
  add column starts_at timestamptz not null default now(),
  add column ends_at timestamptz;

update public.checkvan_founder_entitlements
set organization_id=(select id from public.checkvan_organizations where slug='dto-founder')
where organization_id is null;

alter table public.checkvan_founder_entitlements
  alter column organization_id set not null,
  add constraint checkvan_founder_product_mode_check check (product_mode='company'),
  add constraint checkvan_founder_capacity_check check (device_capacity=1),
  add constraint checkvan_founder_dates_check check (ends_at is null or ends_at>starts_at);

create unique index checkvan_founder_auth_subject_uidx
  on public.checkvan_founder_entitlements(auth_subject) where auth_subject is not null and status='active';
create index checkvan_founder_organization_idx on public.checkvan_founder_entitlements(organization_id) where status='active';

create function public.checkvan_default_founder_organization()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.organization_id is null then
    select id into new.organization_id from public.checkvan_organizations where slug='dto-founder';
  end if;
  return new;
end $$;

create trigger checkvan_founder_default_organization
before insert on public.checkvan_founder_entitlements
for each row execute function public.checkvan_default_founder_organization();

create table public.checkvan_device_request_nonces (
  device_id uuid not null references public.checkvan_license_devices(id) on delete cascade,
  request_id uuid not null,
  requested_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key(device_id,request_id)
);
create index checkvan_device_nonces_created_idx on public.checkvan_device_request_nonces(created_at);

create table public.checkvan_inspections (
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
  document_mime_type text not null default 'application/pdf' check (document_mime_type='application/pdf'),
  storage_bucket text not null default 'checkvan-company-inspections',
  storage_object_path text not null unique,
  upload_status text not null default 'pending' check (upload_status in ('pending','uploading','available','failed','pending_deletion','deleted')),
  upload_started_at timestamptz,
  uploaded_at timestamptz,
  finalized_at timestamptz,
  upload_attempts integer not null default 0 check (upload_attempts>=0),
  last_upload_error_code text,
  document_format_version integer,
  app_version text,
  retention_expires_at timestamptz not null,
  legal_hold boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(device_id,device_generated_id),
  constraint checkvan_inspections_entitlement_check check ((license_id is not null) <> (founder_entitlement_id is not null)),
  constraint checkvan_inspections_assignment_check check ((license_id is null and device_assignment_id is null) or (license_id is not null and device_assignment_id is not null))
);

create index checkvan_inspections_org_time_idx on public.checkvan_inspections(organization_id,inspected_at desc);
create index checkvan_inspections_org_plate_idx on public.checkvan_inspections(organization_id,vehicle_plate_normalized,inspected_at desc);
create index checkvan_inspections_retention_idx on public.checkvan_inspections(retention_expires_at) where upload_status='available' and legal_hold=false;
create index checkvan_document_certifications_key_id_idx on public.checkvan_document_certifications(key_id);
create index checkvan_device_assignments_replaced_by_idx on public.checkvan_device_assignments(replaced_by_device_id) where replaced_by_device_id is not null;
create index checkvan_enrollment_tokens_license_idx on public.checkvan_enrollment_tokens(license_id);
create index checkvan_enrollment_tokens_used_device_idx on public.checkvan_enrollment_tokens(used_by_device_id) where used_by_device_id is not null;
create index checkvan_license_audit_organization_idx on public.checkvan_license_audit(organization_id) where organization_id is not null;
create index checkvan_license_audit_license_idx on public.checkvan_license_audit(license_id) where license_id is not null;
create index checkvan_license_audit_device_idx on public.checkvan_license_audit(device_id) where device_id is not null;
create index checkvan_license_challenges_used_device_idx on public.checkvan_license_challenges(used_by_device_id) where used_by_device_id is not null;

alter table public.checkvan_device_request_nonces enable row level security;
alter table public.checkvan_inspections enable row level security;
revoke all on public.checkvan_device_request_nonces,public.checkvan_inspections from public,anon,authenticated;
grant select,insert,update,delete on public.checkvan_device_request_nonces,public.checkvan_inspections to service_role;
grant select,insert,update,delete on public.checkvan_organizations,public.checkvan_licenses,public.checkvan_founder_entitlements to service_role;

revoke all on function public.checkvan_default_founder_organization() from public,anon,authenticated;

commit;

-- Separate provisioning step, through Supabase Storage API (not SQL):
-- private bucket: checkvan-company-inspections
-- file_size_limit: 41943040
-- allowed_mime_types: application/pdf
