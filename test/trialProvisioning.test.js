import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { actions } from '../api/company-admin.js'

function clientsReturning(data) {
  const calls = []
  return {
    calls,
    clients: {
      checkvan: {
        async rpc(name, args) {
          calls.push({ name, args })
          return { data, error: null }
        },
      },
    },
  }
}

test('provisionTrial applica i default 30 giorni e 10 dispositivi', async () => {
  const fake = clientsReturning({ status: 'created', tokens: ['secret-token'] })
  const result = await actions.provisionTrial({
    organizationName: 'Azienda X',
    requestKey: 'azienda-x-2026-08',
  }, fake.clients)

  assert.equal(result.status, 'created')
  assert.equal(fake.calls[0].name, 'admin_provision_checkvan_trial')
  assert.equal(fake.calls[0].args.p_capacity, 10)
  assert.equal(fake.calls[0].args.p_trial_days, 30)
  assert.equal(fake.calls[0].args.p_token_count, 1)
})

test('provisionTrial inoltra capacità 30 e capacità arbitrarie senza tagli fissi', async () => {
  for (const capacity of [30, 47]) {
    const fake = clientsReturning({ status: 'created' })
    await actions.provisionTrial({ organizationName: 'Azienda X', capacity, trialDays: 45, tokenCount: 2, requestKey: `capacity-${capacity}` }, fake.clients)
    assert.equal(fake.calls[0].args.p_capacity, capacity)
    assert.equal(fake.calls[0].args.p_trial_days, 45)
  }
})

test('provisionTrial richiede nome azienda e chiave idempotenza', async () => {
  const fake = clientsReturning({})
  await assert.rejects(() => actions.provisionTrial({ organizationName: 'Azienda X' }, fake.clients), /INVALID_TRIAL_PROVISIONING/)
  assert.equal(fake.calls.length, 0)
})

test('il contratto SQL valida input, sovrapposizioni, idempotenza e sicurezza', async () => {
  const sql = (await readFile(new URL('../supabase/migrations/20260821113142_add_checkvan_trial_provisioning.sql', import.meta.url), 'utf8')).toLowerCase()
  for (const marker of [
    'invalid_capacity', 'invalid_trial_days', 'invalid_token_count', 'invalid_request_key',
    'idempotency_key_conflict', 'overlapping_license_exists', "'status','existing'",
    'pg_advisory_xact_lock', 'admin_create_checkvan_enrollment_token',
  ]) assert.match(sql, new RegExp(marker))
  assert.match(sql, /if exists[\s\S]*attname='access_grant'[\s\S]*else[\s\S]*insert into public\.checkvan_licenses/)
  assert.match(sql, /revoke all on function[\s\S]*from public,anon,authenticated/)
  assert.match(sql, /grant execute on function[\s\S]*to service_role/)
  assert.doesNotMatch(sql, /service_role[_a-z]*\s*[:=]\s*['"]/)
})

test('l’endpoint non espone service role o token nei log/client bundle', async () => {
  const source = await readFile(new URL('../api/company-admin.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /console\.|localStorage|service_role/i)
  assert.match(source, /authenticateAdmin/)
})
