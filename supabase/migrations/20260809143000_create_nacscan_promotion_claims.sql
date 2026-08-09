begin;

create table public.nacscan_promotion_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  promotion_code text not null,
  requested_at timestamptz not null default now(),
  status text not null default 'pending',
  permanent_entitlement_at timestamptz null,

  constraint nacscan_promotion_claims_user_promotion_key
    unique (user_id, promotion_code),
  constraint nacscan_promotion_claims_promotion_code_check
    check (promotion_code = 'nacscan_free_forever_2026'),
  constraint nacscan_promotion_claims_status_check
    check (status in ('pending', 'verified', 'rejected')),
  constraint nacscan_promotion_claims_entitlement_status_check
    check (permanent_entitlement_at is null or status = 'verified')
);

comment on table public.nacscan_promotion_claims is
  'Adesioni alla promozione NACScan gratis per sempre 2026.';
comment on column public.nacscan_promotion_claims.requested_at is
  'Istante di richiesta assegnato dal database; non controllabile dal client.';
comment on column public.nacscan_promotion_claims.permanent_entitlement_at is
  'Assegnato esclusivamente da futura logica amministrativa/server-side dopo la verifica.';

alter table public.nacscan_promotion_claims enable row level security;

revoke all on table public.nacscan_promotion_claims from public;
revoke all on table public.nacscan_promotion_claims from anon;
revoke all on table public.nacscan_promotion_claims from authenticated;

grant select on table public.nacscan_promotion_claims to authenticated;
grant select, insert, update, delete on table public.nacscan_promotion_claims to service_role;

create policy "nacscan_claims_select_own"
  on public.nacscan_promotion_claims
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.claim_nacscan_promotion()
returns public.nacscan_promotion_claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_promotion_code constant text := 'nacscan_free_forever_2026';
  v_requested_at timestamptz := clock_timestamp();
  v_claim public.nacscan_promotion_claims;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication required';
  end if;

  select claim.*
    into v_claim
    from public.nacscan_promotion_claims as claim
   where claim.user_id = v_user_id
     and claim.promotion_code = v_promotion_code;

  if found then
    return v_claim;
  end if;

  if v_requested_at >= timestamptz '2026-10-01 00:00:00 Europe/Rome' then
    raise exception using
      errcode = 'P0001',
      message = 'The NACScan promotion claim period has ended';
  end if;

  insert into public.nacscan_promotion_claims (
    user_id,
    promotion_code,
    requested_at,
    status,
    permanent_entitlement_at
  )
  values (
    v_user_id,
    v_promotion_code,
    v_requested_at,
    'pending',
    null
  )
  on conflict (user_id, promotion_code) do nothing
  returning * into v_claim;

  if v_claim.id is null then
    select claim.*
      into v_claim
      from public.nacscan_promotion_claims as claim
     where claim.user_id = v_user_id
       and claim.promotion_code = v_promotion_code;
  end if;

  return v_claim;
end;
$$;

comment on function public.claim_nacscan_promotion() is
  'RPC idempotente: ricava auth.uid(), imposta i dati server-side e accetta nuove adesioni fino al 30 settembre 2026 Europe/Rome incluso.';

revoke all on function public.claim_nacscan_promotion() from public;
revoke all on function public.claim_nacscan_promotion() from anon;
revoke all on function public.claim_nacscan_promotion() from authenticated;
grant execute on function public.claim_nacscan_promotion() to authenticated;

commit;
