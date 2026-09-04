import { authenticateRequest, clientsFromEnvironment, resolveCompanyContext, sendError, sendJson } from './_lib/companyLicensing.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  const id = request.body?.id
  if (typeof id !== 'string') return sendJson(response, 400, { error: 'INVALID_INSPECTION_ID' })
  try {
    const clients = clientsFromEnvironment(); const user = await authenticateRequest(request, clients); const context = await resolveCompanyContext(user.id, clients)
    if (!context.capabilities.viewInspections || !context.organization) return sendJson(response, 403, { error: 'INSPECTIONS_FORBIDDEN' })
    const { data, error } = await clients.checkvan.from('checkvan_inspections').select('storage_bucket,storage_object_path').eq('id', id).eq('organization_id', context.organization.id).eq('upload_status', 'available').maybeSingle()
    if (error) throw new Error('INSPECTIONS_UNAVAILABLE')
    if (!data) return sendJson(response, 404, { error: 'INSPECTION_NOT_FOUND' })
    const { data: signed, error: signedError } = await clients.checkvan.storage.from(data.storage_bucket).createSignedUrl(data.storage_object_path, 300, { download: true })
    if (signedError) throw new Error('DOWNLOAD_UNAVAILABLE')
    return sendJson(response, 200, { url: signed.signedUrl, expiresIn: 300 })
  } catch (error) { return sendError(response, error) }
}
