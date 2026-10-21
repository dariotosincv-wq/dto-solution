import { createHash, createPrivateKey, createSign, randomUUID, timingSafeEqual } from 'node:crypto'
import { sendError, sendJson } from './companyLicensing.js'
import { authenticateDeviceRequest, resolveDeviceContext } from './deviceAuthentication.js'
import { requireDeviceDriverIdentity } from './deviceDriverIdentity.js'

const tokenHash = value => createHash('sha256').update(value).digest('hex')
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const opaqueFcmToken = value => typeof value === 'string' && value.length >= 80 && value.length <= 4096 && !/\s/.test(value) && !value.split('').some(char => char.charCodeAt(0) === 0)
const b64url = value => Buffer.from(value).toString('base64url')

export function validWebhookSecret(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') return false
  const left = Buffer.from(actual), right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

function serviceAccount(raw) {
  try {
    const value = JSON.parse(raw ?? '')
    if (!value?.project_id || !value?.client_email || !value?.private_key) throw new Error('INVALID')
    return value
  } catch { throw Object.assign(new Error('FCM_NOT_CONFIGURED'), { status: 503 }) }
}

async function accessToken(account, request = fetch, now = Date.now()) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 300 }))
  const signer = createSign('RSA-SHA256'); signer.update(`${header}.${claims}`); signer.end()
  const assertion = `${header}.${claims}.${signer.sign(createPrivateKey(account.private_key)).toString('base64url')}`
  const response = await request('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) })
  if (!response.ok) throw Object.assign(new Error('FCM_AUTH_FAILED'), { retryable: true })
  const payload = await response.json()
  if (typeof payload.access_token !== 'string') throw Object.assign(new Error('FCM_AUTH_FAILED'), { retryable: true })
  return payload.access_token
}

export async function sendDepartureCalledFcm({ token, eventId, expiresAt, accountJson, request = fetch, now = Date.now() }) {
  if (!uuid(eventId) || !opaqueFcmToken(token) || Date.parse(expiresAt) <= now) return { outcome: 'expired' }
  const account = serviceAccount(accountJson)
  const bearer = await accessToken(account, request, now)
  const ttl = Math.max(1, Math.floor((Date.parse(expiresAt) - now) / 1000))
  const response = await request(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
    method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
    body: JSON.stringify({ message: { token, data: { type: 'departure_called', event_id: eventId }, android: { priority: 'HIGH', ttl: `${ttl}s` } } }),
  })
  const body = await response.json().catch(() => ({}))
  if (response.ok && typeof body.name === 'string') return { outcome: 'sent', providerMessageId: body.name }
  const code = String(body?.error?.status ?? '')
  if (['UNREGISTERED', 'INVALID_ARGUMENT'].includes(code)) return { outcome: 'invalid_token' }
  return { outcome: 'retry', errorCode: code === 'RESOURCE_EXHAUSTED' ? 'FCM_RATE_LIMITED' : 'FCM_TEMPORARY_FAILURE' }
}

async function dispatch(clients, eventId, options = {}) {
  const { data: claim, error } = await clients.checkvan.rpc('internal_claim_operational_departure_push', { p_event_id: eventId ?? null, p_driver_id: options.driverId ?? null, p_organization_id: options.organizationId ?? null })
  if (error) throw new Error('PUSH_OUTBOX_UNAVAILABLE')
  const item = Array.isArray(claim) ? claim[0] : claim
  if (!item) return { status: 'nothing_due' }
  let result
  try {
    result = await sendDepartureCalledFcm({ token: item.fcm_token, eventId: item.event_id, expiresAt: item.expires_at, accountJson: options.accountJson ?? process.env.FCM_SERVICE_ACCOUNT_JSON, request: options.request, now: options.now })
  } catch {
    result = { outcome: 'retry', errorCode: 'FCM_TEMPORARY_FAILURE' }
  }
  if (result.outcome === 'expired') return { status: 'expired' }
  const { error: completeError } = await clients.checkvan.rpc('internal_complete_operational_departure_push', {
    p_event_id: item.event_id, p_registration_id: item.registration_id, p_outcome: result.outcome,
    p_provider_message_id: result.providerMessageId ?? null, p_error_code: result.errorCode ?? null,
  })
  if (completeError) throw new Error('PUSH_OUTBOX_UNAVAILABLE')
  return { status: result.outcome }
}

export async function handleDevicePushRegistration(request, response, dependencies = {}) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  try {
    const clients = dependencies.clients
    const device = await (dependencies.authenticate ?? authenticateDeviceRequest)(request, clients, '/api/device-push-registration')
    const context = await (dependencies.resolveContext ?? resolveDeviceContext)(device, clients)
    const identity = await (dependencies.requireIdentity ?? requireDeviceDriverIdentity)(request, clients, device, context)
    const action = request.body?.action
    if (action === 'REGISTER') {
      const token = request.body?.token
      if (!opaqueFcmToken(token)) return sendJson(response, 400, { error: 'INVALID_PUSH_TOKEN' })
      const { error } = await clients.checkvan.rpc('internal_register_device_push_token', { p_session_id: identity.session.id, p_device_id: device.id, p_token: token, p_token_hash: tokenHash(token) })
      if (error) throw Object.assign(new Error(error.message === 'DRIVER_IDENTITY_REQUIRED' ? 'DRIVER_IDENTITY_REQUIRED' : 'PUSH_REGISTRATION_UNAVAILABLE'), { status: error.message === 'DRIVER_IDENTITY_REQUIRED' ? 401 : 503 })
      return sendJson(response, 200, { status: 'registered' })
    }
    if (action === 'RECOVER') return sendJson(response, 200, await dispatch(clients, null, { ...dependencies, driverId: identity.driver.id, organizationId: context.organization.id }))
    return sendJson(response, 400, { error: 'INVALID_PUSH_ACTION' })
  } catch (error) { return sendError(response, error) }
}

export async function handleDeparturePushDispatch(request, response, dependencies = {}) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  if (!validWebhookSecret(request.headers?.['x-dto-push-webhook-secret'], dependencies.webhookSecret ?? process.env.DTO_PUSH_WEBHOOK_SECRET)) return sendJson(response, 401, { error: 'UNAUTHORIZED' })
  const eventId = request.body?.record?.id ?? request.body?.event_id
  if (eventId != null && !uuid(eventId)) return sendJson(response, 400, { error: 'INVALID_EVENT_ID' })
  try { return sendJson(response, 200, await dispatch(dependencies.clients, eventId ?? null, dependencies)) }
  catch (error) { return sendError(response, error) }
}

export const departurePushInternals = { tokenHash, opaqueFcmToken, dispatch, randomUUID }
