-- Target project: Driver Utility / CheckVan (xlsrikqeqxwgzjakgmhz).
-- Local review artifact only: do not apply before approval.

begin;

create table public.checkvan_area_memberships (
  id uuid primary key default gen_random_uuid(),
  auth_subject uuid not null,
  organization_id uuid null references public.checkvan_organizations(id) on delete restrict,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checkvan_area_memberships_auth_subject_unique unique (auth_subject),
  constraint checkvan_area_memberships_role_check check (role in ('COMPANY_ADMIN', 'COMPANY_OPERATOR', 'UNION_GUEST')),
  constraint checkvan_area_memberships_status_check check (status in ('active', 'revoked')),
  constraint checkvan_area_memberships_organization_check check (role = 'UNION_GUEST' or organization_id is not null)
);

comment on table public.checkvan_area_memberships is 'Server-only bridge from the DTO Solution Auth subject to CheckVan organizations.';
comment on column public.checkvan_area_memberships.auth_subject is 'UUID sub claim issued by the separate DTO Solution Supabase Auth project; intentionally has no auth.users foreign key.';

create index checkvan_area_memberships_organization_id_idx on public.checkvan_area_memberships (organization_id) where status = 'active';

alter table public.checkvan_area_memberships enable row level security;
revoke all on table public.checkvan_area_memberships from public, anon, authenticated;
grant select, insert, update, delete on table public.checkvan_area_memberships to service_role;

commit;
