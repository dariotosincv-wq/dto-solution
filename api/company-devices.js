import { authenticateRequest, clientsFromEnvironment, listCompanyDevices, resolveCompanyContext, sendError, sendJson } from './_lib/companyLicensing.js'

export default async function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  try {
    const clients = clientsFromEnvironment(); const user = await authenticateRequest(request, clients); const context = await resolveCompanyContext(user.id, clients)
    if (!context.capabilities.manageDevices) return sendJson(response, 403, { error: 'DEVICE_MANAGEMENT_FORBIDDEN' })
    const items = await listCompanyDevices(context, clients)
    return sendJson(response, 200, { ...context.devices, items })
  } catch (error) { return sendError(response, error) }
}
