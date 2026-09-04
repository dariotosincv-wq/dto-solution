import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const migration = readFileSync(resolve('supabase/migrations/20260824193755_driver_directory_daily_assignments.sql'),'utf8')
const gateway = readFileSync(resolve('api/platform.js'),'utf8')
test('driver directory is organization scoped and server-only',()=>{assert.match(migration,/organization_id uuid not null/);assert.match(migration,/enable row level security/);assert.match(migration,/revoke all on public\.checkvan_drivers/);assert.match(migration,/grant select,insert,update,delete[^;]+service_role/)})
test('daily assignments enforce one driver and one vehicle per day',()=>{assert.match(migration,/unique \(organization_id,assignment_date,driver_id\)/);assert.match(migration,/unique \(organization_id,assignment_date,vehicle_id\)/)})
test('inspection snapshots remain nullable and backward compatible',()=>{for(const column of ['driver_id','driver_first_name','driver_last_name','assignment_date'])assert.match(migration,new RegExp(`add column if not exists ${column}`))})
test('device directory reuses signed authentication',()=>{assert.match(gateway,/authenticateDeviceRequest\(request, clients, '\/api\/device-driver-assignments'\)/);assert.match(gateway,/resolveDeviceContext\(device, clients\)/)})
test('device payload exposes active drivers and today assignment',()=>{assert.match(gateway,/checkvan_drivers[^\n]+status/);assert.match(gateway,/assignment_date/);assert.match(gateway,/vehicle: publicVehicle/)})
test('CSV import is bounded and idempotent',()=>{assert.match(migration,/jsonb_array_length\(p_rows\)>500/);assert.match(migration,/EXISTING_CODE/);assert.match(migration,/EXISTING_NAME/)})
