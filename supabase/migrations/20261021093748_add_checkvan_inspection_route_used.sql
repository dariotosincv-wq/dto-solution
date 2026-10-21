-- Snapshot della rotta effettivamente usata nell'ispezione CheckVan.
-- Non aggiorna mai la pianificazione operativa o l'assegnazione del mezzo.
alter table public.checkvan_inspections
  add column if not exists route_used text;

alter table public.checkvan_inspections
  add constraint checkvan_inspections_route_used_check
  check (route_used is null or char_length(btrim(route_used)) between 1 and 100);

comment on column public.checkvan_inspections.route_used is
  'Snapshot della rotta effettivamente utilizzata dal driver nell ispezione; separata dalla pianificazione.';
