create table public.checkvan_vehicle_reports (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.checkvan_organizations(id) on delete restrict,
  vehicle_id uuid not null references public.checkvan_vehicles(id) on delete restrict, reporter_device_id uuid references public.checkvan_license_devices(id) on delete set null,
  driver_id uuid references public.checkvan_drivers(id) on delete set null, client_generated_id uuid not null,
  report_type text not null check (report_type in ('TIRE_LOW_PRESSURE','TIRE_WORN','TIRE_DAMAGE','BRAKES','ENGINE_OIL','ADBLUE','COOLANT','LIGHT','WIPERS','WASHER_FLUID','MIRROR','DOOR_LOCK','BATTERY_STARTING','WARNING_LIGHT','NOISE_ANOMALY','OTHER')),
  description text, status text not null default 'OPEN' check (status in ('OPEN','RESOLVED')), reported_at timestamptz not null default now(),
  resolved_at timestamptz, resolved_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint checkvan_vehicle_reports_other_description check (report_type <> 'OTHER' or length(btrim(description)) between 1 and 1000),
  constraint checkvan_vehicle_reports_description_length check (description is null or length(description) <= 1000),
  constraint checkvan_vehicle_reports_resolution check ((status='OPEN' and resolved_at is null and resolved_by is null) or (status='RESOLVED' and resolved_at is not null and resolved_by is not null)),
  unique (reporter_device_id, client_generated_id)
);
create index checkvan_vehicle_reports_vehicle_idx on public.checkvan_vehicle_reports (organization_id, vehicle_id, reported_at desc);
create index checkvan_vehicle_reports_device_idx on public.checkvan_vehicle_reports (reporter_device_id) where reporter_device_id is not null;
create index checkvan_vehicle_reports_driver_idx on public.checkvan_vehicle_reports (driver_id) where driver_id is not null;
create unique index checkvan_vehicle_reports_open_type_uidx on public.checkvan_vehicle_reports (organization_id, vehicle_id, report_type) where status='OPEN' and report_type<>'OTHER';
create unique index checkvan_vehicle_reports_open_other_uidx on public.checkvan_vehicle_reports (organization_id, vehicle_id, lower(btrim(description))) where status='OPEN' and report_type='OTHER';
alter table public.checkvan_vehicle_reports enable row level security;
revoke all on public.checkvan_vehicle_reports from public, anon, authenticated;
grant select, insert, update on public.checkvan_vehicle_reports to service_role;
