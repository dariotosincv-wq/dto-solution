import test from 'node:test'
import assert from 'node:assert/strict'
import { hashSecret, newSecret } from '../api/_lib/operationalAccess.js'
import { resolveEffective } from '../company/src/lib/weeklyPlanning.js'

test('operational QR secrets are opaque, unique and stored as hashes', () => {
  const first = newSecret(), second = newSecret()
  assert.match(first, /^[A-Za-z0-9_-]{40,}$/)
  assert.notEqual(first, second)
  assert.match(hashSecret(first), /^[0-9a-f]{64}$/)
  assert.notEqual(hashSecret(first), first)
})

test('driver operational view uses the effective assignment over its plan', () => {
  const plan = [{ driver_id: 'driver-a', assignment_date: '2026-09-07', work_status: 'TURNO', vehicle_id: 'plan', route: 'P' }]
  const effective = resolveEffective(plan, [{ ...plan[0], vehicle_id: 'effective', route: 'E' }])
  assert.equal(effective[0].vehicle_id, 'effective')
  assert.equal(effective[0].route, 'E')
  assert.equal(effective[0].source, 'override')
})
