-- Isolated PostgreSQL fixture only; it is not a production migration.
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $$;
create table public.checkvan_organizations (id uuid primary key default gen_random_uuid(), name text not null);
create table public.checkvan_area_memberships (auth_subject uuid not null, organization_id uuid not null references public.checkvan_organizations(id), role text not null, status text not null);
create table public.checkvan_vehicles (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.checkvan_organizations(id),
  internal_code text not null, plate text not null, plate_normalized text not null, silhouette_category text not null, status text not null default 'active', unique (organization_id,id)
);
create table public.checkvan_inspections (id uuid primary key default gen_random_uuid(), inspected_at timestamptz not null default now());
