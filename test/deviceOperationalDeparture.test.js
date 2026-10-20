import assert from 'node:assert/strict'
import test from 'node:test'
import { handleDeviceOperationalDeparture } from '../api/_lib/deviceOperationalDeparture.js'

function response() {
  return {
    code: null, body: null,
    status(code) { this.code = code; return this },
    setHeader() { return this },
    json(body) { this.body = body; return this },
  }
}

function dependencies(rpc) {
  return {
    clients: { checkvan: { rpc } },
    authenticate: async (_request, _clients, path) => { assert.equal(path, '/api/device-operational-departure'); return { id: 'device-verified' } },
    resolveContext: async () => ({ organization: { id: 'organization-verified' } }),
    requireIdentity: async () => ({ driver: { id: 'driver-verified' } }),
    operatingDate: '2026-10-20',
  }
}

test('device departure STATUS derives organization and driver only from verified device identity', async () => {
  const calls = []
  const res = response()
  await handleDeviceOperationalDeparture({ method: 'POST', body: { action: 'STATUS', driver_id: 'attacker', organization_id: 'attacker' } }, res, dependencies(async (...args) => {
    calls.push(args)
    return { data: { queue_status: 'active', item: { status: 'called' } }, error: null }
  }))
  assert.equal(res.code, 200)
  assert.deepEqual(res.body, { queue_status: 'active', item: { status: 'called' } })
  assert.deepEqual(calls, [['internal_driver_departure_status', { p_organization_id: 'organization-verified', p_driver_id: 'driver-verified', p_date: '2026-10-20' }]])
})

test('device departure CONFIRM uses the verified identity and preserves the server idempotent result', async () => {
  const calls = []
  const res = response()
  await handleDeviceOperationalDeparture({ method: 'POST', body: { action: 'CONFIRM' } }, res, dependencies(async (...args) => {
    calls.push(args)
    return { data: { idempotent: true, item: { status: 'departed' } }, error: null }
  }))
  assert.equal(res.code, 200)
  assert.deepEqual(res.body, { idempotent: true, item: { status: 'departed' } })
  assert.deepEqual(calls, [['internal_driver_confirm_operational_departure', { p_organization_id: 'organization-verified', p_driver_id: 'driver-verified', p_date: '2026-10-20', p_origin: 'driver_utility' }]])
})

test('device departure rejects invalid actions, expired identities and unavailable confirmations', async () => {
  const invalid = response()
  await handleDeviceOperationalDeparture({ method: 'POST', body: { action: 'DELETE' } }, invalid, dependencies(async () => ({ data: null, error: null })))
  assert.equal(invalid.code, 400)
  assert.deepEqual(invalid.body, { error: 'INVALID_DEPARTURE_ACTION' })

  const expired = response()
  const expiredDependencies = dependencies(async () => ({ data: null, error: null }))
  expiredDependencies.requireIdentity = async () => { throw Object.assign(new Error('DRIVER_IDENTITY_REQUIRED'), { status: 401 }) }
  await handleDeviceOperationalDeparture({ method: 'POST', body: { action: 'STATUS' } }, expired, expiredDependencies)
  assert.equal(expired.code, 401)
  assert.deepEqual(expired.body, { error: 'DRIVER_IDENTITY_REQUIRED' })

  const unavailable = response()
  await handleDeviceOperationalDeparture({ method: 'POST', body: { action: 'CONFIRM' } }, unavailable, dependencies(async () => ({ data: null, error: { message: 'DEPARTURE_NOT_AVAILABLE' } })))
  assert.equal(unavailable.code, 409)
  assert.deepEqual(unavailable.body, { error: 'DEPARTURE_NOT_AVAILABLE' })
})
