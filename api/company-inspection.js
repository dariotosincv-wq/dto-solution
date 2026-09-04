import { publicInspection } from './_lib/companyInspections.js'
import { authenticateRequest, clientsFromEnvironment, resolveCompanyContext, sendError, sendJson } from './_lib/companyLicensing.js'

export default async function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  const id = request.query.id
  if (typeof id !== 'string') return sendJson(response, 400, { error: 'INVALID_INSPECTION_ID' })
  try {
    const clients = clientsFromEnvironment(); const user = await authenticateRequest(request, clients); const context = await resolveCompanyContext(user.id, clients)
    if (!context.capabilities.viewInspections || !context.organization) return sendJson(response, 403, { error: 'INSPECTIONS_FORBIDDEN' })
    const { data, error } = await clients.checkvan.from('checkvan_inspections').select('*').eq('id', id).eq('organization_id', context.organization.id).eq('upload_status', 'available').maybeSingle()
    if (error) throw new Error('INSPECTIONS_UNAVAILABLE')
    if (!data) return sendJson(response, 404, { error: 'INSPECTION_NOT_FOUND' })
    return sendJson(response, 200, publicInspection(data))
  } catch (error) { return sendError(response, error) }
}
