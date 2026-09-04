import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createCompanyTrialHandler } from '../api/company-trial.js'
import { provisionCompanyTrial, trialEligibilityFor } from '../api/_lib/companyTrial.js'

const verifiedUser = { id: '11111111-1111-4111-8111-111111111111', email: 'azienda@example.test', email_confirmed_at: '2026-08-22T00:00:00Z', is_anonymous: false, app_metadata: { checkvan_trial_eligible: true } }

function responseRecorder() {
  return {
    statusCode: null, body: null,
    status(code) { this.statusCode = code; return this },
    setHeader() { return this },
    json(body) { this.body = body; return this },
  }
}

function rpcClient(data = { status: 'created', organization_id: 'org', license_id: 'license', tokens: ['one-time-token'], tokens_recoverable: true }) {
  const calls = []
  return { calls, clients: { checkvan: { async rpc(name, args) { calls.push({ name, args }); return { data, error: null } } } } }
}

test('company trial endpoint rejects anonymous requests with 401', async () => {
  const handler = createCompanyTrialHandler({ createClients: () => ({}) })
  const response = responseRecorder()
  await handler({ method: 'POST', headers: {}, body: { organizationName: 'Azienda X' } }, response)
  assert.equal(response.statusCode, 401)
  assert.equal(response.body.error, 'UNAUTHORIZED')
})

test('unverified and anonymous authenticated users are not eligible', () => {
  assert.deepEqual(trialEligibilityFor({ ...verifiedUser, email_confirmed_at: null }), { eligible: false, reason: 'VERIFIED_EMAIL_REQUIRED' })
  assert.deepEqual(trialEligibilityFor({ ...verifiedUser, is_anonymous: true }), { eligible: false, reason: 'AUTHENTICATED_USER_REQUIRED' })
  assert.deepEqual(trialEligibilityFor({ ...verifiedUser, app_metadata: {} }), { eligible: false, reason: 'TRIAL_INVITATION_REQUIRED' })
})

test('authenticated but ineligible user receives a safe 403 response', async () => {
  const handler = createCompanyTrialHandler({
    createClients: () => ({}),
    authenticate: async () => ({ ...verifiedUser, app_metadata: {} }),
  })
  const response = responseRecorder()
  await handler({ method: 'POST', headers: { authorization: 'Bearer valid' }, body: { organizationName: 'Azienda X' } }, response)
  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.body, { error: 'TRIAL_NOT_ELIGIBLE', reason: 'TRIAL_INVITATION_REQUIRED' })
})

test('valid provisioning derives the subject server-side and returns the one-time token', async () => {
  const fake = rpcClient()
  const result = await provisionCompanyTrial(verifiedUser, { organizationName: ' Azienda X ' }, fake.clients)
  assert.equal(fake.calls[0].name, 'self_provision_checkvan_trial')
  assert.deepEqual(fake.calls[0].args, {
    p_auth_subject: verifiedUser.id,
    p_organization_name: 'Azienda X',
    p_capacity: 10,
    p_trial_days: 30,
  })
  assert.equal(result.enrollmentToken, 'one-time-token')
})

test('client cannot choose auth_subject or organization_id', async () => {
  for (const injected of [{ authSubject: 'other' }, { auth_subject: 'other' }, { organizationId: 'other' }, { organization_id: 'other' }]) {
    const fake = rpcClient()
    await assert.rejects(() => provisionCompanyTrial(verifiedUser, { organizationName: 'Azienda X', ...injected }, fake.clients), /FORBIDDEN_PROVISIONING_FIELD/)
    assert.equal(fake.calls.length, 0)
  }
})

test('idempotent response never invents or recovers a token', async () => {
  const fake = rpcClient({ status: 'existing', organization_id: 'org', license_id: 'license', tokens: [], tokens_recoverable: false })
  const result = await provisionCompanyTrial(verifiedUser, { organizationName: 'Azienda X' }, fake.clients)
  assert.equal(result.status, 'existing')
  assert.equal(result.enrollmentToken, null)
  assert.equal(result.tokenRecoverable, false)
})

test('frontend keeps enrollment token in memory only and refreshes company access', async () => {
  const page = await readFile(new URL('../company/src/pages/CheckVanPage.jsx', import.meta.url), 'utf8')
  const client = await readFile(new URL('../company/src/lib/companySupabase.js', import.meta.url), 'utf8')
  assert.match(page, /await refreshAccess\(\)/)
  assert.match(page, /created\?\.enrollmentToken/)
  assert.doesNotMatch(`${page}\n${client}`, /localStorage|sessionStorage|console\./)
})

test('self provisioning SQL is atomic, idempotent and service-role only', async () => {
  const sql = (await readFile(new URL('../supabase/migrations/20260822210013_self_provision_checkvan_trial.sql', import.meta.url), 'utf8')).toLowerCase()
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /'self-trial:' \|\| p_auth_subject::text/)
  assert.match(sql, /insert into public\.checkvan_organizations/)
  assert.match(sql, /insert into public\.checkvan_licenses/)
  assert.match(sql, /admin_create_checkvan_enrollment_token/)
  assert.match(sql, /insert into public\.checkvan_area_memberships[\s\S]*'company_admin'/)
  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function[\s\S]*to service_role/)
  assert.doesNotMatch(sql, /select \* into organization_row[\s\S]*lower\(btrim\(name\)\)=lower/)
})
