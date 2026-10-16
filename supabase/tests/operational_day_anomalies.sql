-- Run in one transaction after operational_day_history.sql and its prerequisite directory tables.
set local role service_role;
do $$
declare
  actor uuid := '71000000-0000-4000-8000-000000000010'; org uuid := '71000000-0000-4000-8000-000000000001';
  dario uuid := '71000000-0000-4000-8000-000000000020'; anna uuid := '71000000-0000-4000-8000-000000000021';
  van uuid := '71000000-0000-4000-8000-000000000030'; van2 uuid := '71000000-0000-4000-8000-000000000031'; anomaly_one uuid; anomaly_two uuid; result jsonb; failed boolean;
begin
  result:=public.internal_admin_confirm_operational_day_partial(actor,org,jsonb_build_object('action','CONFIRM_PARTIAL','operating_date','2030-10-15','idempotency_key','71000000-0000-4000-8000-000000000060','rows',jsonb_build_array(jsonb_build_object('driver_id',dario,'work_status','TURNO','vehicle_id',van,'route','CA_A23','departure_order',9,'departure_group',2,'parking_lot_position',8,'departure_wave',1)),'anomalies',jsonb_build_array(jsonb_build_object('client_row_id','71000000-0000-4000-8000-000000000061','reason_code','DRIVER_MISSING','driver_name_key','NOME UNO','departure_order',10),jsonb_build_object('client_row_id','71000000-0000-4000-8000-000000000062','reason_code','MATCH_AMBIGUOUS','driver_name_key','NOME DUE','departure_order',10))));
  assert result->>'anomalies_created'='2','partial confirmation is atomic with distinct same-order anomalies';
  assert (select count(*) from public.checkvan_operational_day_anomalies where organization_id=org and operating_date='2030-10-15')=2,'two anomalies retained';
  select id into anomaly_one from public.checkvan_operational_day_anomalies where organization_id=org and client_row_id='71000000-0000-4000-8000-000000000061';
  select id into anomaly_two from public.checkvan_operational_day_anomalies where organization_id=org and client_row_id='71000000-0000-4000-8000-000000000062';
  result:=public.internal_admin_resolve_operational_day_anomaly(actor,org,jsonb_build_object('action','RESOLVE','anomaly_id',anomaly_one,'idempotency_key','71000000-0000-4000-8000-000000000063','driver_id',anna,'vehicle_id',van2));
  assert result->>'status'='resolved','recovery resolved';
  assert (select revision from public.checkvan_operational_days where organization_id=org and operating_date='2030-10-15' and status='confirmed')=2,'recovery created correction revision';
  assert exists(select 1 from public.checkvan_operational_days where organization_id=org and operating_date='2030-10-15' and revision=1 and status='superseded'),'first partial revision preserved';
  assert exists(select 1 from public.checkvan_operational_day_driver_rows r join public.checkvan_operational_days d on d.id=r.operational_day_id where d.organization_id=org and d.operating_date='2030-10-15' and d.status='confirmed' and r.driver_id=anna and r.departure_order=10),'original departure order preserved';
  result:=public.internal_admin_resolve_operational_day_anomaly(actor,org,jsonb_build_object('action','RESOLVE','anomaly_id',anomaly_one,'idempotency_key','71000000-0000-4000-8000-000000000063','driver_id',anna,'vehicle_id',van2)); assert result->>'idempotent'='true','recovery retry idempotent';
  result:=public.internal_admin_resolve_operational_day_anomaly(actor,org,jsonb_build_object('action','EXCLUDE','anomaly_id',anomaly_two,'exclusion_reason','Non recuperabile')); assert result->>'status'='excluded','explicit exclusion';
  failed:=false; begin perform public.internal_admin_resolve_operational_day_anomaly('71000000-0000-4000-8000-000000000099',org,jsonb_build_object('action','EXCLUDE','anomaly_id',anomaly_two,'exclusion_reason','x')); exception when others then failed:=SQLERRM='COMPANY_ADMIN_REQUIRED'; end; assert failed,'authorization required';
  assert not has_table_privilege('authenticated','public.checkvan_operational_day_anomalies','SELECT'),'direct client denied';
  assert (select relrowsecurity from pg_class where oid='public.checkvan_operational_day_anomalies'::regclass),'anomaly RLS enabled';
  raise notice 'PASS: operational anomalies partial confirmation, same-order entries, recovery revision, idempotency, exclusion, authorization and RLS';
end $$;
reset role;
