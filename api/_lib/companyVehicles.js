import { normalizePlate } from './companyLicensingCore.js'

export const DAMAGE_TYPES = new Set(['SCRATCH', 'DENT'])
export const DAMAGE_VIEWS = new Set(['FRONT', 'LEFT', 'REAR', 'RIGHT'])
export const SILHOUETTES = new Set(['EXTRA_SMALL', 'SMALL', 'MEDIUM', 'LARGE'])
export const uuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
export const coordinate = (value) => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1
export function vehicleInput(body = {}) {
  const internalCode = typeof body.internal_code === 'string' ? body.internal_code.trim().toUpperCase() : ''
  const plate = typeof body.plate === 'string' ? body.plate.trim().toUpperCase() : ''
  const plateNormalized = normalizePlate(plate)
  const category = typeof body.silhouette_category === 'string' ? body.silhouette_category.trim().toUpperCase() : ''
  if (!internalCode || internalCode.length > 80 || !plateNormalized || !SILHOUETTES.has(category)) throw Object.assign(new Error('INVALID_VEHICLE'), { status: 400 })
  return { internal_code: internalCode, plate, plate_normalized: plateNormalized, silhouette_category: category, status: body.status === 'inactive' ? 'inactive' : 'active' }
}
export function vehicleBatchInput(body = {}) {
  if (!Array.isArray(body.vehicles) || body.vehicles.length < 1 || body.vehicles.length > 500) throw Object.assign(new Error('INVALID_VEHICLE_BATCH'), { status: 400 })
  return body.vehicles.map((vehicle) => vehicleInput(vehicle))
}
export function damageInput(body = {}) {
  if (!DAMAGE_TYPES.has(body.damage_type) || !DAMAGE_VIEWS.has(body.vehicle_view) || !coordinate(body.normalized_x) || !coordinate(body.normalized_y)) throw Object.assign(new Error('INVALID_DAMAGE'), { status: 400 })
  return { damage_type: body.damage_type, vehicle_view: body.vehicle_view, x: Number(body.normalized_x), y: Number(body.normalized_y) }
}
export function damagePhotoInput(body = {}) {
  const hash = typeof body.photo_hash === 'string' ? body.photo_hash.toLowerCase() : ''
  const size = Number(body.photo_size_bytes)
  const mime = body.photo_mime_type
  if (!uuid(body.client_generated_id) || !/^[0-9a-f]{64}$/.test(hash) || !Number.isSafeInteger(size) || size < 1 || size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw Object.assign(new Error('INVALID_DAMAGE_PHOTO'), { status: 400 })
  return { client_generated_id: body.client_generated_id, photo_hash: hash, photo_size_bytes: size, photo_mime_type: mime, description: typeof body.description === 'string' ? body.description.trim().slice(0, 1000) || null : null }
}
export const publicVehicle = (row) => ({ vehicle_id: row.id, internal_code: row.internal_code, plate: row.plate, silhouette_category: row.silhouette_category, status: row.status, archived_at: row.archived_at ?? null, created_at: row.created_at, updated_at: row.updated_at })
export const publicDamage = (row) => ({ damage_id: row.id, vehicle_id: row.vehicle_id, damage_type: row.damage_type, vehicle_view: row.vehicle_view, normalized_x: Number(row.normalized_x), normalized_y: Number(row.normalized_y), status: row.status, description: row.description, photo_available: row.photo_upload_status === 'AVAILABLE', photo_upload_status: row.photo_upload_status, reported_by_device_id: row.reported_by_device_id, reported_at: row.reported_at, submitted_at: row.submitted_at, source_inspection_id: row.source_inspection_id, confirmed_at: row.confirmed_at, rejected_at: row.rejected_at, repaired_at: row.repaired_at, removed_at: row.removed_at, decided_at: row.decided_at, decision_note: row.decision_note, created_at: row.created_at, updated_at: row.updated_at })
export function requireCompanyAdmin(context) { if (context.membership?.role !== 'COMPANY_ADMIN' || !context.organization) throw Object.assign(new Error('COMPANY_ADMIN_REQUIRED'), { status: 403 }) }
