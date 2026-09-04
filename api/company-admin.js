import { authenticateAdmin } from './_lib/adminAuthorization.js'
import { clientsFromEnvironment, sendError, sendJson } from './_lib/companyLicensing.js'
import { createHash } from 'node:crypto'

export const actions = {
  async provisionTrial(body, clients) {
    const {
      organizationName,
      capacity = 10,
      trialDays = 30,
      tokenCount = 1,
      startsAt = new Date().toISOString(),
      internalLabel = null,
      requestKey,
    } = body
    if (typeof organizationName !== 'string' || typeof requestKey !== 'string') {
      throw Object.assign(new Error('INVALID_TRIAL_PROVISIONING'), { status: 400 })
    }
    const { data, error } = await clients.checkvan.rpc('admin_provision_checkvan_trial', {
      p_organization_name: organizationName,
      p_capacity: capacity,
      p_trial_days: trialDays,
      p_token_count: tokenCount,
      p_starts_at: startsAt,
      p_internal_label: internalLabel,
      p_request_key: requestKey,
    })
    if (error || !data) throw new Error(error?.message ?? 'PROVISIONING_FAILED')
    return data
  },
  async createOrganization(body, clients) {
    const { name, slug, retentionDays = 730 } = body
    if (typeof name !== 'string' || typeof slug !== 'string') throw Object.assign(new Error('INVALID_ORGANIZATION'), { status: 400 })
    const { data, error } = await clients.checkvan.from('checkvan_organizations').insert({ name, slug, retention_days: retentionDays, organization_type: 'customer' }).select('id,name,slug,status,retention_days').single()
    if (error) throw new Error('PROVISIONING_FAILED'); return data
  },
  async createLicense(body, clients) {
    const { organizationId, kind = 'commercial', capacity, startsAt, endsAt = null } = body
    if (!organizationId || !['trial', 'commercial'].includes(kind) || !Number.isInteger(capacity) || capacity < 1) throw Object.assign(new Error('INVALID_LICENSE'), { status: 400 })
    const { data, error } = await clients.checkvan.from('checkvan_licenses').insert({ organization_id: organizationId, kind, capacity, starts_at: startsAt ?? new Date().toISOString(), ends_at: endsAt, product_mode: 'company', cloud_enabled: true, access_grant: kind === 'trial' ? 'TRIAL' : 'PAID' }).select().single()
    if (error) throw new Error('PROVISIONING_FAILED'); return data
  },
  async grantInternalAccess(body, clients) {
    const { organizationId, authSubject = null, grantType, label = grantType } = body
    if (!organizationId || !['TESTER', 'FOUNDER'].includes(grantType)) throw Object.assign(new Error('INVALID_ENTITLEMENT'), { status: 400 })
    if (grantType === 'FOUNDER') {
      const { data: token, error } = await clients.checkvan.rpc('admin_create_checkvan_founder_key', { p_label: label })
      if (error || typeof token !== 'string') throw new Error('PROVISIONING_FAILED')
      const digest = createHash('sha256').update(token).digest('hex')
      const { data, error: updateError } = await clients.checkvan.from('checkvan_founder_entitlements').update({ organization_id: organizationId, auth_subject: authSubject }).eq('token_digest', digest).select('id,organization_id,auth_subject,status').single()
      if (updateError) throw new Error('PROVISIONING_FAILED')
      return { ...data, activationToken: token }
    }
    const { data, error } = await clients.checkvan.from('checkvan_licenses').insert({ organization_id: organizationId, kind: 'commercial', access_grant: 'TESTER', product_mode: 'company', cloud_enabled: true, capacity: body.capacity ?? 100, starts_at: new Date().toISOString() }).select().single()
    if (error) throw new Error('PROVISIONING_FAILED'); return data
  },
  async addMembership(body, clients) {
    const { organizationId, authSubject, role = 'COMPANY_OPERATOR' } = body
    if (!authSubject || !['COMPANY_ADMIN', 'COMPANY_OPERATOR'].includes(role)) throw Object.assign(new Error('INVALID_MEMBERSHIP'), { status: 400 })
    const { data, error } = await clients.checkvan.from('checkvan_area_memberships').insert({ organization_id: organizationId, auth_subject: authSubject, role }).select().single()
    if (error) throw new Error('PROVISIONING_FAILED'); return data
  },
  async revokeDevice(body, clients) {
    if (!body.deviceId) throw Object.assign(new Error('INVALID_DEVICE'), { status: 400 })
    const now = new Date().toISOString()
    const { error } = await clients.checkvan.from('checkvan_license_devices').update({ status: 'revoked', revoked_at: now }).eq('id', body.deviceId)
    if (error) throw new Error('PROVISIONING_FAILED')
    await clients.checkvan.from('checkvan_device_assignments').update({ status: 'revoked', released_at: now }).eq('device_id', body.deviceId).eq('status', 'active')
    return { deviceId: body.deviceId, status: 'revoked' }
  },
  async runRetention(_body, clients) {
    const now = new Date().toISOString()
    const { data: expired, error } = await clients.checkvan.from('checkvan_inspections')
      .select('id,storage_bucket,storage_object_path').eq('upload_status', 'available').eq('legal_hold', false).lte('retention_expires_at', now).limit(100)
    if (error) throw new Error('RETENTION_UNAVAILABLE')
    let deleted = 0
    for (const item of expired ?? []) {
      const { error: removeError } = await clients.checkvan.storage.from(item.storage_bucket).remove([item.storage_object_path])
      if (removeError) continue
      const { error: updateError } = await clients.checkvan.from('checkvan_inspections').update({ upload_status: 'deleted', deleted_at: now }).eq('id', item.id)
      if (!updateError) deleted += 1
    }
    return { inspected: expired?.length ?? 0, deleted, hasMore: (expired?.length ?? 0) === 100 }
  },
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  try {
    const clients = clientsFromEnvironment(); await authenticateAdmin(request, clients)
    const action = actions[request.body?.action]
    if (!action) return sendJson(response, 400, { error: 'INVALID_ADMIN_ACTION' })
    return sendJson(response, 200, await action(request.body, clients))
  } catch (error) { return sendError(response, error) }
}
