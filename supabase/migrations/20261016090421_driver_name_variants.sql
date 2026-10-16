-- Confirmed aliases only: no source document, filename, hash, coordinates or import rows are stored here.
create table public.checkvan_driver_name_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  driver_id uuid not null,
  source text not null check (source in ('convocation', 'assignment_departure')),
  normalized_name text not null check (
    length(normalized_name) between 1 and 300
    and normalized_name = regexp_replace(upper(trim(normalized_name)), '\\s+', ' ', 'g')
    and normalized_name ~ '^[A-Z0-9]+( [A-Z0-9]+)*$'
  ),
  confirmed_by uuid not null,
  confirmed_at timestamptz not null default now(),
  revoked_by uuid,
  revoked_at timestamptz,
  revocation_reason text,
  constraint checkvan_driver_name_variant_driver_org_fk foreign key (organization_id, driver_id)
    references public.checkvan_drivers(organization_id, id) on delete restrict,
  check ((revoked_at is null and revoked_by is null and revocation_reason is null)
      or (revoked_at is not null and revoked_by is not null and length(trim(revocation_reason)) between 1 and 1000))
);
create unique index checkvan_driver_name_variant_source_active_uidx
  on public.checkvan_driver_name_variants(organization_id, driver_id, source, normalized_name)
  where revoked_at is null;
create index checkvan_driver_name_variant_lookup_idx
  on public.checkvan_driver_name_variants(organization_id, source, normalized_name)
  where revoked_at is null;
create extension if not exists btree_gist;
alter table public.checkvan_driver_name_variants add constraint checkvan_driver_name_variant_driver_conflict
  exclude using gist (organization_id with =, normalized_name with =, driver_id with <>)
  where (revoked_at is null);

create function public.internal_check_driver_name_variant_driver()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.revoked_at is null and exists (
    select 1 from public.checkvan_driver_name_variants existing
    where existing.organization_id = new.organization_id
      and existing.normalized_name = new.normalized_name
      and existing.revoked_at is null
      and existing.driver_id <> new.driver_id
      and existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception using errcode = '23505', message = 'DRIVER_NAME_VARIANT_CONFLICT';
  end if;
  return new;
end $$;
create trigger checkvan_driver_name_variants_consistent_driver
  before insert or update of organization_id, driver_id, normalized_name, revoked_at
  on public.checkvan_driver_name_variants
  for each row execute function public.internal_check_driver_name_variant_driver();

alter table public.checkvan_driver_name_variants enable row level security;
revoke all on public.checkvan_driver_name_variants from public, anon, authenticated;
grant select, insert, update, delete on public.checkvan_driver_name_variants to service_role;

create function public.internal_admin_confirm_driver_name_variant(p_auth_subject uuid, p_organization_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_driver_id uuid := (p_input->>'driver_id')::uuid;
  v_source text := p_input->>'source';
  v_name text := p_input->>'normalized_name';
  v_existing public.checkvan_driver_name_variants%rowtype;
  v_created public.checkvan_driver_name_variants%rowtype;
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject = p_auth_subject and organization_id = p_organization_id and role = 'COMPANY_ADMIN' and status = 'active') then
    raise exception using errcode = '42501', message = 'COMPANY_ADMIN_REQUIRED';
  end if;
  if v_driver_id is null or v_source not in ('convocation', 'assignment_departure') or v_name is null or length(v_name) > 300 or v_name <> regexp_replace(upper(trim(v_name)), '\\s+', ' ', 'g') or v_name !~ '^[A-Z0-9]+( [A-Z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'INVALID_DRIVER_NAME_VARIANT';
  end if;
  if not exists(select 1 from public.checkvan_drivers where id = v_driver_id and organization_id = p_organization_id) then
    raise exception using errcode = '22023', message = 'DRIVER_NAME_VARIANT_DRIVER_NOT_FOUND';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text || v_name, 49));
  select * into v_existing from public.checkvan_driver_name_variants
    where organization_id = p_organization_id and normalized_name = v_name and revoked_at is null
    limit 1 for update;
  if found and v_existing.driver_id <> v_driver_id then
    raise exception using errcode = '23505', message = 'DRIVER_NAME_VARIANT_CONFLICT';
  end if;
  select * into v_existing from public.checkvan_driver_name_variants
    where organization_id = p_organization_id and driver_id = v_driver_id and source = v_source and normalized_name = v_name and revoked_at is null
    limit 1 for update;
  if found then return jsonb_build_object('idempotent', true, 'variant', to_jsonb(v_existing)); end if;
  insert into public.checkvan_driver_name_variants(organization_id, driver_id, source, normalized_name, confirmed_by)
    values(p_organization_id, v_driver_id, v_source, v_name, p_auth_subject)
    returning * into v_created;
  return jsonb_build_object('idempotent', false, 'variant', to_jsonb(v_created));
end $$;

create function public.internal_admin_revoke_driver_name_variant(p_auth_subject uuid, p_organization_id uuid, p_variant_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_variant public.checkvan_driver_name_variants%rowtype; v_reason text := nullif(trim(p_reason), '');
begin
  if not exists(select 1 from public.checkvan_area_memberships where auth_subject = p_auth_subject and organization_id = p_organization_id and role = 'COMPANY_ADMIN' and status = 'active') then
    raise exception using errcode = '42501', message = 'COMPANY_ADMIN_REQUIRED';
  end if;
  if p_variant_id is null or v_reason is null or length(v_reason) > 1000 then raise exception using errcode = '22023', message = 'INVALID_DRIVER_NAME_VARIANT_REVOCATION'; end if;
  select * into v_variant from public.checkvan_driver_name_variants where id = p_variant_id and organization_id = p_organization_id and revoked_at is null for update;
  if not found then raise exception using errcode = '22023', message = 'DRIVER_NAME_VARIANT_NOT_FOUND'; end if;
  update public.checkvan_driver_name_variants set revoked_at = now(), revoked_by = p_auth_subject, revocation_reason = v_reason where id = v_variant.id returning * into v_variant;
  return to_jsonb(v_variant);
end $$;

revoke all on function public.internal_check_driver_name_variant_driver(), public.internal_admin_confirm_driver_name_variant(uuid,uuid,jsonb), public.internal_admin_revoke_driver_name_variant(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.internal_admin_confirm_driver_name_variant(uuid,uuid,jsonb), public.internal_admin_revoke_driver_name_variant(uuid,uuid,uuid,text) to service_role;
