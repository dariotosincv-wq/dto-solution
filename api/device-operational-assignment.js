import { clientsFromEnvironment, sendError, sendJson } from './_lib/companyLicensing.js'
import { hashSecret } from './_lib/operationalAccess.js'
import { readPlanning } from './_lib/companyPlanning.js'
import { weekStart } from '../company/src/lib/weeklyPlanning.js'

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const invalid = () => Object.assign(new Error('OPERATIONAL_QR_INVALID'), { status: 401 })

export default async function handler(request, response) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  try {
    const token = typeof request.body?.token === 'string' ? request.body.token : ''
    if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) throw invalid()
    const clients = clientsFromEnvironment()
    const { data: access, error } = await clients.checkvan.from('checkvan_driver_access_tokens').select('organization_id,driver_id').eq('token_hash', hashSecret(token)).eq('status', 'active').maybeSingle()
    if (error) throw new Error('OPERATIONAL_ACCESS_UNAVAILABLE')
    if (!access) throw invalid()
    const date = today()
    const [planning, driverResult, vehiclesResult] = await Promise.all([
      readPlanning(clients.checkvan, access.organization_id, weekStart(date)),
      clients.checkvan.from('checkvan_drivers').select('id,first_name,last_name').eq('id', access.driver_id).eq('organization_id', access.organization_id).eq('status', 'active').maybeSingle(),
      clients.checkvan.from('checkvan_vehicles').select('id,internal_code,plate,silhouette_category').eq('organization_id', access.organization_id),
    ])
    if (driverResult.error || !driverResult.data || vehiclesResult.error) throw new Error('OPERATIONAL_DATA_UNAVAILABLE')
    const entry = planning.effective.find(item => item.driver_id === access.driver_id && item.assignment_date === date)
    const vehicle = entry?.vehicle_id ? (vehiclesResult.data ?? []).find(item => item.id === entry.vehicle_id) ?? null : null
    if (entry?.work_status === 'TURNO' && !vehicle) return sendJson(response, 200, { date, driver: driverResult.data, status: 'TURNO', assignment: null })
    return sendJson(response, 200, { date, driver: driverResult.data, status: entry?.work_status ?? 'ALTRO', assignment: entry?.work_status === 'TURNO' ? { vehicle_id: vehicle.id, internal_code: vehicle.internal_code, plate: vehicle.plate, silhouette_category: vehicle.silhouette_category, route: entry.route ?? null, notes: entry.notes ?? null, source: entry.source } : null })
  } catch (error) { return sendError(response, error) }
}
