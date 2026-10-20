-- A CheckVan device is not a driver identity.  This table records a short lived,
-- opaque proof created only after the server has validated a personal QR token.
create table public.checkvan_device_driver_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  driver_id uuid not null,
  device_id uuid not null references public.checkvan_license_devices(id) on delete restrict,
  access_token_id uuid not null references public.checkvan_driver_access_tokens(id) on delete restrict,
  session_hash text not null unique check (session_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint checkvan_device_driver_session_driver_fk foreign key (organization_id, driver_id)
    references public.checkvan_drivers(organization_id, id) on delete restrict,
  check (expires_at > created_at)
);

create index checkvan_device_driver_sessions_lookup_idx
  on public.checkvan_device_driver_sessions(session_hash, expires_at)
  where revoked_at is null;
create index checkvan_device_driver_sessions_device_driver_idx
  on public.checkvan_device_driver_sessions(device_id, driver_id, expires_at)
  where revoked_at is null;

alter table public.checkvan_device_driver_sessions enable row level security;
revoke all on public.checkvan_device_driver_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.checkvan_device_driver_sessions to service_role;
