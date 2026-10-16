-- Run inside a transaction after driver-directory prerequisites and the variant migration.
insert into public.checkvan_organizations(id,name) values ('72000000-0000-4000-8000-000000000001','Varianti fittizie A'),('72000000-0000-4000-8000-000000000002','Varianti fittizie B');
insert into public.checkvan_area_memberships(auth_subject,organization_id,role,status) values ('72000000-0000-4000-8000-000000000010','72000000-0000-4000-8000-000000000001','COMPANY_ADMIN','active');
insert into public.checkvan_drivers(id,organization_id,first_name,last_name) values ('72000000-0000-4000-8000-000000000020','72000000-0000-4000-8000-000000000001','Nome','Fittizio'),('72000000-0000-4000-8000-000000000021','72000000-0000-4000-8000-000000000001','Altro','Fittizio'),('72000000-0000-4000-8000-000000000022','72000000-0000-4000-8000-000000000002','Nome','Separato');
set local role service_role;
do $$
declare
  actor uuid := '72000000-0000-4000-8000-000000000010'; org_a uuid := '72000000-0000-4000-8000-000000000001'; org_b uuid := '72000000-0000-4000-8000-000000000002'; driver_a uuid := '72000000-0000-4000-8000-000000000020'; driver_other uuid := '72000000-0000-4000-8000-000000000021'; driver_b uuid := '72000000-0000-4000-8000-000000000022'; result jsonb; variant_id uuid; failed boolean;
begin
  result := public.internal_admin_confirm_driver_name_variant(actor,org_a,jsonb_build_object('driver_id',driver_a,'source','convocation','normalized_name','NOME FITTIZIO'));
  assert result->>'idempotent'='false','first confirmed variant';
  variant_id := (result->'variant'->>'id')::uuid;
  assert result->'variant'->>'confirmed_by'=actor::text and result->'variant'->>'confirmed_at' is not null,'confirmation audit';
  result := public.internal_admin_confirm_driver_name_variant(actor,org_a,jsonb_build_object('driver_id',driver_a,'source','convocation','normalized_name','NOME FITTIZIO'));
  assert result->>'idempotent'='true','same source idempotent';
  result := public.internal_admin_confirm_driver_name_variant(actor,org_a,jsonb_build_object('driver_id',driver_a,'source','assignment_departure','normalized_name','NOME FITTIZIO ESTESO'));
  assert result->>'idempotent'='false','source is independently confirmed';
  failed:=false; begin perform public.internal_admin_confirm_driver_name_variant(actor,org_a,jsonb_build_object('driver_id',driver_other,'source','assignment_departure','normalized_name','NOME FITTIZIO')); exception when others then failed:=SQLERRM='DRIVER_NAME_VARIANT_CONFLICT'; end; assert failed,'same organization key cannot map to another driver';
  result := public.internal_admin_revoke_driver_name_variant(actor,org_a,variant_id,'Errore fittizio');
  assert result->>'revoked_by'=actor::text and result->>'revoked_at' is not null,'explicit revocation retained';
  assert exists(select 1 from public.checkvan_driver_name_variants where id=variant_id),'revoked association is not deleted';
  result := public.internal_admin_confirm_driver_name_variant(actor,org_a,jsonb_build_object('driver_id',driver_other,'source','convocation','normalized_name','NOME FITTIZIO'));
  assert result->'variant'->>'driver_id'=driver_other::text,'revoked key can be explicitly reassigned';
  insert into public.checkvan_driver_name_variants(organization_id,driver_id,source,normalized_name,confirmed_by) values(org_b,driver_b,'convocation','NOME FITTIZIO',actor);
  assert (select count(*) from public.checkvan_driver_name_variants where normalized_name='NOME FITTIZIO')=3,'organization isolation allows the same confirmed key elsewhere';
  assert not exists(select 1 from information_schema.columns where table_schema='public' and table_name='checkvan_driver_name_variants' and column_name in ('pdf','file_name','hash','coordinates','raw_text','extracted_text')),'no import material columns';
  assert not has_table_privilege('authenticated','public.checkvan_driver_name_variants','SELECT'),'direct client denied';
  assert (select relrowsecurity from pg_class where oid='public.checkvan_driver_name_variants'::regclass),'RLS enabled';
  raise notice 'PASS: confirmed driver-name variants, source scope, audit, revocation, uniqueness and organization isolation';
end $$;
reset role;
