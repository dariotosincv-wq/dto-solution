import { createClient } from '@supabase/supabase-js'
import { capabilitiesFor, deriveLicenseState, effectiveEntitlement, membershipAllowed, publicDevice } from './companyLicensingCore.js'

function serverClient(url, key) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

export function clientsFromEnvironment() {
  const dtoUrl = process.env.DTO_SUPABASE_URL
  const dtoKey = process.env.DTO_SUPABASE_ANON_KEY
  const checkvanUrl = process.env.CHECKVAN_SUPABASE_URL
  const checkvanKey = process.env.CHECKVAN_SUPABASE_SERVICE_ROLE_KEY
  if (!dtoUrl || !dtoKey || !checkvanUrl || !checkvanKey) throw new Error('SERVER_NOT_CONFIGURED')
  return { dto: serverClient(dtoUrl, dtoKey), checkvan: serverClient(checkvanUrl, checkvanKey) }
}

export function bearerToken(request) {
  return request.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1] ?? null
}

export async function authenticateRequest(request, clients) {
  const token = bearerToken(request)
  if (!token) throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 })
  const { data, error } = await clients.dto.auth.getUser(token)
  if (error || !data.user?.id) throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 })
  return data.user
}

export async function resolveCompanyContext(authSubject, clients) {
  const { data: membership, error: membershipError } = await clients.checkvan.from('checkvan_area_memberships').select('id,auth_subject,organization_id,role,status').eq('auth_subject', authSubject).maybeSingle()
  if (membershipError) throw new Error('LICENSING_UNAVAILABLE')
  if (!membership) throw Object.assign(new Error('MEMBERSHIP_REQUIRED'), { status: 403 })
  if (!membershipAllowed(membership)) throw Object.assign(new Error('MEMBERSHIP_DENIED'), { status: 403 })

  if (membership.role === 'UNION_GUEST') return { membership, organization: null, license: null, state: 'union_guest', entitlement: { source: 'guest', cloudEnabled: false }, capabilities: { ...capabilitiesFor(membership.role, true), uploadInspections: false }, devices: null }

  const { data: organization, error: organizationError } = await clients.checkvan.from('checkvan_organizations').select('id,name,status').eq('id', membership.organization_id).maybeSingle()
  if (organizationError) throw new Error('LICENSING_UNAVAILABLE')
  const { data: licenses, error: licensesError } = await clients.checkvan.from('checkvan_licenses').select('id,organization_id,kind,product_mode,cloud_enabled,access_grant,status,capacity,starts_at,ends_at').eq('organization_id', membership.organization_id).order('starts_at', { ascending: false })
  if (licensesError) throw new Error('LICENSING_UNAVAILABLE')

  const { data: founders, error: grantsError } = await clients.checkvan.from('checkvan_founder_entitlements')
    .select('id,status,starts_at,ends_at,device_capacity').eq('organization_id', membership.organization_id).eq('auth_subject', authSubject)
  if (grantsError) throw new Error('LICENSING_UNAVAILABLE')
  const grants = (founders ?? []).map((grant) => ({ ...grant, grant_type: 'FOUNDER' }))
  const licenseState = deriveLicenseState(organization, licenses ?? [])
  const effective = effectiveEntitlement(licenseState, grants)
  const entitlement = { ...licenseState, valid: effective.valid }
  let activeDevices = 0
  if (effective.grant) {
    const { count, error } = await clients.checkvan.from('checkvan_founder_entitlements').select('id', { count: 'exact', head: true }).eq('id', effective.grant.id).not('device_id', 'is', null).eq('status', 'active')
    if (error) throw new Error('LICENSING_UNAVAILABLE')
    activeDevices = count ?? 0
  } else if (entitlement.license) {
    const { count, error } = await clients.checkvan.from('checkvan_device_assignments').select('id', { count: 'exact', head: true }).eq('license_id', entitlement.license.id).eq('status', 'active')
    if (error) throw new Error('LICENSING_UNAVAILABLE')
    activeDevices = count ?? 0
  }
  const capacity = effective.grant ? effective.grant.device_capacity : (entitlement.license?.capacity ?? 0)
  return {
    membership, organization, license: entitlement.license, state: ['founder', 'tester'].includes(effective.source) ? effective.source : entitlement.state,
    entitlement: { founderId: effective.grant?.id ?? null, source: effective.source, cloudEnabled: effective.cloudEnabled },
    capabilities: { ...capabilitiesFor(membership.role, entitlement.valid), uploadInspections: effective.cloudEnabled },
    devices: { active: activeDevices, capacity, available: Math.max(0, capacity - activeDevices) },
  }
}

export async function listCompanyDevices(context, clients) {
  if (context.entitlement?.founderId) {
    const { data: founder, error } = await clients.checkvan.from('checkvan_founder_entitlements').select('device_id,consumed_at,status,revoked_at').eq('id', context.entitlement.founderId).maybeSingle()
    if (error) throw new Error('LICENSING_UNAVAILABLE')
    if (!founder?.device_id) return []
    const { data: device, error: deviceError } = await clients.checkvan.from('checkvan_license_devices').select('id,last_validated_at').eq('id', founder.device_id).maybeSingle()
    if (deviceError || !device) throw new Error('LICENSING_UNAVAILABLE')
    return [publicDevice({ status: founder.status, assigned_at: founder.consumed_at, released_at: founder.revoked_at }, device, 0)]
  }
  if (!context.license?.id) return []
  const { data: assignments, error } = await clients.checkvan.from('checkvan_device_assignments').select('id,device_id,status,assigned_at,released_at').eq('license_id', context.license.id).order('assigned_at', { ascending: true })
  if (error) throw new Error('LICENSING_UNAVAILABLE')
  const ids = [...new Set((assignments ?? []).map((item) => item.device_id))]
  if (!ids.length) return []
  const { data: devices, error: deviceError } = await clients.checkvan.from('checkvan_license_devices').select('id,last_validated_at').in('id', ids)
  if (deviceError) throw new Error('LICENSING_UNAVAILABLE')
  const byId = new Map(devices.map((device) => [device.id, device]))
  return assignments.flatMap((assignment, index) => byId.has(assignment.device_id) ? [publicDevice(assignment, byId.get(assignment.device_id), index)] : [])
}

export function sendJson(response, status, body) {
  return response.status(status).setHeader('Cache-Control', 'private, no-store').json(body)
}

export function sendError(response, error) {
  const status = error.status || (error.message === 'SERVER_NOT_CONFIGURED' || error.message === 'LICENSING_UNAVAILABLE' ? 503 : 500)
  return sendJson(response, status, { error: status === 500 ? 'INTERNAL_ERROR' : error.message })
}
