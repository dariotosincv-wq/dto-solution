import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const PROVIDER = 'google_drive'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

const sha256 = value => createHash('sha256').update(value).digest('hex')
const now = () => new Date().toISOString()
const escapeQuery = value => String(value).replaceAll("'", "\\'")
const safeSegment = value => String(value ?? '').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'SENZA-DATO'

function configured() {
  return Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY)
}

function redirectUri() {
  return process.env.GOOGLE_DRIVE_REDIRECT_URI || 'https://www.dtosolution.it/api/company-cloud'
}

function key() {
  const value = Buffer.from(process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY || '', 'base64')
  if (value.length !== 32) throw Object.assign(new Error('CLOUD_ARCHIVE_NOT_CONFIGURED'), { status: 503 })
  return value
}

function encryptTokens(accessToken, refreshToken) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ accessToken, refreshToken }), 'utf8'), cipher.final()])
  return { ciphertext: Buffer.concat([encrypted, cipher.getAuthTag()]).toString('base64'), iv: iv.toString('base64') }
}

function decryptTokens(row) {
  const data = Buffer.from(row.access_token_ciphertext, 'base64'), iv = Buffer.from(row.token_iv, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(data.subarray(-16))
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()]).toString('utf8'))
}

async function google(url, options = {}) {
  const response = await fetch(url, options)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.error?.message || body.error || 'GOOGLE_DRIVE_UNAVAILABLE')
    error.code = body.error === 'invalid_grant' || response.status === 401 ? 'GOOGLE_REAUTH_REQUIRED' : 'GOOGLE_DRIVE_UNAVAILABLE'
    throw error
  }
  return body
}

async function refreshConnection(clients, connection) {
  const tokens = decryptTokens(connection)
  if (connection.token_expires_at && Date.parse(connection.token_expires_at) > Date.now() + 60_000) return tokens.accessToken
  let token
  try {
    token = await google(GOOGLE_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.GOOGLE_DRIVE_CLIENT_ID, client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET, refresh_token: tokens.refreshToken, grant_type: 'refresh_token' }) })
  } catch (error) {
    if (error.code === 'GOOGLE_REAUTH_REQUIRED') await clients.checkvan.from('checkvan_cloud_connections').update({ status: 'reauthorization_required', updated_at: now() }).eq('organization_id', connection.organization_id)
    throw error
  }
  const stored = encryptTokens(token.access_token, tokens.refreshToken)
  await clients.checkvan.from('checkvan_cloud_connections').update({ access_token_ciphertext: stored.ciphertext, refresh_token_ciphertext: '', token_iv: stored.iv, token_expires_at: new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString(), status: 'active', updated_at: now() }).eq('organization_id', connection.organization_id)
  // The refreshed row stores both tokens together in access_token_ciphertext; the empty legacy column is intentional.
  return token.access_token
}

function tokenRow(accessToken, refreshToken) {
  const stored = encryptTokens(accessToken, refreshToken)
  return { access_token_ciphertext: stored.ciphertext, refresh_token_ciphertext: 'stored-with-access-token', token_iv: stored.iv }
}

async function driveFolder(accessToken, name, parentId = null) {
  const q = [`name = '${escapeQuery(name)}'`, "mimeType = 'application/vnd.google-apps.folder'", 'trashed = false']
  if (parentId) q.push(`'${escapeQuery(parentId)}' in parents`)
  const found = await google(`${DRIVE_FILES}?${new URLSearchParams({ q: q.join(' and '), fields: 'files(id,name)', pageSize: '1' })}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (found.files?.[0]) return found.files[0]
  return google(DRIVE_FILES, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parentId ? { parents: [parentId] } : {}) }) })
}

async function connectionForOrg(clients, organizationId) {
  const { data, error } = await clients.checkvan.from('checkvan_cloud_connections').select('*').eq('organization_id', organizationId).eq('provider', PROVIDER).maybeSingle()
  if (error) throw new Error('CLOUD_ARCHIVE_UNAVAILABLE')
  return data
}

function publicConnection(connection, syncs = []) {
  if (!connection) return { connected: false, provider: PROVIDER }
  return { connected: true, provider: PROVIDER, status: connection.status, folderName: connection.root_folder_name, backupEnabled: connection.backup_enabled, backupPickup: connection.backup_pickup, backupReturn: connection.backup_return, includeHistory: connection.include_history, lastSyncAt: connection.last_sync_at, lastVerifiedAt: connection.last_verified_at, synced: syncs.filter(item => item.status === 'SYNCED').length, pending: syncs.filter(item => item.status !== 'SYNCED').length, failed: syncs.filter(item => item.status === 'FAILED').length }
}

export async function cloudArchiveStatus(clients, organizationId) {
  const [connection, result] = await Promise.all([connectionForOrg(clients, organizationId), clients.checkvan.from('checkvan_cloud_document_syncs').select('status').eq('organization_id', organizationId).eq('provider', PROVIDER)])
  if (result.error) throw new Error('CLOUD_ARCHIVE_UNAVAILABLE')
  return publicConnection(connection, result.data ?? [])
}

export async function beginGoogleDriveOAuth(clients, context, authSubject, includeHistory = false) {
  if (!configured()) throw Object.assign(new Error('CLOUD_ARCHIVE_NOT_CONFIGURED'), { status: 503 })
  const state = randomBytes(32).toString('base64url'), expiresAt = new Date(Date.now() + 10 * 60_000).toISOString()
  const { error } = await clients.checkvan.from('checkvan_cloud_oauth_states').insert({ state_hash: sha256(state), organization_id: context.organization.id, auth_subject: authSubject, include_history: Boolean(includeHistory), expires_at: expiresAt })
  if (error) throw new Error('CLOUD_ARCHIVE_UNAVAILABLE')
  const query = new URLSearchParams({ client_id: process.env.GOOGLE_DRIVE_CLIENT_ID, redirect_uri: redirectUri(), response_type: 'code', scope: DRIVE_SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state })
  return { authorizationUrl: `${GOOGLE_AUTH}?${query}` }
}

export async function completeGoogleDriveOAuth(clients, code, state) {
  if (!configured() || !code || !state) throw Object.assign(new Error('CLOUD_ARCHIVE_NOT_CONFIGURED'), { status: 503 })
  const { data: oauth, error } = await clients.checkvan.from('checkvan_cloud_oauth_states').select('*').eq('state_hash', sha256(state)).gt('expires_at', now()).maybeSingle()
  await clients.checkvan.from('checkvan_cloud_oauth_states').delete().eq('state_hash', sha256(state))
  if (error || !oauth) throw Object.assign(new Error('OAUTH_STATE_INVALID'), { status: 400 })
  const token = await google(GOOGLE_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_DRIVE_CLIENT_ID, client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET, redirect_uri: redirectUri(), grant_type: 'authorization_code' }) })
  if (!token.access_token || !token.refresh_token) throw Object.assign(new Error('GOOGLE_REFRESH_TOKEN_MISSING'), { status: 400 })
  const root = await driveFolder(token.access_token, 'DTO Solution'), stored = tokenRow(token.access_token, token.refresh_token)
  const row = { organization_id: oauth.organization_id, provider: PROVIDER, status: 'active', root_folder_id: root.id, root_folder_name: root.name, ...stored, token_expires_at: new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString(), backup_enabled: true, backup_pickup: true, backup_return: true, include_history: oauth.include_history, last_verified_at: now(), updated_at: now() }
  const { error: upsertError } = await clients.checkvan.from('checkvan_cloud_connections').upsert(row, { onConflict: 'organization_id' })
  if (upsertError) throw new Error('CLOUD_ARCHIVE_UNAVAILABLE')
  return { organizationId: oauth.organization_id, includeHistory: oauth.include_history }
}

export function inspectionFileName(inspection) {
  const date = new Date(inspection.inspected_at).toISOString().slice(0, 10), type = inspection.inspection_type === 'pickup' ? 'PRESA' : 'RICONSEGNA', driver = [inspection.driver_last_name, inspection.driver_first_name].filter(Boolean).map(safeSegment).join('-') || 'SENZA-DRIVER'
  return `${date}_${safeSegment(inspection.vehicle_plate)}_${safeSegment(inspection.vehicle_description)}_${type}_${driver}.pdf`
}

export function archiveFolderParts(inspection) {
  const date = new Date(inspection.inspected_at), month = new Intl.DateTimeFormat('it-IT', { month: 'long', timeZone: 'UTC' }).format(date)
  return ['CheckVan', String(date.getUTCFullYear()), month[0].toUpperCase() + month.slice(1), safeSegment(inspection.vehicle_plate || 'SENZA-TARGA')]
}

async function ensureArchiveRoot(clients, connection, accessToken) {
  const root = await driveFolder(accessToken, 'DTO Solution')
  if (connection.root_folder_id !== root.id || connection.root_folder_name !== root.name) {
    const { error } = await clients.checkvan.from('checkvan_cloud_connections').update({ root_folder_id: root.id, root_folder_name: root.name, updated_at: now() }).eq('organization_id', connection.organization_id)
    if (error) throw new Error('CLOUD_ARCHIVE_UNAVAILABLE')
  }
  return root
}

async function archiveDestination(clients, connection, inspection, accessToken) {
  const [checkvanName, year, month, plate] = archiveFolderParts(inspection)
  const root = await ensureArchiveRoot(clients, connection, accessToken)
  const checkvan = await driveFolder(accessToken, checkvanName, root.id)
  const yearFolder = await driveFolder(accessToken, year, checkvan.id)
  const monthFolder = await driveFolder(accessToken, month, yearFolder.id)
  const vehicleFolder = await driveFolder(accessToken, plate, monthFolder.id)
  return { folder: vehicleFolder, fileName: inspectionFileName(inspection) }
}

async function uploadInspection(clients, connection, inspection) {
  const accessToken = await refreshConnection(clients, connection)
  const destination = await archiveDestination(clients, connection, inspection, accessToken)
  const { data, error } = await clients.checkvan.storage.from(inspection.storage_bucket).download(inspection.storage_object_path)
  if (error || !data) throw Object.assign(new Error('DOCUMENT_DOWNLOAD_FAILED'), { code: 'DOCUMENT_DOWNLOAD_FAILED' })
  const metadata = { name: destination.fileName, mimeType: 'application/pdf', parents: [destination.folder.id], appProperties: { dtoInspectionId: inspection.id } }
  const form = new FormData(); form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' })); form.append('file', data, metadata.name)
  return google(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id,name,webViewLink`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form })
}

export async function syncInspectionToGoogleDrive(clients, organizationId, inspectionId) {
  const connection = await connectionForOrg(clients, organizationId)
  if (!connection || connection.status !== 'active') return { status: 'SKIPPED' }
  const { data: inspection, error: inspectionError } = await clients.checkvan.from('checkvan_inspections').select('id,organization_id,inspection_type,vehicle_plate,vehicle_description,driver_first_name,driver_last_name,inspected_at,storage_bucket,storage_object_path,upload_status').eq('id', inspectionId).eq('organization_id', organizationId).eq('upload_status', 'available').maybeSingle()
  if (inspectionError) throw new Error('CLOUD_ARCHIVE_UNAVAILABLE')
  if (!inspection) throw Object.assign(new Error('INSPECTION_NOT_FOUND'), { status: 404 })
  if (!connection.backup_enabled || (inspection.inspection_type === 'pickup' ? !connection.backup_pickup : !connection.backup_return)) return { status: 'SKIPPED' }
  const { data: existing, error: existingError } = await clients.checkvan.from('checkvan_cloud_document_syncs').select('*').eq('organization_id', organizationId).eq('provider', PROVIDER).eq('inspection_id', inspectionId).maybeSingle()
  if (existingError) throw new Error('CLOUD_ARCHIVE_UNAVAILABLE')
  if (existing?.status === 'SYNCED') return { status: 'ALREADY_SYNCED', sync: existing }
  const attempt = { organization_id: organizationId, provider: PROVIDER, inspection_id: inspectionId, status: 'PENDING', last_attempt_at: now(), last_error_code: null, updated_at: now() }
  const { data: sync, error: upsertError } = await clients.checkvan.from('checkvan_cloud_document_syncs').upsert(attempt, { onConflict: 'organization_id,provider,inspection_id' }).select('*').single()
  if (upsertError) throw new Error('CLOUD_ARCHIVE_UNAVAILABLE')
  try {
    const remote = await uploadInspection(clients, connection, inspection), syncedAt = now()
    await clients.checkvan.from('checkvan_cloud_document_syncs').update({ status: 'SYNCED', remote_file_id: remote.id, remote_path: remote.name, synced_at: syncedAt, last_attempt_at: syncedAt, last_error_code: null, updated_at: syncedAt }).eq('id', sync.id)
    await clients.checkvan.from('checkvan_cloud_connections').update({ last_sync_at: syncedAt, updated_at: syncedAt }).eq('organization_id', organizationId)
    return { status: 'SYNCED' }
  } catch (error) {
    const code = error.code || error.message || 'GOOGLE_DRIVE_UNAVAILABLE'
    await clients.checkvan.from('checkvan_cloud_document_syncs').update({ status: 'FAILED', last_error_code: String(code).slice(0, 120), last_attempt_at: now(), updated_at: now() }).eq('id', sync.id)
    return { status: 'FAILED', error: code }
  }
}

export async function verifyGoogleDriveConnection(clients, organizationId) {
  const connection = await connectionForOrg(clients, organizationId)
  if (!connection) throw Object.assign(new Error('CLOUD_NOT_CONNECTED'), { status: 404 })
  const accessToken = await refreshConnection(clients, connection)
  const root = await ensureArchiveRoot(clients, connection, accessToken)
  await google(`${DRIVE_FILES}/${encodeURIComponent(root.id)}?fields=id,name,mimeType`, { headers: { Authorization: `Bearer ${accessToken}` } })
  await clients.checkvan.from('checkvan_cloud_connections').update({ last_verified_at: now(), status: 'active', updated_at: now() }).eq('organization_id', organizationId)
  return cloudArchiveStatus(clients, organizationId)
}

export async function disconnectGoogleDrive(clients, organizationId) {
  const connection = await connectionForOrg(clients, organizationId)
  if (!connection) return
  try { const tokens = decryptTokens(connection); await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokens.refreshToken)}`, { method: 'POST' }) } catch { /* Local credentials are still removed below. */ }
  const { error } = await clients.checkvan.from('checkvan_cloud_connections').delete().eq('organization_id', organizationId)
  if (error) throw new Error('CLOUD_ARCHIVE_UNAVAILABLE')
}

export async function createArchiveFolder(clients, organizationId) {
  const connection = await connectionForOrg(clients, organizationId)
  if (!connection) throw Object.assign(new Error('CLOUD_NOT_CONNECTED'), { status: 404 })
  const accessToken = await refreshConnection(clients, connection)
  await ensureArchiveRoot(clients, connection, accessToken)
  return cloudArchiveStatus(clients, organizationId)
}

export async function queueCloudSyncs(clients, organizationId, inspectionIds) {
  const unique = [...new Set(inspectionIds)].slice(0, 100)
  const { data: permitted, error } = await clients.checkvan.from('checkvan_inspections').select('id').eq('organization_id', organizationId).eq('upload_status', 'available').in('id', unique)
  if (error) throw new Error('CLOUD_ARCHIVE_UNAVAILABLE')
  const allowed = permitted.map(item => item.id), results = []
  for (const id of allowed) results.push(await syncInspectionToGoogleDrive(clients, organizationId, id))
  return { synced: results.filter(result => result.status === 'SYNCED').length, alreadyPresent: results.filter(result => result.status === 'ALREADY_SYNCED').length, failed: results.filter(result => result.status === 'FAILED').length, requested: allowed.length }
}
