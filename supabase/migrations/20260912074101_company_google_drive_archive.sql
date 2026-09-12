begin;

create table public.checkvan_cloud_connections (
  organization_id uuid primary key references public.checkvan_organizations(id) on delete cascade,
  provider text not null check (provider in ('google_drive')),
  status text not null default 'active' check (status in ('active', 'reauthorization_required')),
  root_folder_id text not null,
  root_folder_name text not null,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  token_iv text not null,
  token_expires_at timestamptz,
  provider_account_email text,
  backup_enabled boolean not null default true,
  backup_pickup boolean not null default true,
  backup_return boolean not null default true,
  include_history boolean not null default false,
  last_verified_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.checkvan_cloud_oauth_states (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  organization_id uuid not null references public.checkvan_organizations(id) on delete cascade,
  auth_subject uuid not null,
  include_history boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.checkvan_cloud_document_syncs (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.checkvan_organizations(id) on delete cascade,
  provider text not null check (provider in ('google_drive')),
  inspection_id uuid not null references public.checkvan_inspections(id) on delete cascade,
  remote_file_id text,
  remote_path text,
  status text not null default 'PENDING' check (status in ('PENDING', 'SYNCED', 'FAILED')),
  last_error_code text,
  last_attempt_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, inspection_id)
);

create index checkvan_cloud_syncs_org_status_idx
  on public.checkvan_cloud_document_syncs(organization_id, status, updated_at desc);
create index checkvan_cloud_oauth_states_expiry_idx
  on public.checkvan_cloud_oauth_states(expires_at);

alter table public.checkvan_cloud_connections enable row level security;
alter table public.checkvan_cloud_oauth_states enable row level security;
alter table public.checkvan_cloud_document_syncs enable row level security;
revoke all on public.checkvan_cloud_connections, public.checkvan_cloud_oauth_states, public.checkvan_cloud_document_syncs from public, anon, authenticated;
grant select, insert, update, delete on public.checkvan_cloud_connections, public.checkvan_cloud_oauth_states, public.checkvan_cloud_document_syncs to service_role;

commit;
