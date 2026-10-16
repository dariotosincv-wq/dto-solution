import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { confirmDriverNameVariant, driverNameVariantInput, driverNameVariantRevocationInput, revokeDriverNameVariant } from '../api/_lib/driverNameVariants.js'

const driverId = '72000000-0000-4000-8000-000000000020'
const variantId = '72000000-0000-4000-8000-000000000030'

test('variant API accepts only explicitly normalized confirmed keys and revocations', () => {
  assert.deepEqual(driverNameVariantInput({ driver_id: driverId, source: 'convocation', normalized_name: 'NOME FITTIZIO' }), { driver_id: driverId, source: 'convocation', normalized_name: 'NOME FITTIZIO' })
  assert.throws(() => driverNameVariantInput({ driver_id: driverId, source: 'convocation', normalized_name: 'Nome Fittizio' }))
  assert.throws(() => driverNameVariantInput({ driver_id: driverId, source: 'anywhere', normalized_name: 'NOME FITTIZIO' }))
  assert.deepEqual(driverNameVariantRevocationInput({ variant_id: variantId, reason: '  Correzione  ' }), { variant_id: variantId, reason: 'Correzione' })
})

test('variant API scopes confirmation and revocation to the server organization and actor', async () => {
  const calls = []
  const client = { rpc: async (name, args) => { calls.push({ name, args }); return { data: { ok: true } } } }
  await confirmDriverNameVariant(client, 'server-org', 'server-user', { driver_id: driverId, source: 'assignment_departure', normalized_name: 'NOME FITTIZIO ESTESO', organization_id: 'attacker-org' })
  await revokeDriverNameVariant(client, 'server-org', 'server-user', { variant_id: variantId, reason: 'Correzione' })
  assert.deepEqual(calls, [
    { name: 'internal_admin_confirm_driver_name_variant', args: { p_auth_subject: 'server-user', p_organization_id: 'server-org', p_input: { driver_id: driverId, source: 'assignment_departure', normalized_name: 'NOME FITTIZIO ESTESO' } } },
    { name: 'internal_admin_revoke_driver_name_variant', args: { p_auth_subject: 'server-user', p_organization_id: 'server-org', p_variant_id: variantId, p_reason: 'Correzione' } },
  ])
})

test('driver-name variant migration is transaction-tested on explicitly selected local PostgreSQL', { skip: !process.env.PLANNING_DB_CONTAINER }, () => {
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
  script.push(migration('20261016090421_driver_name_variants.sql'), readFileSync(new URL('../supabase/tests/driver_name_variants.sql', import.meta.url), 'utf8'), 'rollback;')
  assert.match(sql(script.join('\n')), /PASS: confirmed driver-name variants/)
})
