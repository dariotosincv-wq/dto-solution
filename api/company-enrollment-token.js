import { enrollmentPayload } from './_lib/companyLicensingCore.js'
import { authenticateRequest, clientsFromEnvironment, resolveCompanyContext, sendError, sendJson } from './_lib/companyLicensing.js'

const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000

export default async function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  try {
    const clients = clientsFromEnvironment(); const user = await authenticateRequest(request, clients); const context = await resolveCompanyContext(user.id, clients)
    if (!context.capabilities.manageDevices) return sendJson(response, 403, { error: 'ENROLLMENT_FORBIDDEN' })
    if (context.devices.active >= context.devices.capacity) return sendJson(response, 409, { error: 'NO_DEVICE_SLOTS' })
    const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MS).toISOString()
    const rpc = context.entitlement?.founderId ? 'admin_reset_checkvan_founder_device' : 'admin_create_checkvan_enrollment_token'
    const args = context.entitlement?.founderId
      ? { p_founder_id: context.entitlement.founderId }
      : { p_license_id: context.license.id, p_expires_at: expiresAt }
    const { data: token, error } = await clients.checkvan.rpc(rpc, args)
    if (error || typeof token !== 'string' || token.length < 32) throw new Error('TOKEN_CREATION_FAILED')
    return sendJson(response, 201, { token, qrPayload: enrollmentPayload(token), expiresAt })
  } catch (error) { return sendError(response, error) }
}
