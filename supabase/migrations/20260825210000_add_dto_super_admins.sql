begin;

create table public.dto_super_admins (
  auth_subject uuid primary key,
  status text not null default 'active' check (status in ('active', 'disabled')),
  display_name text check (display_name is null or char_length(btrim(display_name)) between 2 and 120),
  require_mfa boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dto_super_admins enable row level security;
revoke all on table public.dto_super_admins from public, anon, authenticated;
grant select, insert, update, delete on table public.dto_super_admins to service_role;

create index dto_super_admins_active_idx on public.dto_super_admins(auth_subject) where status = 'active';

commit;
