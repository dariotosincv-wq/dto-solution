import { randomUUID } from 'node:crypto'
import { clientsFromEnvironment, sendError, sendJson } from './_lib/companyLicensing.js'
import { normalizePlate, validateInspectionInput } from './_lib/companyLicensingCore.js'
import { authenticateDeviceRequest, resolveDeviceContext } from './_lib/deviceAuthentication.js'

const BUCKET = 'checkvan-company-inspections'
const UPLOAD_SELECT = 'id,organization_id,device_id,device_generated_id,inspection_type,vehicle_id,driver_id,driver_first_name,driver_last_name,assignment_date,vehicle_plate_normalized,vehicle_description,inspection_cycle_id,inspected_at,device_timezone,document_hash,document_size_bytes,document_format_version,app_version,storage_bucket,storage_object_path,upload_status'

const nullable = (value) => value ?? null
const sameInstant = (left, right) => Number.isFinite(Date.parse(left)) && Date.parse(left) === Date.parse(right)

export function uploadMatchesExisting(inspection, body, device, context) {
  return inspection.device_id === device.id
    && inspection.organization_id === context.organization.id
    && inspection.device_generated_id.toLowerCase() === body.deviceGeneratedId.toLowerCase()
    && inspection.inspection_type === body.inspectionType
    && nullable(inspection.vehicle_id) === nullable(body.vehicleId)
    && nullable(inspection.driver_id) === nullable(body.driverId)
    && nullable(inspection.driver_first_name) === nullable(body.driverFirstName)
    && nullable(inspection.driver_last_name) === nullable(body.driverLastName)
    && nullable(inspection.assignment_date) === nullable(body.assignmentDate)
    && inspection.vehicle_plate_normalized === normalizePlate(body.vehiclePlate)
    && nullable(inspection.vehicle_description) === nullable(body.vehicleDescription)
    && nullable(inspection.inspection_cycle_id) === nullable(body.inspectionCycleId)
    && sameInstant(inspection.inspected_at, body.inspectedAt)
    && nullable(inspection.device_timezone) === nullable(body.deviceTimezone)
    && inspection.document_hash === body.documentHash
    && Number(inspection.document_size_bytes) === body.documentSizeBytes
    && nullable(inspection.document_format_version) === nullable(body.documentFormatVersion)
    && nullable(inspection.app_version) === nullable(body.appVersion)
}

async function findExisting(clients, deviceId, deviceGeneratedId) {
  const { data, error } = await clients.checkvan.from('checkvan_inspections').select(UPLOAD_SELECT)
    .eq('device_id', deviceId).eq('device_generated_id', deviceGeneratedId).maybeSingle()
  if (error) throw new Error('LICENSING_UNAVAILABLE')
  return data
}

async function uploadResponse(clients, inspection, recovered, tusEndpoint) {
  const { data: signed, error } = await clients.checkvan.storage.from(inspection.storage_bucket).createSignedUploadUrl(inspection.storage_object_path, { upsert: false })
  if (error) throw new Error('UPLOAD_AUTHORIZATION_FAILED')
  return {
    inspectionId: inspection.id,
    bucket: inspection.storage_bucket,
    objectPath: inspection.storage_object_path,
    uploadToken: signed.token,
    signedUploadUrl: tusEndpoint,
    protocol: 'tus',
    chunkSizeBytes: 6 * 1024 * 1024,
    status: inspection.upload_status,
    recovered,
  }
}

export async function handleDeviceInspectionUpload(request, response, dependencies = {}) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  const validation = validateInspectionInput(request.body)
  if (validation) return sendJson(response, 400, { error: validation })
  try {
    const clients = dependencies.clients ?? clientsFromEnvironment()
    const tusEndpoint = dependencies.tusEndpoint ?? process.env.CHECKVAN_STORAGE_TUS_URL
      ?? (process.env.CHECKVAN_SUPABASE_URL ? new URL('/storage/v1/upload/resumable', process.env.CHECKVAN_SUPABASE_URL).toString() : null)
    if (!tusEndpoint) throw new Error('SERVER_NOT_CONFIGURED')
    const authenticate = dependencies.authenticate ?? authenticateDeviceRequest
    const resolveContext = dependencies.resolveContext ?? resolveDeviceContext
    const device = await authenticate(request, clients)
    const context = await resolveContext(device, clients)
    if (request.body.vehicleId) {
      const { data: vehicle, error: vehicleError } = await clients.checkvan.from('checkvan_vehicles').select('id,internal_code,plate_normalized').eq('id', request.body.vehicleId).eq('organization_id', context.organization.id).eq('status', 'active').maybeSingle()
      if (vehicleError) throw new Error('VEHICLES_UNAVAILABLE')
      if (!vehicle || vehicle.internal_code !== request.body.vehicleDescription || vehicle.plate_normalized !== normalizePlate(request.body.vehiclePlate)) throw Object.assign(new Error('VEHICLE_SNAPSHOT_MISMATCH'), { status: 409 })
    }
    if (request.body.driverId) {
      const { data: driver, error: driverError } = await clients.checkvan.from('checkvan_drivers').select('id,first_name,last_name').eq('id', request.body.driverId).eq('organization_id', context.organization.id).maybeSingle()
      if (driverError) throw new Error('DRIVERS_UNAVAILABLE')
      if (!driver || driver.first_name !== request.body.driverFirstName || driver.last_name !== request.body.driverLastName) throw Object.assign(new Error('DRIVER_SNAPSHOT_MISMATCH'), { status: 409 })
    }
    const existing = await findExisting(clients, device.id, request.body.deviceGeneratedId)
    if (existing) {
      if (!uploadMatchesExisting(existing, request.body, device, context)) throw Object.assign(new Error('INSPECTION_CONFLICT'), { status: 409 })
      return sendJson(response, 200, await uploadResponse(clients, existing, true, tusEndpoint))
    }
    const inspectionId = (dependencies.randomUUID ?? randomUUID)()
    const date = request.body.inspectedAt.slice(0, 10).replaceAll('-', '/')
    const path = `organizations/${context.organization.id}/inspections/${date}/${inspectionId}/document.pdf`
    const now = dependencies.now?.() ?? Date.now()
    const retentionExpiresAt = new Date(now + context.organization.retention_days * 86400000).toISOString()
    const row = {
      id: inspectionId, organization_id: context.organization.id, license_id: context.assignment.license_id,
      founder_entitlement_id: context.assignment.founder_entitlement_id ?? null, device_id: device.id, device_assignment_id: context.assignment.id,
      device_generated_id: request.body.deviceGeneratedId, inspection_type: request.body.inspectionType,
      vehicle_id: request.body.vehicleId ?? null,
      driver_id: request.body.driverId ?? null, driver_first_name: request.body.driverFirstName ?? null,
      driver_last_name: request.body.driverLastName ?? null, assignment_date: request.body.assignmentDate ?? null,
      vehicle_plate: request.body.vehiclePlate.trim(), vehicle_plate_normalized: normalizePlate(request.body.vehiclePlate),
      vehicle_description: request.body.vehicleDescription ?? null, inspection_cycle_id: request.body.inspectionCycleId ?? null,
      inspected_at: request.body.inspectedAt, device_timezone: request.body.deviceTimezone ?? null,
      document_hash: request.body.documentHash, document_size_bytes: request.body.documentSizeBytes,
      storage_bucket: BUCKET, storage_object_path: path, upload_status: 'uploading', upload_started_at: new Date(now).toISOString(),
      upload_attempts: 1, document_format_version: request.body.documentFormatVersion ?? null,
      app_version: request.body.appVersion ?? null, retention_expires_at: retentionExpiresAt,
    }
    const { data: inspection, error: insertError } = await clients.checkvan.from('checkvan_inspections').insert(row).select(UPLOAD_SELECT).single()
    if (insertError) {
      const raced = await findExisting(clients, device.id, request.body.deviceGeneratedId)
      if (!raced) throw insertError
      if (!uploadMatchesExisting(raced, request.body, device, context)) throw Object.assign(new Error('INSPECTION_CONFLICT'), { status: 409 })
      return sendJson(response, 200, await uploadResponse(clients, raced, true, tusEndpoint))
    }
    return sendJson(response, 201, await uploadResponse(clients, inspection, false, tusEndpoint))
  } catch (error) { return sendError(response, error) }
}

export default function handler(request, response) {
  return handleDeviceInspectionUpload(request, response)
}
