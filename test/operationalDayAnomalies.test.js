import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { confirmOperationalDay, operationalDayInput, resolveOperationalDayAnomaly } from '../api/_lib/operationalDays.js'

const driver = '70000000-0000-4000-8000-000000000001'
const vehicle = '70000000-0000-4000-8000-000000000002'
const anomaly = '70000000-0000-4000-8000-000000000003'
const key = '70000000-0000-4000-8000-000000000004'
const row = { driver_id: driver, work_status: 'TURNO', vehicle_id: vehicle, route: 'CA_A23', departure_order: 9, departure_group: 2, parking_lot_position: 8, departure_wave: 1 }
const partial = { action: 'CONFIRM_PARTIAL', operating_date: '2030-10-15', idempotency_key: key, rows: [row], anomalies: [
  { client_row_id: anomaly, reason_code: 'DRIVER_MISSING', driver_name_key: 'NOME MANCANTE', vehicle_internal_code_key: 'MP 06', vehicle_plate_key: 'AA000AA', route: 'CA_A23', departure_order: 10, departure_group: 2, parking_lot_position: 9, departure_wave: 1 },
  { client_row_id: '70000000-0000-4000-8000-000000000005', reason_code: 'MATCH_AMBIGUOUS', driver_name_key: 'OMONIMO', vehicle_internal_code_key: null, vehicle_plate_key: null, route: null, departure_order: 10, departure_group: null, parking_lot_position: null, departure_wave: null },
] }

test('partial confirmation accepts distinct anomalies with the same departure order and only normalized metadata', () => {
  const input = operationalDayInput(partial)
  assert.equal(input.anomalies.length, 2)
  assert.equal(input.anomalies[1].departure_order, 10)
  assert.equal(input.pdf, undefined)
  assert.throws(() => operationalDayInput({ ...partial, anomalies: [{ ...partial.anomalies[0], client_row_id: 'not-a-uuid' }] }))
})

test('partial confirmation and recovery RPCs are organization-scoped and idempotency-keyed', async () => {
  const calls = []
  const client = { rpc: async (name, args) => { calls.push({ name, args }); return { data: { ok: true } } } }
  await confirmOperationalDay(client, 'server-org', 'server-user', partial)
  await resolveOperationalDayAnomaly(client, 'server-org', 'server-user', { action: 'RESOLVE', anomaly_id: anomaly, idempotency_key: '70000000-0000-4000-8000-000000000006', driver_id: driver, vehicle_id: vehicle })
  await resolveOperationalDayAnomaly(client, 'server-org', 'server-user', { action: 'EXCLUDE', anomaly_id: anomaly, exclusion_reason: 'Documento non recuperabile' })
  assert.deepEqual(calls.map(call => call.name), ['internal_admin_confirm_operational_day_partial', 'internal_admin_resolve_operational_day_anomaly', 'internal_admin_resolve_operational_day_anomaly'])
  assert.ok(calls.every(call => call.args.p_organization_id === 'server-org' && call.args.p_auth_subject === 'server-user'))
  await assert.rejects(() => resolveOperationalDayAnomaly(client, 'server-org', 'server-user', { action: 'EXCLUDE', anomaly_id: anomaly, exclusion_reason: '' }))
})

test('anomaly migration keeps RLS, atomic correction and advisory-lock concurrency controls', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261016171406_operational_day_anomalies.sql', import.meta.url), 'utf8')
  assert.match(sql, /enable row level security/)
  assert.match(sql, /pg_advisory_xact_lock/g)
  assert.match(sql, /internal_admin_confirm_operational_day\(p_auth_subject,p_organization_id/)
  assert.match(sql, /'action','CORRECT'/)
  assert.match(sql, /unique \(operational_day_id, client_row_id\)/)
  assert.match(sql, /resolution_idempotency_key/)
})
