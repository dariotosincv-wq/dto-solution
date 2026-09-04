import { normalizePlate } from './companyLicensingCore.js'

export function inspectionListQuery(query = {}) {
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 50))
  const page = Math.max(0, Number.parseInt(query.page, 10) || 0)
  return {
    limit, from: page * limit, to: page * limit + limit - 1,
    dateFrom: /^\d{4}-\d{2}-\d{2}$/.test(query.dateFrom ?? '') ? `${query.dateFrom}T00:00:00.000Z` : null,
    dateTo: /^\d{4}-\d{2}-\d{2}$/.test(query.dateTo ?? '') ? `${query.dateTo}T23:59:59.999Z` : null,
    plate: normalizePlate(query.plate),
    inspectionType: ['pickup', 'return'].includes(query.inspectionType) ? query.inspectionType : null,
  }
}

export function publicInspection(row) {
  return {
    id: row.id, inspectionType: row.inspection_type, vehiclePlate: row.vehicle_plate,
    vehicleDescription: row.vehicle_description, inspectionCycleId: row.inspection_cycle_id,
    inspectedAt: row.inspected_at, deviceTimezone: row.device_timezone, status: row.upload_status,
    documentHash: row.document_hash, documentSizeBytes: row.document_size_bytes,
    deviceId: row.device_id, finalizedAt: row.finalized_at, retentionExpiresAt: row.retention_expires_at,
  }
}
