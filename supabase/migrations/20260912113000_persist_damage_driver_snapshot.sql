alter table public.checkvan_vehicle_damages
  add column if not exists driver_id uuid,
  add column if not exists driver_first_name text,
  add column if not exists driver_last_name text,
  add column if not exists assignment_date date;

alter table public.checkvan_vehicle_damages
  add constraint checkvan_vehicle_damages_driver_snapshot_check
  check (
    (driver_id is null and driver_first_name is null and driver_last_name is null and assignment_date is null)
    or (
      driver_id is not null
      and length(btrim(driver_first_name)) between 1 and 100
      and length(btrim(driver_last_name)) between 1 and 100
      and assignment_date is not null
    )
  ) not valid;

alter table public.checkvan_vehicle_damages
  validate constraint checkvan_vehicle_damages_driver_snapshot_check;

alter table public.checkvan_vehicle_damages
  add constraint checkvan_vehicle_damages_driver_snapshot_fk
  foreign key (organization_id, driver_id)
  references public.checkvan_drivers(organization_id, id);
