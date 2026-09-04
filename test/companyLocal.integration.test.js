import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import accessHandler from '../api/company-access.js'
import devicesHandler from '../api/company-devices.js'
import inspectionsHandler from '../api/company-inspections.js'

const url = process.env.CHECKVAN_SUPABASE_URL
const serviceKey = process.env.CHECKVAN_SUPABASE_SERVICE_ROLE_KEY
const publishableKey = process.env.DTO_SUPABASE_ANON_KEY

function responseRecorder() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this },
    setHeader(name, value) { this.headers[name] = value; return this },
    json(body) { this.body = body; return this },
  }
}

async function call(handler, token, query = {}) {
  const response = responseRecorder()
  await handler({ method: 'GET', headers: { authorization: `Bearer ${token}` }, query }, response)
  return response
}

test('company API handlers integrate with local Auth and CheckVan data', { skip: !url || !serviceKey || !publishableKey }, async (t) => {
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const browser = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const suffix = crypto.randomUUID()
  const email = `company-local-${suffix}@example.test`
  const password = `Local-${suffix}-Pass!`
  let userId

  t.after(async () => {
    if (userId) {
      await service.from('checkvan_area_memberships').delete().eq('auth_subject', userId)
      await service.auth.admin.deleteUser(userId)
    }
  })

  const { data: created, error: createError } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  assert.ifError(createError)
  userId = created.user.id

  const { data: organization, error: organizationError } = await service.from('checkvan_organizations')
    .select('id,name').eq('slug', 'dto-tester').single()
  assert.ifError(organizationError)
  const { error: membershipError } = await service.from('checkvan_area_memberships').insert({
    organization_id: organization.id,
    auth_subject: userId,
    role: 'COMPANY_ADMIN',
    status: 'active',
  })
  assert.ifError(membershipError)

  const { data: signedIn, error: signInError } = await browser.auth.signInWithPassword({ email, password })
  assert.ifError(signInError)
  const token = signedIn.session.access_token

  const access = await call(accessHandler, token)
  assert.equal(access.statusCode, 200)
  assert.equal(access.body.role, 'COMPANY_ADMIN')
  assert.equal(access.body.organization.id, organization.id)
  assert.equal(access.body.entitlement.source, 'tester')
  assert.equal(access.body.capabilities.manageDevices, true)

  const devices = await call(devicesHandler, token)
  assert.equal(devices.statusCode, 200)
  assert.ok(Array.isArray(devices.body.items))
  assert.equal(devices.body.active, 0)

  const inspections = await call(inspectionsHandler, token, { limit: '10', page: '0' })
  assert.equal(inspections.statusCode, 200)
  assert.deepEqual(inspections.body.items, [])
  assert.equal(inspections.body.total, 0)
  assert.equal(inspections.body.limit, 10)
})
