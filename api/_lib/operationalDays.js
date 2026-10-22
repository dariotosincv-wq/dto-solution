import { uuid } from './companyVehicles.js'

const statuses = new Set(['TURNO', 'RIPOSO', 'FERIE', 'PERMESSO', 'MALATTIA', 'ALTRO'])
const invalid = (message = 'INVALID_OPERATIONAL_DAY_INPUT') => { throw Object.assign(new Error(message), { status: 400 }) }
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
const optionalText = (value, max) => value == null || value === '' ? null : typeof value === 'string' && value.trim().length <= max ? value.trim() : undefined
const optionalInteger = (value, min, max) => value == null || value === '' ? null : Number.isInteger(value) && value >= min && value <= max ? value : undefined

export function operationalDayInput(body = {}) {
  if (!date(body.operating_date) || !uuid(body.idempotency_key) || !['CONFIRM', 'CORRECT', 'CONFIRM_PARTIAL'].includes(body.action) || !Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 1000) invalid()
  const correction_reason = optionalText(body.correction_reason, 1000)
  if ((body.action === 'CORRECT' && !correction_reason) || ((body.action === 'CONFIRM' || body.action === 'CONFIRM_PARTIAL') && correction_reason !== null)) invalid(body.action === 'CORRECT' ? 'CORRECTION_REASON_REQUIRED' : undefined)
  const rows = body.rows.map(row => {
    if (!row || !uuid(row.driver_id) || !statuses.has(row.work_status)) invalid('INVALID_OPERATIONAL_DAY_ROW')
    const vehicle_id = row.vehicle_id == null || row.vehicle_id === '' ? null : uuid(row.vehicle_id) ? row.vehicle_id : undefined
    const route = optionalText(row.route, 100), notes = optionalText(row.notes, 2000)
    const source = row.source == null || row.source === '' ? 'manual' : row.source === 'manual' ? 'manual' : undefined
    const departure_order = optionalInteger(row.departure_order, 1, 10000)
    const departure_group = optionalInteger(row.departure_group, 1, 10000)
    const parking_lot_position = optionalInteger(row.parking_lot_position, 0, 10000)
    const departure_wave = optionalInteger(row.departure_wave, 1, 10000)
    if (vehicle_id === undefined || route === undefined || notes === undefined || departure_order === undefined || departure_group === undefined || parking_lot_position === undefined || departure_wave === undefined || source === undefined) invalid('INVALID_OPERATIONAL_DAY_ROW')
    if (row.work_status === 'TURNO' && !vehicle_id) invalid('OPERATIONAL_TURNO_VEHICLE_REQUIRED')
    if (row.work_status !== 'TURNO' && (vehicle_id || route || departure_order || departure_group || parking_lot_position !== null || departure_wave)) invalid('OPERATIONAL_ABSENCE_FIELDS_FORBIDDEN')
    return { driver_id: row.driver_id, work_status: row.work_status, vehicle_id, route, departure_order, departure_group, parking_lot_position, departure_wave, source, notes }
  })
  const anomalies = body.action === 'CONFIRM_PARTIAL'
    ? (() => {
        if (!Array.isArray(body.anomalies) || body.anomalies.length < 1 || body.anomalies.length > 1000) invalid('INVALID_OPERATIONAL_PARTIAL_INPUT')
        return body.anomalies.map(item => {
          if (!item || !uuid(item.client_row_id) || !['DRIVER_MISSING','DRIVER_ARCHIVED','DRIVER_AMBIGUOUS','VEHICLE_MISSING','MATCH_AMBIGUOUS','ROW_INCOMPLETE'].includes(item.reason_code)) invalid('INVALID_OPERATIONAL_ANOMALY')
          const normalized = value => optionalText(value, 100)
          const departure_order = optionalInteger(item.departure_order, 1, 10000)
          const departure_group = optionalInteger(item.departure_group, 1, 10000)
          const parking_lot_position = optionalInteger(item.parking_lot_position, 0, 10000)
          const departure_wave = optionalInteger(item.departure_wave, 1, 10000)
          const driver_id = item.driver_id == null ? null : uuid(item.driver_id) ? item.driver_id : undefined
          const vehicle_id = item.vehicle_id == null ? null : uuid(item.vehicle_id) ? item.vehicle_id : undefined
          if ([normalized(item.driver_name_key), normalized(item.vehicle_internal_code_key), normalized(item.vehicle_plate_key), optionalText(item.route, 100), departure_order, departure_group, parking_lot_position, departure_wave, driver_id, vehicle_id].includes(undefined)) invalid('INVALID_OPERATIONAL_ANOMALY')
          return { client_row_id:item.client_row_id, reason_code:item.reason_code, driver_id, vehicle_id, driver_name_key:normalized(item.driver_name_key), vehicle_internal_code_key:normalized(item.vehicle_internal_code_key), vehicle_plate_key:normalized(item.vehicle_plate_key), route:optionalText(item.route,100), departure_order, departure_group, parking_lot_position, departure_wave }
        })
      })()
    : undefined
  return { action: body.action, operating_date: body.operating_date, idempotency_key: body.idempotency_key, correction_reason: correction_reason ?? null, rows, ...(anomalies ? { anomalies } : {}) }
}

export async function confirmOperationalDay(client, organizationId, userId, body) {
  const input = operationalDayInput(body)
  const rpc = input.action === 'CONFIRM_PARTIAL' ? 'internal_admin_confirm_operational_day_partial' : 'internal_admin_confirm_operational_day'
  const { data, error } = await client.rpc(rpc, { p_auth_subject: userId, p_organization_id: organizationId, p_input: input })
  if (error) throw Object.assign(new Error(error.message), { status: error.message === 'OPERATIONAL_DAY_ALREADY_CONFIRMED' ? 409 : 400 })
  return data
}

export async function readOperationalDayAnomalies(client, organizationId, userId, operatingDate) {
  if (!date(operatingDate)) invalid('INVALID_OPERATIONAL_DAY_DATE')
  const { data, error } = await client.rpc('internal_read_operational_day_anomalies', { p_auth_subject: userId, p_organization_id: organizationId, p_date: operatingDate })
  if (error) throw Object.assign(new Error('OPERATIONAL_ANOMALIES_UNAVAILABLE'), { status: 503 })
  return { items: data ?? [] }
}

export async function resolveOperationalDayAnomaly(client, organizationId, userId, body = {}) {
  if (!uuid(body.anomaly_id) || !['RESOLVE', 'EXCLUDE'].includes(body.action)) invalid('INVALID_OPERATIONAL_ANOMALY_RESOLUTION')
  const input = { anomaly_id: body.anomaly_id, action: body.action }
  if (body.action === 'RESOLVE') {
    if (!uuid(body.idempotency_key) || !uuid(body.driver_id) || !uuid(body.vehicle_id)) invalid('INVALID_OPERATIONAL_ANOMALY_RESOLUTION')
    Object.assign(input, { idempotency_key: body.idempotency_key, driver_id: body.driver_id, vehicle_id: body.vehicle_id })
  } else {
    const reason = optionalText(body.exclusion_reason, 1000)
    if (!reason) invalid('EXCLUSION_REASON_REQUIRED')
    input.exclusion_reason = reason
  }
  const { data, error } = await client.rpc('internal_admin_resolve_operational_day_anomaly', { p_auth_subject: userId, p_organization_id: organizationId, p_input: input })
  if (error) throw Object.assign(new Error(error.message), { status: error.message === 'OPERATIONAL_ANOMALY_CONFLICT' ? 409 : 400 })
  return data
}

export async function readCurrentOperationalDay(client, organizationId, operatingDate) {
  if (!date(operatingDate)) invalid('INVALID_OPERATIONAL_DAY_DATE')
  const { data, error } = await client.rpc('internal_read_current_operational_day', { p_organization_id: organizationId, p_date: operatingDate })
  if (error) throw Object.assign(new Error('OPERATIONAL_DAY_UNAVAILABLE'), { status: 503 })
  return data === null ? { day: null, rows: [] } : data
}

export async function startOperationalDepartureQueue(client, organizationId, userId, body = {}) {
  if (!date(body.operating_date) || !Number.isInteger(body.timeout_seconds) || body.timeout_seconds < 10 || body.timeout_seconds > 600) invalid('INVALID_DEPARTURE_QUEUE_INPUT')
  const { data, error } = await client.rpc('internal_admin_start_operational_departure_queue', { p_auth_subject: userId, p_organization_id: organizationId, p_date: body.operating_date, p_timeout_seconds: body.timeout_seconds })
  if (error) throw Object.assign(new Error(error.message), { status: error.message === 'COMPANY_ADMIN_REQUIRED' ? 403 : error.message === 'OPERATIONAL_DEPARTURE_CRON_UNAVAILABLE' ? 503 : 409 })
  return data
}
export async function readOperationalDepartureQueue(client, organizationId, userId, operatingDate) {
  if (!date(operatingDate)) invalid('INVALID_OPERATIONAL_DAY_DATE')
  const { data, error } = await client.rpc('internal_admin_read_operational_departure_board', {
    p_auth_subject: userId,
    p_organization_id: organizationId,
    p_date: operatingDate,
    // Server-owned threshold: a browser cannot weaken the connection rule.
    p_connected_within_seconds: 120,
  })
  if (error) throw Object.assign(new Error(error.message), { status: error.message === 'COMPANY_ADMIN_REQUIRED' ? 403 : 503 })
  return data
}
