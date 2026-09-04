import { uuid } from './companyVehicles.js'

const text = (value, max) => typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null

export function driverInput(body = {}) {
  const first_name = text(body.first_name, 100), last_name = text(body.last_name, 100)
  const driver_code = typeof body.driver_code === 'string' && body.driver_code.trim() ? text(body.driver_code, 80)?.toUpperCase() : null
  if (!first_name || !last_name || (body.driver_code && !driver_code)) throw Object.assign(new Error('INVALID_DRIVER'), { status: 400 })
  return { first_name, last_name, driver_code }
}

export function driverBatchInput(body = {}) {
  if (!Array.isArray(body.drivers) || body.drivers.length < 1 || body.drivers.length > 500) throw Object.assign(new Error('INVALID_DRIVER_BATCH'), { status: 400 })
  return body.drivers.map(driverInput)
}

export const publicDriver = (row) => ({ driver_id: row.id, driver_code: row.driver_code, first_name: row.first_name, last_name: row.last_name, status: row.status, archived_at: row.archived_at ?? null, created_at: row.created_at, updated_at: row.updated_at })

export function assignmentInput(body = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.assignment_date || '') || !uuid(body.driver_id) || !uuid(body.vehicle_id)) throw Object.assign(new Error('INVALID_ASSIGNMENT'), { status: 400 })
  return { assignment_date: body.assignment_date, driver_id: body.driver_id, vehicle_id: body.vehicle_id }
}

export const publicAssignment = (row) => ({ assignment_id: row.id, assignment_date: row.assignment_date, driver_id: row.driver_id, vehicle_id: row.vehicle_id, assigned_by: row.assigned_by, created_at: row.created_at, updated_at: row.updated_at })
