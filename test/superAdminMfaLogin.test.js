import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { verifyTotpCode } from '../admin/src/mfaFlow.js'

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8')

function mfaClient({ valid = true } = {}) {
  let aal = 'aal1'
  const calls = []
  return { calls, auth: { mfa: {
    challenge: async ({ factorId }) => { calls.push(`challenge:${factorId}`); return { data: { id: 'challenge-id' }, error: null } },
    verify: async ({ factorId, challengeId, code }) => { calls.push(`verify:${factorId}:${challengeId}:${code}`); if (valid) aal = 'aal2'; return { data: {}, error: valid ? null : { message: 'MFA_VERIFY_FAILED' } } },
    getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: aal, nextLevel: 'aal2' }, error: null }),
  }, refreshSession: async () => ({ data: {}, error: null }) } }
}

test('AAL1 MFA_REQUIRED is routed to challenge and not shown as unauthorized', async () => {
  const app = await source('../admin/src/App.jsx')
  assert.match(app, /error\.message === 'MFA_REQUIRED'\) setMfaRequired\(true\)/)
  assert.match(app, /session && mfaRequired.*\/super-admin\/mfa/)
  assert.match(app, /else setDenied\(error\.status === 403\)/)
})

test('challenge route requires server-recognized pre-MFA state', async () => {
  const app = await source('../admin/src/App.jsx')
  assert.match(app, /function MfaGuard/)
  assert.match(app, /session&&mfaRequired\?<Outlet\/>:<Navigate to="\/super-admin\/login"/)
  assert.match(app, /<Route element={<MfaGuard\/>}><Route path="\/super-admin\/mfa"/)
})

test('challenge page finds only an existing verified TOTP and never enrolls', async () => {
  const page = await source('../admin/src/MfaChallengePage.jsx')
  assert.match(page, /state\.verified\[0\]/)
  assert.doesNotMatch(page, /enroll|qrCode|secret|unenroll/)
})

test('wrong code remains outside while valid challenge reaches real AAL2', async () => {
  await assert.rejects(verifyTotpCode(mfaClient({ valid: false }), { factorId: 'verified-factor', code: '123456' }), /MFA_VERIFY_FAILED/)
  const client = mfaClient()
  const result = await verifyTotpCode(client, { factorId: 'verified-factor', code: '123456' })
  assert.equal(result.currentLevel, 'aal2')
  assert.deepEqual(client.calls, ['challenge:verified-factor', 'verify:verified-factor:challenge-id:123456'])
})

test('successful AAL2 verification redirects only to Super Admin dashboard', async () => {
  const page = await source('../admin/src/MfaChallengePage.jsx')
  assert.match(page, /verifyTotpCode[\s\S]*window\.location\.replace\('\/super-admin\/dashboard'\)/)
})

test('full admin APIs retain the AAL2 guard and no MFA/database state is changed', async () => {
  const [handler, server, page] = await Promise.all([source('../api/_lib/superAdminHandler.js'), source('../api/_lib/superAdmin.js'), source('../admin/src/MfaChallengePage.jsx')])
  assert.match(handler, /authenticateSuperAdmin\(request, clients\)/)
  assert.match(server, /currentLevel !== 'aal2'/)
  assert.doesNotMatch(handler + page, /require_mfa\s*=|enroll\(|unenroll\(/)
})
