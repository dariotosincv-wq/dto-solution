import { createHash, randomBytes } from 'node:crypto'
import { readPlanning } from './companyPlanning.js'

export const hashSecret = (value) => createHash('sha256').update(value).digest('hex')
export const newSecret = () => randomBytes(32).toString('base64url')
export const sessionCookie = 'dto_operational_session'

export function cookieValue(request, name) {
  return (request.headers.cookie ?? '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? null
}

export async function operationalSession(request, clients) {
  const secret = cookieValue(request, sessionCookie)
  if (!secret) throw Object.assign(new Error('OPERATIONAL_ACCESS_REQUIRED'), { status: 401 })
  const { data, error } = await clients.checkvan.from('checkvan_driver_access_sessions').select('id,organization_id,driver_id,expires_at').eq('session_hash', hashSecret(secret)).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (error) throw new Error('OPERATIONAL_ACCESS_UNAVAILABLE')
  if (!data) throw Object.assign(new Error('OPERATIONAL_ACCESS_REQUIRED'), { status: 401 })
  void clients.checkvan.from('checkvan_driver_access_sessions').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
  return data
}

export async function driverWeek(clients, session, start) {
  const [planning, driver, organization, vehicles] = await Promise.all([
    readPlanning(clients.checkvan, session.organization_id, start),
    clients.checkvan.from('checkvan_drivers').select('id,first_name,last_name,status').eq('id', session.driver_id).eq('organization_id', session.organization_id).eq('status', 'active').maybeSingle(),
    clients.checkvan.from('checkvan_organizations').select('name').eq('id', session.organization_id).maybeSingle(),
    clients.checkvan.from('checkvan_vehicles').select('id,internal_code,plate').eq('organization_id', session.organization_id),
  ])
  if (!driver.data || driver.error || organization.error || vehicles.error) throw Object.assign(new Error('OPERATIONAL_DATA_UNAVAILABLE'), { status: 503 })
  const byVehicle = new Map((vehicles.data ?? []).map(row => [row.id, row]))
  const own = planning.effective.filter(item => item.driver_id === session.driver_id).map(item => ({
    date: item.assignment_date, status: item.work_status, route: item.route ?? null, notes: item.notes ?? null,
    source: item.source, vehicle: item.vehicle_id ? byVehicle.get(item.vehicle_id) ?? null : null,
  }))
  return { week_start: planning.week_start, driver: { first_name: driver.data.first_name, last_name: driver.data.last_name }, organization: organization.data?.name ?? null, entries: own }
}
