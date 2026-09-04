import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { beginTotpEnrollment, readMfaState, verifyTotpCode } from '../admin/src/mfaFlow.js'

function client({ factors = [], aal = 'aal1', enrollError = null, challengeError = null, verifyError = null } = {}) {
  const calls = []
  const api = {
    calls,
    auth: {
      mfa: {
        listFactors: async () => { calls.push('list'); return { data: { totp: factors }, error: null } },
        getAuthenticatorAssuranceLevel: async () => { calls.push('aal'); return { data: { currentLevel: aal, nextLevel: factors.length ? 'aal2' : 'aal1' }, error: null } },
        unenroll: async ({ factorId }) => { calls.push(`unenroll:${factorId}`); return { data: {}, error: null } },
        enroll: async () => { calls.push('enroll'); return { data: { id: 'new-factor', totp: { qr_code: '<svg/>', secret: 'MEMORY_ONLY' } }, error: enrollError } },
        challenge: async ({ factorId }) => { calls.push(`challenge:${factorId}`); return { data: { id: 'challenge-1' }, error: challengeError } },
        verify: async ({ factorId, challengeId, code }) => { calls.push(`verify:${factorId}:${challengeId}:${code}`); if (!verifyError) aal = 'aal2'; return { data: {}, error: verifyError } },
      },
      refreshSession: async () => { calls.push('refresh'); return { data: {}, error: null } },
    },
  }
  return api
}

test('MFA state without factors is AAL1 and allows enrollment', async () => {
  const api = client()
  const state = await readMfaState(api)
  assert.equal(state.verified.length, 0)
  assert.equal(state.currentLevel, 'aal1')
  assert.equal((await beginTotpEnrollment(api)).factorId, 'new-factor')
})

test('existing verified TOTP is reused and never deleted or duplicated', async () => {
  const api = client({ factors: [{ id: 'verified-1', status: 'verified' }] })
  const result = await beginTotpEnrollment(api)
  assert.equal(result.kind, 'verified')
  assert.deepEqual(api.calls, ['list', 'aal'])
})

test('abandoned unverified factors are safely removed before a new enrollment', async () => {
  const api = client({ factors: [{ id: 'old-unverified', status: 'unverified' }] })
  const result = await beginTotpEnrollment(api)
  assert.equal(result.kind, 'enrollment')
  assert.deepEqual(api.calls, ['list', 'aal', 'unenroll:old-unverified', 'enroll'])
})

test('verification challenges the factor and confirms real AAL2', async () => {
  const api = client()
  const result = await verifyTotpCode(api, { factorId: 'factor-1', code: '123456' })
  assert.equal(result.currentLevel, 'aal2')
  assert.deepEqual(api.calls, ['challenge:factor-1', 'verify:factor-1:challenge-1:123456', 'aal'])
})

test('invalid local or remote TOTP code does not report AAL2', async () => {
  await assert.rejects(verifyTotpCode(client(), { factorId: 'factor-1', code: '12x' }), /MFA_CODE_INVALID/)
  await assert.rejects(verifyTotpCode(client({ verifyError: { message: 'invalid code' } }), { factorId: 'factor-1', code: '123456' }), /invalid code/)
})

test('MFA page stays behind the existing server-authorized Guard', async () => {
  const app = await readFile(new URL('../admin/src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /<Route element={<Guard\/>}>[\s\S]*\/super-admin\/sicurezza/)
  assert.match(app, /adminRequest\(next\.access_token, 'access'\)/)
})

test('TOTP secret remains component memory only and enrollment never changes require_mfa', async () => {
  const sources = await Promise.all(['../admin/src/MfaSecurityPage.jsx', '../admin/src/mfaFlow.js'].map((path) => readFile(new URL(path, import.meta.url), 'utf8')))
  const source = sources.join('\n')
  assert.doesNotMatch(source, /localStorage|sessionStorage|adminRequest|fetch\(|require_mfa|SERVICE_ROLE/)
  assert.match(source, /useState\(null\)/)
})
