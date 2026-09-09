create table public.checkvan_driver_access_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  driver_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid not null,
  constraint checkvan_driver_access_token_driver_fk foreign key (organization_id,driver_id) references public.checkvan_drivers(organization_id,id) on delete restrict,
  check ((status='active' and revoked_at is null) or (status='revoked' and revoked_at is not null))
);
create unique index checkvan_driver_access_tokens_active_driver_uidx on public.checkvan_driver_access_tokens(organization_id,driver_id) where status='active';
create index checkvan_driver_access_tokens_lookup_idx on public.checkvan_driver_access_tokens(token_hash) where status='active';

create table public.checkvan_driver_access_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  driver_id uuid not null,
  session_hash text not null unique check (session_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint checkvan_driver_access_session_driver_fk foreign key (organization_id,driver_id) references public.checkvan_drivers(organization_id,id) on delete restrict
);
create index checkvan_driver_access_sessions_lookup_idx on public.checkvan_driver_access_sessions(session_hash,expires_at);

alter table public.checkvan_driver_access_tokens enable row level security;
alter table public.checkvan_driver_access_sessions enable row level security;
revoke all on public.checkvan_driver_access_tokens,public.checkvan_driver_access_sessions from public,anon,authenticated;
grant select,insert,update,delete on public.checkvan_driver_access_tokens,public.checkvan_driver_access_sessions to service_role;
