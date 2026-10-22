import { authenticateRequest, clientsFromEnvironment, listCompanyDevices, resolveCompanyContext, sendError, sendJson } from './companyLicensing.js'

const uuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

function revocationInput(body = {}) {
  const deviceId = body.device_id
  const reason = typeof body.reason === 'string' ? body.reason.trim() || null : null
  if (!uuid(deviceId) || (body.reason != null && typeof body.reason !== 'string') || reason?.length > 500) {
    throw Object.assign(new Error('INVALID_DEVICE_REVOCATION_INPUT'), { status: 400 })
  }
  return { deviceId, reason }
}

export default async function companyDevices(request, response) {
  if (!['GET', 'PATCH'].includes(request.method)) return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  try {
    const clients = clientsFromEnvironment(); const user = await authenticateRequest(request, clients); const context = await resolveCompanyContext(user.id, clients)
    if (!context.capabilities.manageDevices) return sendJson(response, 403, { error: 'DEVICE_MANAGEMENT_FORBIDDEN' })
    if (request.method === 'GET') {
      const items = await listCompanyDevices(context, clients)
      return sendJson(response, 200, { ...context.devices, items })
    }
    const input = revocationInput(request.body)
    const { data, error } = await clients.checkvan.rpc('internal_admin_revoke_company_device', {
      p_auth_subject: user.id,
      p_organization_id: context.organization.id,
      p_device_id: input.deviceId,
      p_reason: input.reason,
    })
    if (error) {
      const safe = ['COMPANY_ADMIN_REQUIRED', 'DEVICE_NOT_ASSIGNED', 'INVALID_DEVICE_REVOCATION_INPUT', 'INVALID_REVOCATION_REASON']
      throw Object.assign(new Error(safe.includes(error.message) ? error.message : 'DEVICE_REVOCATION_UNAVAILABLE'), { status: error.message === 'COMPANY_ADMIN_REQUIRED' ? 403 : error.message === 'DEVICE_NOT_ASSIGNED' ? 404 : error.message?.startsWith('INVALID_') ? 400 : 503 })
    }
    return sendJson(response, 200, data)
  } catch (error) { return sendError(response, error) }
}
