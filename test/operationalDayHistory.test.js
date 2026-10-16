import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { confirmOperationalDay, operationalDayInput, readCurrentOperationalDay } from '../api/_lib/operationalDays.js'

const id = '60000000-0000-4000-8000-000000000001'
const key = '60000000-0000-4000-8000-000000000002'
const turn = { driver_id: id, work_status: 'TURNO', vehicle_id: '60000000-0000-4000-8000-000000000003', route: '33', departure_order: 33, departure_group: 1, parking_lot_position: 0, departure_wave: 1, notes: 'Confermato' }

test('operational-day API input allows only normalized historical rows, never document fields', () => {
  const value = operationalDayInput({ action: 'CONFIRM', operating_date: '2030-09-15', idempotency_key: key, rows: [turn], pdf: 'forbidden', extracted_text: 'forbidden', file_url: 'forbidden' })
  assert.deepEqual(Object.keys(value).sort(), ['action', 'correction_reason', 'idempotency_key', 'operating_date', 'rows'])
  assert.deepEqual(Object.keys(value.rows[0]).sort(), ['departure_group', 'departure_order', 'departure_wave', 'driver_id', 'notes', 'parking_lot_position', 'route', 'source', 'vehicle_id', 'work_status'])
  assert.equal(value.rows[0].source, 'manual')
  assert.throws(() => operationalDayInput({ action: 'CONFIRM', operating_date: 'bad', idempotency_key: key, rows: [turn] }))
  assert.throws(() => operationalDayInput({ action: 'CONFIRM', operating_date: '2030-09-15', idempotency_key: key, rows: [{ ...turn, vehicle_id: null }] }))
  assert.deepEqual(operationalDayInput({ action: 'CONFIRM', operating_date: '2030-09-15', idempotency_key: key, rows: [{ ...turn, work_status: 'FERIE', vehicle_id: null, route: null, departure_order: null, departure_group: null, parking_lot_position: null, departure_wave: null }] }).rows[0], { ...turn, work_status: 'FERIE', vehicle_id: null, route: null, departure_order: null, departure_group: null, parking_lot_position: null, departure_wave: null, source: 'manual' })
  assert.throws(() => operationalDayInput({ action: 'CONFIRM', operating_date: '2030-09-15', idempotency_key: key, rows: [{ ...turn, work_status: 'FERIE' }] }))
  assert.throws(() => operationalDayInput({ action: 'CONFIRM', operating_date: '2030-09-15', idempotency_key: key, rows: [{ ...turn, departure_wave: 0 }] }))
  assert.throws(() => operationalDayInput({ action: 'CORRECT', operating_date: '2030-09-15', idempotency_key: key, rows: [turn] }))
  assert.throws(() => operationalDayInput({ action: 'CONFIRM', operating_date: '2030-09-15', idempotency_key: key, rows: [{ ...turn, source: 'pdf_import_confirmed' }] }))
})

test('operational-day RPC is server scoped and maps current reads', async () => {
  let request
  const client = { rpc: async (name, args) => { request = { name, args }; return { data: { day: { id: 'day' }, rows: [] } } } }
  await confirmOperationalDay(client, 'server-org', 'server-user', { action: 'CONFIRM', operating_date: '2030-09-15', idempotency_key: key, rows: [turn], organization_id: 'attacker-org' })
  assert.equal(request.name, 'internal_admin_confirm_operational_day')
  assert.equal(request.args.p_organization_id, 'server-org')
  assert.equal(request.args.p_auth_subject, 'server-user')
  assert.equal(request.args.p_input.organization_id, undefined)
  const empty = await readCurrentOperationalDay({ rpc: async () => ({ data: null }) }, 'server-org', '2030-09-15')
  assert.deepEqual(empty, { day: null, rows: [] })
})

test('operational history migration is transaction-tested on explicitly selected local Supabase', { skip: !process.env.PLANNING_DB_CONTAINER }, () => {
  const container = process.env.PLANNING_DB_CONTAINER
  assert.match(container, /^supabase_db_[a-zA-Z0-9_-]+$/)
  const sql = input => {
    const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8', timeout: 60000 })
    assert.ifError(result.error); assert.equal(result.status, 0, result.stderr + result.stdout)
    return result.stdout + result.stderr
  }
  const migration = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
  const exists = table => sql(`select to_regclass('public.${table}') is not null;`).trim() === 't'
  const script = ['begin;']
  if (!exists('checkvan_drivers')) script.push(migration('20260824193755_driver_directory_daily_assignments.sql'), migration('20260824195118_atomic_daily_assignments.sql'))
  script.push(migration('20261016152104_operational_day_history.sql'), readFileSync(new URL('../supabase/tests/operational_day_history.sql', import.meta.url), 'utf8'), 'rollback;')
  assert.match(sql(script.join('\n')), /PASS: operational history/)
})
