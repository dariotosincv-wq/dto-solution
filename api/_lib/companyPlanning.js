import { uuid } from './companyVehicles.js'
import { validDate, weekStart, shiftDay, WORK_STATUSES, resolveEffective } from '../../company/src/lib/weeklyPlanning.js'

const invalid = (message = 'INVALID_PLANNING_INPUT') => { throw Object.assign(new Error(message), { status: 400 }) }
export function planningWeek(value) {
  if (!validDate(value) || weekStart(value) !== value) invalid('INVALID_PLANNING_WEEK')
  return value
}
export function planningInput(body = {}) {
  const start = planningWeek(body.week_start)
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) invalid()
  const base = { week_start: start, revision: body.revision, action: body.action }
  if (body.action === 'COPY_PREVIOUS') return base
  if (!validDate(body.assignment_date) || body.assignment_date < start || body.assignment_date > shiftDay(start, 6)) invalid()
  if (body.action === 'REQUIREMENT') {
    if (body.required_drivers !== null && (!Number.isInteger(body.required_drivers) || body.required_drivers < 0 || body.required_drivers > 1000)) invalid()
    return { ...base, assignment_date: body.assignment_date, required_drivers: body.required_drivers }
  }
  if (!['SAVE', 'CLEAR', 'OVERRIDE', 'RESET_OVERRIDE'].includes(body.action) || !uuid(body.driver_id)) invalid()
  const item = { ...base, assignment_date: body.assignment_date, driver_id: body.driver_id }
  if (['CLEAR', 'RESET_OVERRIDE'].includes(body.action)) return item
  if (!WORK_STATUSES.includes(body.work_status) || (body.vehicle_id != null && body.vehicle_id !== '' && !uuid(body.vehicle_id))) invalid()
  for (const [field, limit] of [['route', 100], ['notes', 2000]]) if (body[field] != null && (typeof body[field] !== 'string' || body[field].length > limit)) invalid()
  return { ...item, work_status: body.work_status, vehicle_id: body.work_status === 'TURNO' ? body.vehicle_id || null : null, route: body.work_status === 'TURNO' ? body.route?.trim() || null : null, notes: body.notes?.trim() || null }
}

export async function readPlanning(client, organizationId, start, end = shiftDay(start, 6)) {
  const { data, error } = await client.rpc('internal_read_weekly_plan', { p_organization_id: organizationId, p_start: start, p_end: end })
  if (error) throw Object.assign(new Error('PLANNING_UNAVAILABLE'), { status: 503 })
  return { ...data, week_start: weekStart(start), effective: resolveEffective(data.entries, data.overrides, data.daily) }
}

export async function mutatePlanning(client, organizationId, userId, body) {
  const input = planningInput(body)
  const { data, error } = await client.rpc('internal_admin_mutate_weekly_plan', { p_auth_subject: userId, p_organization_id: organizationId, p_input: input })
  if (error) throw Object.assign(new Error(error.message === 'PLANNING_STALE' ? 'PLANNING_STALE' : 'PLANNING_SAVE_FAILED'), { status: error.message === 'PLANNING_STALE' ? 409 : 400 })
  return data
}
