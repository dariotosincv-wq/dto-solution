import { clientsFromEnvironment, sendError, sendJson } from './_lib/companyLicensing.js'
import { authenticateDeviceRequest, resolveDeviceContext } from './_lib/deviceAuthentication.js'

export async function handleDeviceInspectionFinalize(request, response, dependencies = {}) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  const { inspectionId } = request.body ?? {}
  if (typeof inspectionId !== 'string') return sendJson(response, 400, { error: 'INVALID_INSPECTION_ID' })
  try {
    const clients = dependencies.clients ?? clientsFromEnvironment()
    const authenticate = dependencies.authenticate ?? authenticateDeviceRequest
    const resolveContext = dependencies.resolveContext ?? resolveDeviceContext
    const device = await authenticate(request, clients); const context = await resolveContext(device, clients)
    const { data: inspection, error } = await clients.checkvan.from('checkvan_inspections').select('id,storage_bucket,storage_object_path,document_size_bytes,upload_status,finalized_at')
      .eq('id', inspectionId).eq('device_id', device.id).eq('organization_id', context.organization.id).maybeSingle()
    if (error) throw new Error('LICENSING_UNAVAILABLE')
    if (!inspection) throw Object.assign(new Error('INSPECTION_NOT_FOUND'), { status: 404 })
    if (inspection.upload_status === 'available') return sendJson(response, 200, { inspectionId, status: 'available', finalizedAt: inspection.finalized_at })
    const parts = inspection.storage_object_path.split('/'); const fileName = parts.pop(); const folder = parts.join('/')
    const { data: objects, error: storageError } = await clients.checkvan.storage.from(inspection.storage_bucket).list(folder, { search: fileName, limit: 2 })
    const object = objects?.find((item) => item.name === fileName)
    if (storageError || !object) throw Object.assign(new Error('UPLOAD_NOT_FOUND'), { status: 409 })
    if (Number(object.metadata?.size) !== Number(inspection.document_size_bytes)) throw Object.assign(new Error('UPLOAD_SIZE_MISMATCH'), { status: 409 })
    const now = new Date(dependencies.now?.() ?? Date.now()).toISOString()
    const { error: updateError } = await clients.checkvan.from('checkvan_inspections').update({ upload_status: 'available', uploaded_at: now, finalized_at: now, last_upload_error_code: null }).eq('id', inspection.id).eq('upload_status', 'uploading')
    if (updateError) throw new Error('FINALIZATION_FAILED')
    await clients.checkvan.from('checkvan_license_devices').update({ last_validated_at: now }).eq('id', device.id)
    return sendJson(response, 200, { inspectionId, status: 'available', finalizedAt: now })
  } catch (error) { return sendError(response, error) }
}

export default function handler(request, response) {
  return handleDeviceInspectionFinalize(request, response)
}
