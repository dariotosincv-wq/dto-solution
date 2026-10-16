set role service_role;
select public.internal_admin_confirm_operational_day_partial(
  '71000000-0000-4000-8000-000000000010',
  '71000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'action','CONFIRM_PARTIAL','operating_date','2030-10-16','idempotency_key','71000000-0000-4000-8000-000000000070',
    'rows',jsonb_build_array(jsonb_build_object('driver_id','71000000-0000-4000-8000-000000000020','work_status','TURNO','vehicle_id','71000000-0000-4000-8000-000000000030','route','CA_A23','departure_order',9,'departure_group',2,'parking_lot_position',8,'departure_wave',1)),
    'anomalies',jsonb_build_array(jsonb_build_object('client_row_id','71000000-0000-4000-8000-000000000071','reason_code','DRIVER_MISSING','driver_name_key','CONCURRENT','departure_order',10,'departure_group',2,'parking_lot_position',9,'departure_wave',1))
  )
);
reset role;
