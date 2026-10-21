import assert from 'node:assert/strict'
import test from 'node:test'
import { handleDeparturePushDispatch, handleDevicePushRegistration, sendDepartureCalledFcm, validWebhookSecret } from '../api/_lib/departurePush.js'

function response() { return { code: null, body: null, status(code) { this.code = code; return this }, setHeader() { return this }, json(body) { this.body = body; return this } } }
const eventId = '11111111-1111-4111-8111-111111111111'
const fcmToken = 'x'.repeat(120)

test('push webhook rejects a missing or wrong secret before accessing the outbox', async () => {
  const res = response()
  await handleDeparturePushDispatch({ method: 'POST', headers: {}, body: { event_id: eventId } }, res, { clients: { checkvan: {} }, webhookSecret: 'secret' })
  assert.equal(res.code, 401)
  assert.equal(validWebhookSecret('secret', 'secret'), true)
  assert.equal(validWebhookSecret('wrong', 'secret'), false)
})

test('push registration derives session and device from verified identity, never request ids', async () => {
  const calls = []
  const res = response()
  await handleDevicePushRegistration({ method: 'POST', body: { action: 'REGISTER', token: fcmToken, driver_id: 'attacker' } }, res, {
    clients: { checkvan: { rpc: async (...args) => { calls.push(args); return { error: null } } } },
    authenticate: async (_request, _clients, path) => { assert.equal(path, '/api/device-push-registration'); return { id: 'device-verified' } },
    resolveContext: async () => ({ organization: { id: 'organization-verified' } }),
    requireIdentity: async () => ({ session: { id: 'session-verified' }, driver: { id: 'driver-verified' } }),
  })
  assert.equal(res.code, 200)
  assert.equal(calls[0][0], 'internal_register_device_push_token')
  assert.equal(calls[0][1].p_session_id, 'session-verified')
  assert.equal(calls[0][1].p_device_id, 'device-verified')
})

test('signed recovery can claim only the verified driver and organization outbox rows', async () => {
  const calls = [], res = response()
  await handleDevicePushRegistration({ method: 'POST', body: { action: 'RECOVER' } }, res, {
    clients: { checkvan: { rpc: async (...args) => { calls.push(args); return { data: [], error: null } } } },
    authenticate: async () => ({ id: 'device-verified' }), resolveContext: async () => ({ organization: { id: 'organization-verified' } }),
    requireIdentity: async () => ({ session: { id: 'session-verified' }, driver: { id: 'driver-verified' } }),
  })
  assert.equal(res.code, 200)
  assert.deepEqual(calls[0], ['internal_claim_operational_departure_push', { p_event_id: null, p_driver_id: 'driver-verified', p_organization_id: 'organization-verified' }])
})

test('FCM payload contains only an opaque event id and expires without calling Firebase', async () => {
  const expired = await sendDepartureCalledFcm({ token: fcmToken, eventId, expiresAt: new Date(1).toISOString(), accountJson: '{}', now: Date.now() })
  assert.deepEqual(expired, { outcome: 'expired' })
  const requests = []
  const result = await sendDepartureCalledFcm({ token: fcmToken, eventId, expiresAt: new Date(Date.now() + 60_000).toISOString(), accountJson: JSON.stringify({ project_id: 'project', client_email: 'server@example.test', private_key: '-----BEGIN PRIVATE KEY-----\ninvalid\n-----END PRIVATE KEY-----\n' }), request: async (...args) => { requests.push(args); throw new Error('not reached with invalid key') } })
    .then(() => 'unexpected').catch(() => 'rejected')
  assert.equal(requests.length, 0)
  assert.equal(result, 'rejected')
})
