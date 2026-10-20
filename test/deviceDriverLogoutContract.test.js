import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { requireDeviceDriverIdentity, revokeDeviceDriverSession } from '../api/_lib/deviceDriverIdentity.js'

test('device logout is routed through the signed platform gateway and keeps existing device authentication', async () => {
  const [vercel, platform] = await Promise.all([
    readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
    readFile(new URL('../api/platform.js', import.meta.url), 'utf8'),
  ])
  assert.match(vercel, /"source": "\/api\/device-driver-logout", "destination": "\/api\/platform\?resource=device-driver-logout"/)
  assert.match(platform, /resource === 'device-driver-logout'.*deviceDriverLogout/s)
  assert.match(platform, /authenticateDeviceRequest\(request, clients, '\/api\/device-driver-logout'\)/)
  assert.match(platform, /requireDeviceDriverIdentity\(request, clients, device, context\)/)
  assert.match(platform, /await revokeDeviceDriverSession\(clients, identity\.session\)/)
})

test('revocation writes only an active session and a revoked session cannot be reused', async () => {
  const updates = []
  const revokeClients = { checkvan: { from: () => ({ update: value => { updates.push(value); return { eq: () => ({ is: async () => ({ error: null }) }) } } }) } }
  await revokeDeviceDriverSession(revokeClients, { id: 'session-1' }, new Date('2026-10-20T10:00:00.000Z'))
  assert.deepEqual(updates, [{ revoked_at: '2026-10-20T10:00:00.000Z' }])

  const revokedClients = { checkvan: { from: table => {
    if (table === 'checkvan_device_driver_sessions') return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ is: () => ({ gt: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }) }) }
    throw new Error('driver lookup must not occur for a revoked session')
  } } }
  await assert.rejects(() => requireDeviceDriverIdentity({ headers: { 'x-checkvan-driver-session': 'a'.repeat(43) } }, revokedClients, { id: 'device-1' }, { organization: { id: 'organization-1' } }), /DRIVER_IDENTITY_REQUIRED/)
})
