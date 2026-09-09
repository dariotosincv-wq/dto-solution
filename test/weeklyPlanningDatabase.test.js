import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const container = process.env.PLANNING_DB_CONTAINER
test('weekly planning migration and transactions on local Supabase, rolled back', { skip: !container }, () => {
  assert.match(container, /^supabase_db_[a-zA-Z0-9_-]+$/, 'Use an explicitly selected local Supabase container')
  const sql = input => {
    const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8', timeout: 60000 })
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stderr + result.stdout)
    return result.stdout + result.stderr
  }
  const exists = table => sql(`select to_regclass('public.${table}') is not null;`).trim() === 't'
  const hadDrivers = exists('checkvan_drivers'), hadPlanning = exists('checkvan_weekly_plans')
  const migration = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
  const script = ['begin;']
  if (!hadDrivers) script.push(migration('20260824193755_driver_directory_daily_assignments.sql'), migration('20260824195118_atomic_daily_assignments.sql'))
  if (!hadPlanning) script.push(migration('20260908164756_weekly_driver_planning.sql'))
  script.push(migration('20260909012717_propagate_weekly_planned_vehicle.sql'), migration('20260909084520_inherit_weekly_default_vehicle.sql'), migration('20260909091018_inherit_latest_previous_vehicle.sql'))
  script.push(readFileSync(new URL('../supabase/tests/weekly_planning.sql', import.meta.url), 'utf8'), 'rollback;')
  const output = sql(script.join('\n'))
  assert.match(output, /PASS: SQL planning/)
  assert.match(output, /PASS: anon read and RPC denied/)
  assert.equal(exists('checkvan_drivers'), hadDrivers)
  assert.equal(exists('checkvan_weekly_plans'), hadPlanning)
})
