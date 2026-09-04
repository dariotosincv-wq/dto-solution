import { authenticateRequest } from './companyLicensing.js'

export const SUPER_ADMIN_LIMITS = Object.freeze({ pageSize: 100, maxRows: 500, staleUploadMinutes: 30, highAttempts: 4 })
const buckets = new Map()

export function applySuperAdminHeaders(response) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0')
  response.setHeader('Pragma', 'no-cache')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
  response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
  return response
}

export function enforceRateLimit(request, now = Date.now()) {
  const key = String(request.headers['x-forwarded-for'] ?? request.socket?.remoteAddress ?? 'unknown').split(',')[0].trim()
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + 60_000 }); return }
  current.count += 1
  if (current.count > 90) throw Object.assign(new Error('RATE_LIMITED'), { status: 429 })
}

export async function authenticateSuperAdminIdentity(request, clients) {
  const user = await authenticateRequest(request, clients)
  const { data: admin, error } = await clients.checkvan.from('dto_super_admins')
    .select('auth_subject,status,display_name,require_mfa').eq('auth_subject', user.id).maybeSingle()
  if (error) throw new Error('SUPER_ADMIN_AUTH_UNAVAILABLE')
  if (!admin || admin.status !== 'active') throw Object.assign(new Error('NOT_AUTHORIZED'), { status: 403 })
  return { id: user.id, displayName: admin.display_name, mfaRequired: admin.require_mfa }
}

export async function authenticateSuperAdmin(request, clients) {
  const admin = await authenticateSuperAdminIdentity(request, clients)
  if (admin.mfaRequired) {
    const token = request.headers.authorization.match(/^Bearer ([^\s]+)$/)?.[1]
    const { data, error: mfaError } = await clients.dto.auth.mfa.getAuthenticatorAssuranceLevel(token)
    if (mfaError || data?.currentLevel !== 'aal2') throw Object.assign(new Error('MFA_REQUIRED'), { status: 403 })
  }
  return admin
}

export function safeQuery(query = {}) {
  const text = typeof query.search === 'string' ? query.search.trim().slice(0, 80) : ''
  const organizationId = /^[0-9a-f-]{36}$/i.test(query.organizationId ?? '') ? query.organizationId : null
  return { search: text, organizationId, status: String(query.status ?? '').slice(0, 30), mode: String(query.mode ?? '').slice(0, 30), limit: Math.min(SUPER_ADMIN_LIMITS.pageSize, Math.max(1, Number(query.limit) || 50)) }
}

export function syncHealth(row, now = Date.now()) {
  if (row.upload_status === 'available') return { level: 'ok', label: 'Sincronizzata' }
  const age = now - Date.parse(row.upload_started_at ?? row.created_at)
  if (row.upload_status === 'failed') return { level: 'error', label: 'Intervento necessario' }
  if (row.upload_status === 'uploading' && age > SUPER_ADMIN_LIMITS.staleUploadMinutes * 60_000) return { level: 'error', label: 'Upload fermo' }
  if ((row.upload_attempts ?? 0) >= SUPER_ADMIN_LIMITS.highAttempts) return { level: 'warning', label: 'Retry automatico' }
  return { level: 'warning', label: row.upload_status === 'uploading' ? 'In caricamento' : 'In attesa dispositivo online' }
}

export async function auditAdmin(clients, admin, eventType, context = {}) {
  const { error } = await clients.checkvan.from('checkvan_license_audit').insert({
    event_type: `SUPER_ADMIN_${eventType}`,
    organization_id: context.organizationId ?? null,
    license_id: context.licenseId ?? null,
    device_id: context.deviceId ?? null,
    metadata: { actor_subject: admin.id, result: context.result ?? 'success' },
  })
  if (error) throw new Error('AUDIT_WRITE_FAILED')
}

export function redactDevice(device) {
  return { id: device.id, label: `Device ${String(device.id).slice(0, 8)}`, status: device.status, createdAt: device.created_at, lastActivityAt: device.last_validated_at, revokedAt: device.revoked_at }
}
