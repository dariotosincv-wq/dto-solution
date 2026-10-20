import { hashSecret, newSecret } from './operationalAccess.js'

const headerName = 'x-checkvan-driver-session'
const validSecret = value => typeof value === 'string' && /^[A-Za-z0-9_-]{40,}$/.test(value)

// The date is computed on the server.  A device clock can neither extend nor
// shorten a personal session; the result is the next midnight in Italy.
export function nextRomeMidnight(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const value = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]))
  const next = new Date(Date.UTC(value.year, value.month - 1, value.day + 1))
  const offsetAt = instant => {
    const local = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(instant).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]))
    return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) - instant.getTime()
  }
  let result = new Date(next.getTime() - offsetAt(next))
  result = new Date(next.getTime() - offsetAt(result))
  return result
}

export async function issueDeviceDriverSession(clients, { device, context, access, now = new Date() }) {
  const secret = newSecret()
  const expiresAt = nextRomeMidnight(now).toISOString()
  const { error } = await clients.checkvan.from('checkvan_device_driver_sessions').insert({
    organization_id: context.organization.id,
    driver_id: access.driver_id,
    device_id: device.id,
    access_token_id: access.id,
    session_hash: hashSecret(secret),
    expires_at: expiresAt,
  })
  if (error) throw new Error('DRIVER_IDENTITY_UNAVAILABLE')
  return { secret, expiresAt }
}

export async function revokeDeviceDriverSession(clients, session, now = new Date()) {
  const { error } = await clients.checkvan.from('checkvan_device_driver_sessions')
    .update({ revoked_at: now.toISOString() }).eq('id', session.id).is('revoked_at', null)
  if (error) throw new Error('DRIVER_IDENTITY_UNAVAILABLE')
}

/**
 * Resolves identity exclusively from a server-issued opaque proof.  The body
 * is deliberately not an authority for driver or organization identifiers.
 */
export async function requireDeviceDriverIdentity(request, clients, device, context) {
  const secret = request.headers?.[headerName]
  if (!validSecret(secret)) throw Object.assign(new Error('DRIVER_IDENTITY_REQUIRED'), { status: 401 })
  const now = new Date().toISOString()
  const { data: session, error } = await clients.checkvan.from('checkvan_device_driver_sessions')
    .select('id,organization_id,driver_id,device_id,access_token_id,expires_at,revoked_at')
    .eq('session_hash', hashSecret(secret)).eq('organization_id', context.organization.id)
    .eq('device_id', device.id).is('revoked_at', null).gt('expires_at', now).maybeSingle()
  if (error) throw new Error('DRIVER_IDENTITY_UNAVAILABLE')
  if (!session) throw Object.assign(new Error('DRIVER_IDENTITY_REQUIRED'), { status: 401 })
  const { data: access, error: accessError } = await clients.checkvan.from('checkvan_driver_access_tokens')
    .select('id,organization_id,driver_id,status').eq('id', session.access_token_id).eq('status', 'active').maybeSingle()
  if (accessError) throw new Error('DRIVER_IDENTITY_UNAVAILABLE')
  if (!access || access.organization_id !== context.organization.id || access.driver_id !== session.driver_id) {
    throw Object.assign(new Error('DRIVER_IDENTITY_REVOKED'), { status: 401 })
  }
  const { data: driver, error: driverError } = await clients.checkvan.from('checkvan_drivers')
    .select('id,first_name,last_name,status').eq('id', session.driver_id).eq('organization_id', context.organization.id).eq('status', 'active').maybeSingle()
  if (driverError) throw new Error('DRIVER_IDENTITY_UNAVAILABLE')
  if (!driver) throw Object.assign(new Error('DRIVER_IDENTITY_REVOKED'), { status: 401 })
  void clients.checkvan.from('checkvan_device_driver_sessions').update({ last_used_at: now }).eq('id', session.id)
  return { session, driver }
}

export const deviceDriverSessionHeader = headerName
