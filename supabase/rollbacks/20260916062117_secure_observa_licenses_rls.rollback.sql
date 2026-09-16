-- Manual rollback only. Applying this restores the insecure pre-fix exposure
-- and must be approved as an emergency rollback.
begin;

alter table public.licenses disable row level security;
grant all privileges on table public.licenses to anon;
grant all privileges on table public.licenses to authenticated;

commit;
