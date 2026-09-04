import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import uploadHandler from '../api/device-inspection-upload.js'
import finalizeHandler from '../api/device-inspection-finalize.js'
import inspectionsHandler from '../api/company-inspections.js'
import downloadHandler from '../api/company-inspection-download.js'
import { canonicalDeviceRequest } from '../api/_lib/deviceAuthentication.js'

const url = process.env.CHECKVAN_SUPABASE_URL
const serviceKey = process.env.CHECKVAN_SUPABASE_SERVICE_ROLE_KEY
const publishableKey = process.env.DTO_SUPABASE_ANON_KEY

function recorder() {
  return { statusCode: null, headers: {}, body: null, status(code) { this.statusCode = code; return this }, setHeader(name, value) { this.headers[name] = value; return this }, json(body) { this.body = body; return this } }
}

async function signedPost(handler, path, body, identity, requestId = randomUUID()) {
  const timestamp = new Date().toISOString()
  const request = { method: 'POST', url: path, body, headers: { 'x-checkvan-device-id': identity.deviceId, 'x-checkvan-key-id': identity.keyId, 'x-checkvan-request-id': requestId, 'x-checkvan-timestamp': timestamp } }
  request.headers['x-checkvan-signature'] = sign('sha256', Buffer.from(canonicalDeviceRequest(request, body)), identity.privateKey).toString('base64')
  const response = recorder(); await handler(request, response); return response
}

async function companyGet(handler, token, query) {
  const response = recorder(); await handler({ method: 'GET', headers: { authorization: `Bearer ${token}` }, query }, response); return response
}

async function companyPost(handler, token, body) {
  const response = recorder(); await handler({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body }, response); return response
}

const b64 = (value) => Buffer.from(value).toString('base64')

test('signed device PDF reaches local TUS, finalize, database and Company Area', { skip: !url || !serviceKey || !publishableKey }, async (t) => {
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const browser = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const spki = publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
  const keyId = `sha256:${createHash('sha256').update(Buffer.from(spki, 'base64')).digest('base64url')}`
  const deviceKeyId = randomUUID(); const deviceId = randomUUID(); const deviceGeneratedId = randomUUID()
  const email = `company-cloud-e2e-${randomUUID()}@example.test`; const password = `Local-${randomUUID()}-Pass!`
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')
  const documentHash = createHash('sha256').update(pdf).digest('hex')
  let userId; let inspectionId; let objectPath

  t.after(async () => {
    if (objectPath) await service.storage.from('checkvan-company-inspections').remove([objectPath])
    if (inspectionId) await service.from('checkvan_inspections').delete().eq('id', inspectionId)
    await service.from('checkvan_device_request_nonces').delete().eq('device_id', deviceId)
    await service.from('checkvan_device_assignments').delete().eq('device_id', deviceId)
    await service.from('checkvan_license_devices').delete().eq('id', deviceId)
    await service.from('checkvan_device_keys').delete().eq('key_id', keyId)
    if (userId) { await service.from('checkvan_area_memberships').delete().eq('auth_subject', userId); await service.auth.admin.deleteUser(userId) }
  })

  const { data: license, error: licenseError } = await service.from('checkvan_licenses').select('id,organization_id').eq('access_grant', 'TESTER').eq('status', 'active').single(); assert.ifError(licenseError)
  assert.ifError((await service.from('checkvan_device_keys').insert({ key_id: keyId, device_key_id: deviceKeyId, key_version: 1, public_key_spki_base64: spki })).error)
  assert.ifError((await service.from('checkvan_license_devices').insert({ id: deviceId, key_id: keyId, device_key_id: deviceKeyId, key_version: 1, public_key_spki_base64: spki })).error)
  assert.ifError((await service.from('checkvan_device_assignments').insert({ license_id: license.id, device_id: deviceId, status: 'active' })).error)
  const { data: created, error: createUserError } = await service.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(createUserError); userId = created.user.id
  assert.ifError((await service.from('checkvan_area_memberships').insert({ organization_id: license.organization_id, auth_subject: userId, role: 'COMPANY_ADMIN', status: 'active' })).error)
  const { data: signedIn, error: signInError } = await browser.auth.signInWithPassword({ email, password }); assert.ifError(signInError)

  const body = { deviceGeneratedId, inspectionType: 'pickup', vehiclePlate: 'E2E TUS', vehicleDescription: 'PDF sintetico Task 4B', inspectedAt: new Date().toISOString(), deviceTimezone: 'Europe/Rome', documentHash, documentSizeBytes: pdf.length, documentFormatVersion: 1, appVersion: 'task-4b-local' }
  const identity = { deviceId, keyId, privateKey }
  const firstRequestId = randomUUID()
  const createdUpload = await signedPost(uploadHandler, '/api/device-inspection-upload', body, identity, firstRequestId)
  assert.equal(createdUpload.statusCode, 201, JSON.stringify(createdUpload.body)); inspectionId = createdUpload.body.inspectionId; objectPath = createdUpload.body.objectPath
  assert.equal(createdUpload.body.protocol, 'tus'); assert.equal(createdUpload.body.chunkSizeBytes, 6 * 1024 * 1024)
  assert.equal(typeof createdUpload.body.uploadToken, 'string')
  assert.equal(createdUpload.body.uploadToken.split('.').length, 3, `signed upload token segments: ${createdUpload.body.uploadToken.split('.').length}`)

  const recovered = await signedPost(uploadHandler, '/api/device-inspection-upload', body, identity)
  assert.equal(recovered.statusCode, 200); assert.equal(recovered.body.inspectionId, inspectionId); assert.equal(recovered.body.recovered, true)
  const replay = await signedPost(uploadHandler, '/api/device-inspection-upload', body, identity, firstRequestId)
  assert.equal(replay.statusCode, 409); assert.equal(replay.body.error, 'DEVICE_REQUEST_REPLAYED')

  const metadata = [['bucketName', createdUpload.body.bucket], ['objectName', objectPath], ['contentType', 'application/pdf']].map(([k, v]) => `${k} ${b64(v)}`).join(',')
  let controlAuth = false
  let creation = await fetch(createdUpload.body.signedUploadUrl, { method: 'POST', headers: { 'Tus-Resumable': '1.0.0', 'Upload-Length': String(pdf.length), 'Upload-Metadata': metadata, 'x-signature': createdUpload.body.uploadToken } })
  if (creation.status !== 201) {
    const signedError = await creation.text()
    assert.match(signedError, /Invalid Compact JWS/)
    t.diagnostic('Local Supabase Storage rejected its own signed TUS token (known local Storage bug); continuing with a service-role-only local control.')
    controlAuth = true
    creation = await fetch(createdUpload.body.signedUploadUrl, { method: 'POST', headers: { 'Tus-Resumable': '1.0.0', 'Upload-Length': String(pdf.length), 'Upload-Metadata': metadata, authorization: `Bearer ${serviceKey}` } })
  }
  assert.equal(creation.status, 201, await creation.text())
  const uploadUrl = new URL(creation.headers.get('location'), createdUpload.body.signedUploadUrl)
  const patchHeaders = { 'Tus-Resumable': '1.0.0', 'Upload-Offset': '0', 'Content-Type': 'application/offset+octet-stream', ...(controlAuth ? { authorization: `Bearer ${serviceKey}` } : { 'x-signature': createdUpload.body.uploadToken }) }
  const patch = await fetch(uploadUrl, { method: 'PATCH', headers: patchHeaders, body: pdf })
  assert.equal(patch.status, 204, await patch.text()); assert.equal(Number(patch.headers.get('upload-offset')), pdf.length)

  const finalized = await signedPost(finalizeHandler, '/api/device-inspection-finalize', { inspectionId }, identity)
  assert.equal(finalized.statusCode, 200); assert.equal(finalized.body.status, 'available'); assert.ok(finalized.body.finalizedAt)
  const finalizedAgain = await signedPost(finalizeHandler, '/api/device-inspection-finalize', { inspectionId }, identity)
  assert.equal(finalizedAgain.statusCode, 200); assert.equal(Date.parse(finalizedAgain.body.finalizedAt), Date.parse(finalized.body.finalizedAt))

  const { data: rows, error: rowError } = await service.from('checkvan_inspections').select('*').eq('device_id', deviceId).eq('device_generated_id', deviceGeneratedId); assert.ifError(rowError); assert.equal(rows.length, 1)
  const row = rows[0]; assert.equal(row.organization_id, license.organization_id); assert.equal(row.document_hash, documentHash); assert.equal(Number(row.document_size_bytes), pdf.length); assert.equal(row.storage_object_path, objectPath); assert.equal(row.upload_status, 'available'); assert.ok(row.finalized_at)
  const folder = objectPath.slice(0, objectPath.lastIndexOf('/')); const { data: objects, error: listError } = await service.storage.from(createdUpload.body.bucket).list(folder, { search: 'document.pdf' }); assert.ifError(listError); assert.equal(Number(objects.find((item) => item.name === 'document.pdf').metadata.size), pdf.length)

  const token = signedIn.session.access_token
  const visible = await companyGet(inspectionsHandler, token, { plate: 'E2E TUS', inspectionType: 'pickup', limit: '10', page: '0' })
  assert.equal(visible.statusCode, 200); assert.equal(visible.body.total, 1); assert.equal(visible.body.items[0].id, inspectionId)
  const downloadable = await companyPost(downloadHandler, token, { id: inspectionId }); assert.equal(downloadable.statusCode, 200)
  const downloaded = Buffer.from(await (await fetch(downloadable.body.url)).arrayBuffer()); assert.deepEqual(downloaded, pdf)
})
