-- Run inside a transaction after the directory and weekly-planning migrations.
-- Fixtures are neutral and rolled back by the test runner.
insert into public.checkvan_organizations(id,name) values
 ('70000000-0000-4000-8000-000000000001','Impresa test pianificazione'),
 ('70000000-0000-4000-8000-000000000002','Impresa test separata');
insert into public.checkvan_area_memberships(auth_subject,organization_id,role,status)
 values('70000000-0000-4000-8000-000000000010','70000000-0000-4000-8000-000000000001','COMPANY_ADMIN','active');
insert into public.checkvan_drivers(id,organization_id,first_name,last_name) values
 ('70000000-0000-4000-8000-000000000020','70000000-0000-4000-8000-000000000001','Test','Alfa'),
 ('70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000001','Test','Beta'),
 ('70000000-0000-4000-8000-000000000022','70000000-0000-4000-8000-000000000002','Test','Gamma');
insert into public.checkvan_vehicles(id,organization_id,internal_code,plate,plate_normalized,silhouette_category,status) values
 ('70000000-0000-4000-8000-000000000030','70000000-0000-4000-8000-000000000001','TEST 01','TEST001','TEST001','SMALL','active'),
 ('70000000-0000-4000-8000-000000000031','70000000-0000-4000-8000-000000000001','TEST 02','TEST002','TEST002','SMALL','active'),
 ('70000000-0000-4000-8000-000000000032','70000000-0000-4000-8000-000000000002','TEST 03','TEST003','TEST003','SMALL','active');

set local role service_role;
do $$
declare
 actor uuid := '70000000-0000-4000-8000-000000000010'; org uuid := '70000000-0000-4000-8000-000000000001';
 driver uuid := '70000000-0000-4000-8000-000000000020'; vehicle uuid := '70000000-0000-4000-8000-000000000030';
 input jsonb; result jsonb; snapshot jsonb; record_value public.checkvan_drivers; failed boolean;
begin
 record_value := public.internal_admin_set_driver_profile(actor,org,driver,3);
 assert record_value.expected_weekly_days=3, 'profile save';
 record_value := public.internal_admin_set_driver_profile(actor,org,driver,null);
 assert record_value.expected_weekly_days is null, 'nullable profile';
 input := jsonb_build_object('action','SAVE','week_start','2030-01-07','assignment_date','2030-01-07','revision',0,'driver_id',driver,'vehicle_id',vehicle,'work_status','TURNO','route','33','notes','Nota test');
 result := public.internal_admin_mutate_weekly_plan(actor,org,input);
 assert (result->>'revision')::integer=1, 'first revision';
 snapshot := public.internal_read_weekly_plan(org,'2030-01-07','2030-01-13');
 assert jsonb_array_length(snapshot->'entries')=1, 'prepared operational base';
 assert snapshot->'entries'->0->>'route'='33', 'optional route retained';
 failed := false;
 begin perform public.internal_admin_mutate_weekly_plan(actor,org,input); exception when others then failed := SQLERRM='PLANNING_STALE'; end;
 assert failed, 'stale revision rejected';
 failed := false;
 begin perform public.internal_admin_mutate_weekly_plan(actor,'70000000-0000-4000-8000-000000000002',input); exception when others then failed := SQLERRM='COMPANY_ADMIN_REQUIRED'; end;
 assert failed, 'cross-company access rejected';
 failed := false;
 begin perform public.internal_admin_mutate_weekly_plan(actor,org,input||jsonb_build_object('revision',1,'driver_id','70000000-0000-4000-8000-000000000022')); exception when others then failed := SQLERRM='DRIVER_NOT_FOUND'; end;
 assert failed, 'cross-company driver rejected';
 failed := false;
 begin perform public.internal_admin_mutate_weekly_plan(actor,org,input||jsonb_build_object('revision',1,'vehicle_id','70000000-0000-4000-8000-000000000032')); exception when others then failed := SQLERRM='VEHICLE_NOT_FOUND'; end;
 assert failed, 'cross-company vehicle rejected';
 result := public.internal_admin_mutate_weekly_plan(actor,org,input||jsonb_build_object('revision',1,'driver_id','70000000-0000-4000-8000-000000000021'));
 assert (result->>'revision')::integer=2, 'planned duplicate vehicle remains editable';
 result := public.internal_admin_mutate_weekly_plan(actor,org,jsonb_build_object('action','REQUIREMENT','week_start','2030-01-07','assignment_date','2030-01-07','revision',2,'required_drivers',null));
 result := public.internal_admin_mutate_weekly_plan(actor,org,jsonb_build_object('action','REQUIREMENT','week_start','2030-01-07','assignment_date','2030-01-08','revision',3,'required_drivers',0));
 result := public.internal_admin_mutate_weekly_plan(actor,org,input||jsonb_build_object('action','OVERRIDE','revision',4,'vehicle_id','70000000-0000-4000-8000-000000000031','route',null));
 snapshot := public.internal_read_weekly_plan(org,'2030-01-07','2030-01-13');
 assert snapshot->'overrides'->0->>'vehicle_id'='70000000-0000-4000-8000-000000000031', 'effective vehicle changed';
 assert exists(select 1 from jsonb_array_elements(snapshot->'entries') e where e->>'driver_id'=driver::text and e->>'vehicle_id'=vehicle::text), 'planned vehicle preserved';
 assert snapshot->'overrides'->0->'route'='null'::jsonb, 'explicit route clear';
 -- Daily vehicle edits preserve the plan and update the effective override.
 perform public.internal_admin_set_operational_vehicle(actor,org,'2030-01-07',driver,vehicle);
 snapshot := public.internal_read_weekly_plan(org,'2030-01-07','2030-01-13');
 assert snapshot->'overrides'->0->>'vehicle_id'=vehicle::text, 'daily editor overrides existing effective vehicle';
 assert (snapshot->>'revision')::integer=6, 'daily edit invalidates weekly revision';
 result := public.internal_admin_copy_operational_assignments(actor,org,'2030-01-08');
 assert (result->>'copied')::integer=1, 'legacy daily copy preserved';
 snapshot := public.internal_read_weekly_plan(org,'2030-01-07','2030-01-13');
 assert (snapshot->>'revision')::integer=7, 'daily copy invalidates weekly revision';
 result := public.internal_admin_mutate_weekly_plan(actor,org,jsonb_build_object('action','COPY_PREVIOUS','week_start','2030-01-14','revision',0));
 assert (result->>'copied')::integer=2 and (result->>'copied_requirements')::integer=2, 'copy exact preceding week';
 snapshot := public.internal_read_weekly_plan(org,'2030-01-14','2030-01-20');
 assert jsonb_array_length(snapshot->'overrides')=0 and jsonb_array_length(snapshot->'daily')=0, 'copy never copies effective overrides';
 result := public.internal_admin_mutate_weekly_plan(actor,org,jsonb_build_object('action','COPY_PREVIOUS','week_start','2030-01-14','revision',1));
 assert (result->>'copied')::integer=0, 'copy idempotent and non-destructive';
 result := public.internal_admin_mutate_weekly_plan(actor,org,input||jsonb_build_object('action','CLEAR','revision',7));
 snapshot := public.internal_read_weekly_plan(org,'2030-01-07','2030-01-13');
 assert jsonb_array_length(snapshot->'overrides')=1, 'clearing plan preserves override';
 result := public.internal_admin_mutate_weekly_plan(actor,org,input||jsonb_build_object('action','RESET_OVERRIDE','revision',8));
 snapshot := public.internal_read_weekly_plan(org,'2030-01-07','2030-01-07');
 assert jsonb_array_length(snapshot->'overrides')=0 and jsonb_array_length(snapshot->'daily')=0, 'reset returns to plan';
 -- Later empty shifts receive the planned vehicle; statuses and explicit choices do not.
 result := public.internal_admin_mutate_weekly_plan(actor,org,jsonb_build_object('action','SAVE','week_start','2030-01-07','assignment_date','2030-01-08','revision',9,'driver_id',driver,'vehicle_id',null,'work_status','TURNO'));
 result := public.internal_admin_mutate_weekly_plan(actor,org,jsonb_build_object('action','SAVE','week_start','2030-01-07','assignment_date','2030-01-09','revision',10,'driver_id',driver,'vehicle_id',null,'work_status','RIPOSO'));
 result := public.internal_admin_mutate_weekly_plan(actor,org,jsonb_build_object('action','SAVE','week_start','2030-01-07','assignment_date','2030-01-10','revision',11,'driver_id',driver,'vehicle_id',null,'work_status','FERIE'));
 result := public.internal_admin_mutate_weekly_plan(actor,org,jsonb_build_object('action','SAVE','week_start','2030-01-07','assignment_date','2030-01-11','revision',12,'driver_id',driver,'vehicle_id','70000000-0000-4000-8000-000000000031','work_status','TURNO'));
 result := public.internal_admin_mutate_weekly_plan(actor,org,jsonb_build_object('action','SAVE','week_start','2030-01-07','assignment_date','2030-01-12','revision',13,'driver_id',driver,'vehicle_id',null,'work_status','TURNO'));
 result := public.internal_admin_mutate_weekly_plan(actor,org,jsonb_build_object('action','SAVE','week_start','2030-01-07','assignment_date','2030-01-07','revision',14,'driver_id',driver,'vehicle_id',vehicle,'work_status','TURNO'));
 assert jsonb_array_length(result->'propagated')=2, 'vehicle propagated only to later empty shifts';
 assert exists(select 1 from jsonb_array_elements(result->'propagated') e where e->>'assignment_date'='2030-01-08' and e->>'vehicle_id'=vehicle::text), 'first empty shift filled';
 assert not exists(select 1 from jsonb_array_elements(result->'propagated') e where e->>'assignment_date' in ('2030-01-09','2030-01-10','2030-01-11')), 'absence and manual vehicle retained';
 snapshot := public.internal_read_weekly_plan(org,'2030-01-07','2030-01-13');
 assert exists(select 1 from jsonb_array_elements(snapshot->'entries') e where e->>'assignment_date'='2030-01-11' and e->>'vehicle_id'='70000000-0000-4000-8000-000000000031'), 'manual later vehicle remains local';
 assert exists(select 1 from public.checkvan_planning_history where organization_id=org and changed_by=actor and operation='UPDATE' and before_value is not null and after_value is not null), 'audit actor old/new values';
 assert not exists(select 1 from public.checkvan_planning_history where organization_id=org and changed_by is null), 'all mutations have an actor';
 assert not has_table_privilege('authenticated','public.checkvan_planned_assignments','SELECT'), 'no direct browser data access';
 assert not has_function_privilege('anon','public.internal_read_weekly_plan(uuid,date,date)','EXECUTE'), 'no anonymous resolver';
 assert not has_table_privilege('service_role','public.checkvan_planning_history','UPDATE'), 'history append-only for API';
 assert (select relrowsecurity from pg_class where oid='public.checkvan_planned_assignments'::regclass), 'RLS enabled';
 raise notice 'PASS: SQL planning, copy, revision, isolation, effective overrides, audit and grants';
end $$;
reset role;

set local role anon;
do $$ begin
 begin perform * from public.checkvan_planned_assignments; raise exception 'Anon unexpectedly read planning'; exception when insufficient_privilege then null; end;
 begin perform public.internal_read_weekly_plan('70000000-0000-4000-8000-000000000001','2030-01-07','2030-01-13'); raise exception 'Anon unexpectedly called resolver'; exception when insufficient_privilege then null; end;
 raise notice 'PASS: anon read and RPC denied';
end $$;
reset role;
