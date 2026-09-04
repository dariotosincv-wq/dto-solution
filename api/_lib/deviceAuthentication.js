import { createHash, createPublicKey, verify } from 'node:crypto'

const SIGNATURE_WINDOW_MS = 5 * 60 * 1000

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

export function canonicalDeviceRequest(request, body, canonicalPath) {
  const timestamp = request.headers['x-checkvan-timestamp'] ?? ''
  const requestId = request.headers['x-checkvan-request-id'] ?? ''
  const digest = createHash('sha256').update(stableJson(body ?? {})).digest('hex')
  return [request.method, canonicalPath ?? request.url?.split('?')[0] ?? '', timestamp, requestId, digest].join('\n')
}

export function validateDeviceHeaders(request, now = Date.now()) {
  const deviceId = request.headers['x-checkvan-device-id']
  const keyId = request.headers['x-checkvan-key-id']
  const requestId = request.headers['x-checkvan-request-id']
  const signature = request.headers['x-checkvan-signature']
  const timestamp = request.headers['x-checkvan-timestamp']
  if (![deviceId, keyId, requestId, signature, timestamp].every((value) => typeof value === 'string' && value)) return { error: 'DEVICE_AUTH_REQUIRED' }
  const time = Date.parse(timestamp)
  if (!Number.isFinite(time) || Math.abs(now - time) > SIGNATURE_WINDOW_MS) return { error: 'DEVICE_TIMESTAMP_INVALID' }
  return { deviceId, keyId, requestId, signature, timestamp }
}

export function verifyDeviceSignature(publicKeySpkiBase64, signatureBase64, canonical) {
  try {
    const key = createPublicKey({ key: Buffer.from(publicKeySpkiBase64, 'base64'), format: 'der', type: 'spki' })
    return verify('sha256', Buffer.from(canonical), key, Buffer.from(signatureBase64, 'base64'))
  } catch { return false }
}

function invalidDeviceAuth(reason) {
  console.warn(`[CheckVan device auth] rejected reason=${reason}`)
  return Object.assign(new Error('DEVICE_AUTH_INVALID'), { status: 401 })
}

export async function authenticateDeviceRequest(request, clients, canonicalPath) {
  const headers = validateDeviceHeaders(request)
  if (headers.error) throw Object.assign(new Error(headers.error), { status: 401 })
  const { data: key, error: keyError } = await clients.checkvan.from('checkvan_device_keys')
    .select('key_id,device_key_id,key_version,public_key_spki_base64,algorithm,status').eq('key_id', headers.keyId).eq('status', 'active').maybeSingle()
  if (keyError) throw new Error('LICENSING_UNAVAILABLE')
  const { data: device, error } = await clients.checkvan.from('checkvan_license_devices')
    .select('id,key_id,device_key_id,key_version,public_key_spki_base64,algorithm,status').eq('id', headers.deviceId).eq('key_id', headers.keyId).maybeSingle()
  if (error) throw new Error('LICENSING_UNAVAILABLE')
  if (!device) throw invalidDeviceAuth('DEVICE_NOT_FOUND')
  if (device.status !== 'active') throw invalidDeviceAuth('DEVICE_INACTIVE')
  if (key && (device.device_key_id !== key.device_key_id || device.key_version !== key.key_version
    || device.public_key_spki_base64 !== key.public_key_spki_base64)) throw invalidDeviceAuth('DEVICE_KEY_MISMATCH')
  if (device.algorithm !== 'ECDSA_P256_SHA256' || (key && key.algorithm !== 'ECDSA_P256_SHA256')) throw invalidDeviceAuth('ALGORITHM_INVALID')
  const verificationKey = key?.public_key_spki_base64 ?? device.public_key_spki_base64
  if (!verifyDeviceSignature(verificationKey, headers.signature, canonicalDeviceRequest(request, request.body, canonicalPath))) {
    throw invalidDeviceAuth('SIGNATURE_INVALID')
  }
  const { error: nonceError } = await clients.checkvan.from('checkvan_device_request_nonces').insert({ device_id: device.id, request_id: headers.requestId, requested_at: headers.timestamp })
  if (nonceError) throw Object.assign(new Error('DEVICE_REQUEST_REPLAYED'), { status: 409 })
  return device
}

export async function resolveDeviceContext(device, clients) {
  const { data: assignment, error } = await clients.checkvan.from('checkvan_device_assignments')
    .select('id,license_id,status').eq('device_id', device.id).eq('status', 'active').maybeSingle()
  if (error) throw new Error('LICENSING_UNAVAILABLE')
  if (!assignment) {
    const { data: founder, error: founderError } = await clients.checkvan.from('checkvan_founder_entitlements')
      .select('id,organization_id,status,starts_at,ends_at').eq('device_id', device.id).eq('status', 'active').maybeSingle()
    if (founderError) throw new Error('LICENSING_UNAVAILABLE')
    if (!founder || (founder.starts_at && Date.parse(founder.starts_at) > Date.now()) || (founder.ends_at && Date.parse(founder.ends_at) <= Date.now())) {
      throw Object.assign(new Error('DEVICE_NOT_ASSIGNED'), { status: 403 })
    }
    const { data: organization } = await clients.checkvan.from('checkvan_organizations').select('id,status,retention_days').eq('id', founder.organization_id).maybeSingle()
    if (organization?.status !== 'active') throw Object.assign(new Error('ORGANIZATION_INACTIVE'), { status: 403 })
    return { device, assignment: { id: null, organization_id: organization.id, license_id: null, founder_entitlement_id: founder.id }, organization }
  }
  if (assignment.license_id) {
    const { data: license } = await clients.checkvan.from('checkvan_licenses').select('id,organization_id,status,product_mode,cloud_enabled,access_grant,starts_at,ends_at').eq('id', assignment.license_id).maybeSingle()
    const now = Date.now()
    if (!license || license.status !== 'active' || license.product_mode !== 'company' || !license.cloud_enabled
      || !['PAID', 'TRIAL', 'TESTER'].includes(license.access_grant)
      || Date.parse(license.starts_at) > now || (license.ends_at && Date.parse(license.ends_at) <= now)) {
      throw Object.assign(new Error('CLOUD_ENTITLEMENT_INACTIVE'), { status: 403 })
    }
    const { data: organization } = await clients.checkvan.from('checkvan_organizations').select('id,status,retention_days').eq('id', license.organization_id).maybeSingle()
    if (organization?.status !== 'active') throw Object.assign(new Error('ORGANIZATION_INACTIVE'), { status: 403 })
    return { device, assignment, organization }
  } else {
    throw Object.assign(new Error('CLOUD_ENTITLEMENT_INACTIVE'), { status: 403 })
  }
}
