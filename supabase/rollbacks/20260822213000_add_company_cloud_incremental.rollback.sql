-- Safe only before Company Cloud receives production data. Every destructive
-- operation is preceded by a guard; any failed guard rolls the transaction back.

begin;

do $$
begin
  if exists (select 1 from public.checkvan_inspections limit 1)
     or exists (select 1 from public.checkvan_device_request_nonces limit 1) then
    raise exception 'Rollback refused: Company Cloud tables contain data';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'checkvan-company-inspections' limit 1) then
    raise exception 'Rollback refused: Company Cloud bucket contains objects';
  end if;
  if exists (select 1 from public.checkvan_organizations where slug is not null or organization_type is distinct from 'customer' or retention_days is distinct from 730 limit 1) then
    raise exception 'Rollback refused: Company Cloud organization attributes are in use';
  end if;
  if exists (select 1 from public.checkvan_licenses where product_mode is not null or cloud_enabled is not null or access_grant is not null limit 1) then
    raise exception 'Rollback refused: Company Cloud license attributes are in use';
  end if;
  if exists (select 1 from public.checkvan_founder_entitlements where organization_id is not null or auth_subject is not null or device_capacity is distinct from 1 or starts_at is not null or ends_at is not null limit 1) then
    raise exception 'Rollback refused: Company Cloud Founder attributes are in use';
  end if;
end
$$;

-- Supabase protects storage catalog rows from direct SQL deletion. The empty,
-- private bucket is intentionally retained; remove it through the Storage API
-- only after this guarded rollback has succeeded.

drop table public.checkvan_inspections;
drop table public.checkvan_device_request_nonces;

drop index if exists public.checkvan_document_certifications_key_id_idx;
drop index if exists public.checkvan_device_assignments_replaced_by_idx;
drop index if exists public.checkvan_enrollment_tokens_license_idx;
drop index if exists public.checkvan_enrollment_tokens_used_device_idx;
drop index if exists public.checkvan_license_audit_organization_idx;
drop index if exists public.checkvan_license_audit_license_idx;
drop index if exists public.checkvan_license_audit_device_idx;
drop index if exists public.checkvan_license_challenges_used_device_idx;

alter table public.checkvan_founder_entitlements
  drop column ends_at,
  drop column starts_at,
  drop column device_capacity,
  drop column auth_subject,
  drop column organization_id;

alter table public.checkvan_licenses
  drop column access_grant,
  drop column cloud_enabled,
  drop column product_mode;

alter table public.checkvan_organizations
  drop column retention_days,
  drop column organization_type,
  drop column slug;

commit;
