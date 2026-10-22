import { clientsFromEnvironment, sendError, sendJson } from './companyLicensing.js'
import { authenticateDeviceRequest, resolveDeviceContext } from './deviceAuthentication.js'
import { requireDeviceDriverIdentity } from './deviceDriverIdentity.js'

export const operationalToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now)

const queueStatuses = new Set(['not_started', 'active', 'completed'])
const departureStatuses = new Set(['not_started', 'waiting', 'called', 'timed_out', 'departed'])

/** Keep the device response aggregate-only even if an RPC changes later. */
export function deviceDepartureStatus(value) {
  if (value === null) return null
  if (!value || typeof value !== 'object'
    || !queueStatuses.has(value.queue_status)
    || !departureStatuses.has(value.status)
    || !Number.isInteger(value.position) || value.position < 1
    || !Number.isInteger(value.drivers_ahead) || value.drivers_ahead < 0
    || (value.queue_status === 'not_started') !== (value.status === 'not_started')) {
    throw new Error('DEPARTURE_QUEUE_UNAVAILABLE')
  }
  return {
    queue_status: value.queue_status,
    position: value.position,
    drivers_ahead: value.drivers_ahead,
    status: value.status,
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : null,
  }
}

export async function handleDeviceOperationalDeparture(request, response, dependencies = {}) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  const action = request.body?.action
  if (action !== 'STATUS' && action !== 'CONFIRM') return sendJson(response, 400, { error: 'INVALID_DEPARTURE_ACTION' })

  try {
    const clients = dependencies.clients ?? clientsFromEnvironment()
    const authenticate = dependencies.authenticate ?? authenticateDeviceRequest
    const resolveContext = dependencies.resolveContext ?? resolveDeviceContext
    const requireIdentity = dependencies.requireIdentity ?? requireDeviceDriverIdentity
    const device = await authenticate(request, clients, '/api/device-operational-departure')
    const context = await resolveContext(device, clients)
    const identity = await requireIdentity(request, clients, device, context)
    const operatingDate = dependencies.operatingDate ?? operationalToday(dependencies.now?.() ?? new Date())

    if (action === 'STATUS') {
      const { data, error } = await clients.checkvan.rpc('internal_device_driver_departure_status', {
        p_organization_id: context.organization.id,
        p_driver_id: identity.driver.id,
        p_date: operatingDate,
      })
      if (error) throw new Error('DEPARTURE_QUEUE_UNAVAILABLE')
      return sendJson(response, 200, deviceDepartureStatus(data))
    }

    const { data, error } = await clients.checkvan.rpc('internal_driver_confirm_operational_departure', {
      p_organization_id: context.organization.id,
      p_driver_id: identity.driver.id,
      p_date: operatingDate,
      p_origin: 'driver_utility',
    })
    if (error) return sendJson(response, error.message === 'DEPARTURE_NOT_AVAILABLE' ? 409 : 503, { error: error.message })
    return sendJson(response, 200, data)
  } catch (error) {
    return sendError(response, error)
  }
}
