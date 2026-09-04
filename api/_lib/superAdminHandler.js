import { clientsFromEnvironment } from './companyLicensing.js'
import { applySuperAdminHeaders, auditAdmin, authenticateSuperAdmin, enforceRateLimit, redactDevice, safeQuery, syncHealth } from './superAdmin.js'

const select = async (client, table, columns, limit = 500) => {
  const { data, error } = await client.from(table).select(columns).limit(limit)
  if (error) throw new Error('SUPER_ADMIN_DATA_UNAVAILABLE')
  return data ?? []
}
const byId = (rows) => new Map(rows.map((row) => [row.id, row]))

async function snapshot(clients) {
  const [organizations, licenses, devices, assignments, inspections, enrollments] = await Promise.all([
    select(clients.checkvan, 'checkvan_organizations', 'id,name,status,organization_type,created_at,retention_days'),
    select(clients.checkvan, 'checkvan_licenses', 'id,organization_id,kind,status,capacity,starts_at,ends_at,access_grant,cloud_enabled'),
    select(clients.checkvan, 'checkvan_license_devices', 'id,status,created_at,last_validated_at,revoked_at'),
    select(clients.checkvan, 'checkvan_device_assignments', 'id,license_id,device_id,status,assigned_at,released_at'),
    select(clients.checkvan, 'checkvan_inspections', 'id,organization_id,license_id,device_id,inspection_type,vehicle_plate,vehicle_description,inspected_at,upload_status,document_size_bytes,upload_attempts,upload_started_at,uploaded_at,finalized_at,last_upload_error_code,created_at'),
    select(clients.checkvan, 'checkvan_enrollment_tokens', 'id,license_id,expires_at,used_at,revoked_at,created_at'),
  ])
  return { organizations, licenses, devices, assignments, inspections, enrollments }
}

function organizationsView(data) {
  return data.organizations.map((organization) => {
    const licenses = data.licenses.filter((item) => item.organization_id === organization.id)
    const licenseIds = new Set(licenses.map((item) => item.id))
    const assignments = data.assignments.filter((item) => licenseIds.has(item.license_id) && item.status === 'active')
    const inspections = data.inspections.filter((item) => item.organization_id === organization.id)
    const license = licenses.sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at))[0] ?? null
    const anomalies = inspections.filter((item) => syncHealth(item).level === 'error').length
    return { ...organization, license, devicesUsed: assignments.length, inspectionsRecent: inspections.filter((item) => Date.now() - Date.parse(item.inspected_at) <= 7 * 86400000).length, lastActivityAt: inspections.sort((a, b) => Date.parse(b.inspected_at) - Date.parse(a.inspected_at))[0]?.inspected_at ?? null, health: anomalies ? 'error' : 'ok', anomalies }
  })
}

async function readResource(resource, request, clients, admin) {
  if (resource === 'access') { await auditAdmin(clients, admin, 'ACCESS'); return { admin } }
  const data = await snapshot(clients); const query = safeQuery(request.query); const organizations = organizationsView(data); const orgs = byId(data.organizations); const licenses = byId(data.licenses)
  if (resource === 'dashboard') {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const health = data.inspections.map(syncHealth)
    return { organizations: { total: organizations.length, active: organizations.filter((x) => x.status === 'active').length, trial: organizations.filter((x) => x.license?.access_grant === 'TRIAL').length, suspended: organizations.filter((x) => x.status === 'suspended').length }, devices: { total: data.devices.length, active: data.devices.filter((x) => x.status === 'active').length, revoked: data.devices.filter((x) => x.status === 'revoked').length, enrollmentPending: data.enrollments.filter((x) => !x.used_at && !x.revoked_at && Date.parse(x.expires_at) > Date.now()).length }, inspections: { today: data.inspections.filter((x) => Date.parse(x.inspected_at) >= today.getTime()).length, last24h: data.inspections.filter((x) => Date.now() - Date.parse(x.inspected_at) <= 86400000).length, available: data.inspections.filter((x) => x.upload_status === 'available').length, uploading: data.inspections.filter((x) => x.upload_status === 'uploading').length }, health: { ok: health.filter((x) => x.level === 'ok').length, warning: health.filter((x) => x.level === 'warning').length, error: health.filter((x) => x.level === 'error').length }, attention: organizations.filter((x) => x.health !== 'ok').slice(0, 10) }
  }
  if (resource === 'organizations') return { items: organizations.filter((x) => (!query.search || x.name.toLowerCase().includes(query.search.toLowerCase())) && (!query.status || x.status === query.status) && (!query.mode || x.license?.access_grant === query.mode)).slice(0, query.limit) }
  if (resource === 'organization') {
    const item = organizations.find((x) => x.id === query.organizationId)
    if (!item) throw Object.assign(new Error('NOT_FOUND'), { status: 404 })
    const inspections = data.inspections.filter((x) => x.organization_id === item.id); const licenseIds = new Set(data.licenses.filter((x) => x.organization_id === item.id).map((x) => x.id)); const devices = data.assignments.filter((x) => licenseIds.has(x.license_id)).map((x) => ({ ...x, device: redactDevice(data.devices.find((d) => d.id === x.device_id) ?? {}) }))
    return { item, licenses: data.licenses.filter((x) => x.organization_id === item.id), devices, inspections: { total: inspections.length, today: inspections.filter((x) => Date.now() - Date.parse(x.inspected_at) < 86400000).length, available: inspections.filter((x) => x.upload_status === 'available').length, anomalies: inspections.filter((x) => syncHealth(x).level === 'error').length } }
  }
  if (resource === 'devices') return { items: data.assignments.map((assignment) => ({ ...redactDevice(data.devices.find((x) => x.id === assignment.device_id) ?? {}), assignmentStatus: assignment.status, assignedAt: assignment.assigned_at, organization: orgs.get(licenses.get(assignment.license_id)?.organization_id)?.name ?? '—', organizationId: licenses.get(assignment.license_id)?.organization_id, license: licenses.get(assignment.license_id)?.access_grant ?? '—' })).filter((x) => (!query.organizationId || x.organizationId === query.organizationId) && (!query.status || x.status === query.status)).slice(0, query.limit) }
  if (resource === 'synchronizations') return { items: data.inspections.filter((x) => (!query.organizationId || x.organization_id === query.organizationId) && (!query.status || x.upload_status === query.status)).sort((a, b) => Date.parse(b.inspected_at) - Date.parse(a.inspected_at)).slice(0, query.limit).map((x) => ({ ...x, organization: orgs.get(x.organization_id)?.name ?? '—', health: syncHealth(x) })) }
  if (resource === 'audit') { const rows = await select(clients.checkvan, 'checkvan_license_audit', 'id,event_type,organization_id,license_id,device_id,metadata,created_at', query.limit); return { items: rows.filter((x) => !query.organizationId || x.organization_id === query.organizationId).map((x) => ({ ...x, organization: orgs.get(x.organization_id)?.name ?? '—', metadata: { result: x.metadata?.result ?? null, actorSubject: x.metadata?.actor_subject ?? null } })) } }
  throw Object.assign(new Error('NOT_FOUND'), { status: 404 })
}

async function mutate(request, clients, admin) {
  const body = request.body ?? {}; const organizationId = /^[0-9a-f-]{36}$/i.test(body.organizationId ?? '') ? body.organizationId : null
  if (body.action === 'UPDATE_ORGANIZATION' && organizationId && ['active', 'suspended'].includes(body.status)) {
    const { data, error } = await clients.checkvan.from('checkvan_organizations').update({ status: body.status, updated_at: new Date().toISOString() }).eq('id', organizationId).select('id,name,status').single()
    if (error) throw new Error('ADMIN_UPDATE_FAILED'); await auditAdmin(clients, admin, 'ORGANIZATION_UPDATED', { organizationId }); return data
  }
  if (body.action === 'UPDATE_LICENSE' && organizationId && /^[0-9a-f-]{36}$/i.test(body.licenseId ?? '') && ['active', 'suspended', 'expired', 'revoked'].includes(body.status) && Number.isInteger(body.capacity) && body.capacity > 0 && body.capacity <= 10000) {
    const endsAt = body.endsAt == null || body.endsAt === '' ? null : new Date(body.endsAt)
    if (endsAt && Number.isNaN(endsAt.getTime())) throw Object.assign(new Error('INVALID_LICENSE_END_DATE'), { status: 400 })
    const update = { status: body.status, capacity: body.capacity, ends_at: endsAt?.toISOString() ?? null, updated_at: new Date().toISOString() }
    const { data, error } = await clients.checkvan.from('checkvan_licenses').update(update).eq('id', body.licenseId).eq('organization_id', organizationId).select('id,status,capacity,ends_at').single()
    if (error) throw new Error('ADMIN_UPDATE_FAILED'); await auditAdmin(clients, admin, 'LICENSE_UPDATED', { organizationId, licenseId: body.licenseId }); return data
  }
  if (body.action === 'REVOKE_DEVICE' && /^[0-9a-f-]{36}$/i.test(body.deviceId ?? '')) {
    const now = new Date().toISOString(); const { data: device, error } = await clients.checkvan.from('checkvan_license_devices').update({ status: 'revoked', revoked_at: now }).eq('id', body.deviceId).eq('status', 'active').select('id').maybeSingle()
    if (error) throw new Error('ADMIN_UPDATE_FAILED'); if (!device) throw Object.assign(new Error('DEVICE_NOT_ACTIVE'), { status: 409 }); await clients.checkvan.from('checkvan_device_assignments').update({ status: 'revoked', released_at: now }).eq('device_id', body.deviceId).eq('status', 'active'); await auditAdmin(clients, admin, 'DEVICE_REVOKED', { deviceId: body.deviceId }); return { id: body.deviceId, status: 'revoked' }
  }
  throw Object.assign(new Error('INVALID_ADMIN_ACTION'), { status: 400 })
}

export default async function handler(request, response) {
  applySuperAdminHeaders(response)
  try {
    enforceRateLimit(request); const clients = clientsFromEnvironment(); const admin = await authenticateSuperAdmin(request, clients)
    if (request.method === 'GET') return response.status(200).json(await readResource(String(request.query.adminResource ?? request.query.resource ?? 'dashboard'), request, clients, admin))
    if (request.method === 'PATCH') return response.status(200).json(await mutate(request, clients, admin))
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  } catch (error) { const status = error.status ?? (error.message.endsWith('_UNAVAILABLE') ? 503 : 500); return response.status(status).json({ error: status >= 500 ? 'INTERNAL_ERROR' : error.message }) }
}
