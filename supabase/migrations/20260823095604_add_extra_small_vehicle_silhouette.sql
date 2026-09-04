alter table public.checkvan_vehicles
  drop constraint if exists checkvan_vehicles_silhouette_category_check;

alter table public.checkvan_vehicles
  add constraint checkvan_vehicles_silhouette_category_check
  check (silhouette_category in ('EXTRA_SMALL','SMALL','MEDIUM','LARGE')) not valid;

alter table public.checkvan_vehicles
  validate constraint checkvan_vehicles_silhouette_category_check;
