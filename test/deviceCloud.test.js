import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import test from 'node:test'
import { authenticateDeviceRequest, canonicalDeviceRequest, resolveDeviceContext } from '../api/_lib/deviceAuthentication.js'
import { handleDeviceInspectionFinalize } from '../api/device-inspection-finalize.js'
import { handleDeviceInspectionUpload, matchesOperationalAssignment } from '../api/device-inspection-upload.js'

const device = { id: '10000000-0000-4000-8000-000000000001' }
const otherDevice = { id: '10000000-0000-4000-8000-000000000002' }
const organization = { id: '20000000-0000-4000-8000-000000000001', retention_days: 730, status: 'active' }
const context = { organization, assignment: { id: '30000000-0000-4000-8000-000000000001', license_id: '40000000-0000-4000-8000-000000000001', founder_entitlement_id: null } }
const body = {
  deviceGeneratedId: '50000000-0000-4000-8000-000000000001', inspectionType: 'pickup', vehiclePlate: 'AB-123-CD',
  vehicleDescription: 'Daily 35S', inspectedAt: '2026-08-21T10:00:00.000Z', deviceTimezone: 'Europe/Rome',
  routeUsed: 'CA_A26',
  documentHash: 'ab'.repeat(32), documentSizeBytes: 1234, documentFormatVersion: 1, appVersion: '1.0.0',
  vehicleId: '80000000-0000-4000-8000-000000000001', driverId: '70000000-0000-4000-8000-000000000001', driverFirstName: 'Test', driverLastName: 'Driver', assignmentDate: '2026-08-21',
}

test('company driver snapshot must match the effective QR operational assignment', () => {
  const snapshot = {
    driverId: '70000000-0000-4000-8000-000000000001',
    vehicleId: '80000000-0000-4000-8000-000000000001',
    assignmentDate: '2026-08-21',
  }
  const entries = [{ driver_id: snapshot.driverId, vehicle_id: snapshot.vehicleId, assignment_date: snapshot.assignmentDate, work_status: 'TURNO' }]
  assert.equal(matchesOperationalAssignment(entries, snapshot), true)
  assert.equal(matchesOperationalAssignment(entries, { ...snapshot, driverId: '70000000-0000-4000-8000-000000000002' }), false)
  assert.equal(matchesOperationalAssignment([{ ...entries[0], work_status: 'RIPOSO' }], snapshot), false)
})

function responseRecorder() {
  return { statusCode: null, body: null, headers: {}, status(code) { this.statusCode = code; return this }, setHeader(name, value) { this.headers[name] = value; return this }, json(value) { this.body = value; return this } }
}

class Query {
  constructor(database, table) { this.database = database; this.table = table; this.filters = []; this.operation = 'select'; this.value = null }
  select() { return this }
  eq(column, value) { this.filters.push([column, value]); return this }
  insert(value) { this.operation = 'insert'; this.value = value; return this }
  update(value) { this.operation = 'update'; this.value = value; return this }
  maybeSingle() { return this.execute(true) }
  single() { return this.execute(false) }
  then(resolve, reject) { return this.execute(false).then(resolve, reject) }
  async execute(optional) {
    const rows = this.database.tables[this.table] ?? []
    if (this.operation === 'insert') {
      if (this.table === 'checkvan_inspections' && rows.some((row) => row.device_id === this.value.device_id && row.device_generated_id === this.value.device_generated_id)) return { data: null, error: new Error('duplicate') }
      rows.push({ ...this.value }); this.database.tables[this.table] = rows; return { data: { ...this.value }, error: null }
    }
    const matching = rows.filter((row) => this.filters.every(([column, value]) => row[column] === value))
    if (this.operation === 'update') { matching.forEach((row) => Object.assign(row, this.value)); return { data: matching, error: null } }
    if (matching.length > 1 && !optional) return { data: null, error: new Error('multiple') }
    return { data: matching[0] ?? null, error: null }
  }
}

function memoryClients() {
  const database = { tables: { checkvan_inspections: [], checkvan_license_devices: [], checkvan_vehicles: [{ id: body.vehicleId, internal_code: body.vehicleDescription, plate_normalized: 'AB123CD', status: 'active', organization_id: organization.id }] }, objects: new Map() }
  const checkvan = {
    from: (table) => new Query(database, table),
    rpc: async () => ({ data: { entries: [ { driver_id: body.driverId, vehicle_id: body.vehicleId, assignment_date: body.assignmentDate, work_status: 'TURNO' } ], overrides: [], daily: [] }, error: null }),
    storage: { from: (bucket) => ({
      createSignedUploadUrl: async (path) => ({ data: { token: `token:${path}`, signedUrl: `/signed/${path}` }, error: null }),
      list: async (folder, options) => {
        const object = database.objects.get(`${bucket}/${folder}/${options.search}`)
        return { data: object ? [object] : [], error: null }
      },
    }) },
  }
  return { clients: { checkvan }, database }
}

const uploadDependencies = (clients, selectedDevice = device, selectedContext = context) => ({
  clients, authenticate: async () => selectedDevice, resolveContext: async () => selectedContext,
  requireIdentity: async () => ({ driver: { id: body.driverId, first_name: body.driverFirstName, last_name: body.driverLastName } }),
  tusEndpoint: 'http://127.0.0.1:54321/storage/v1/upload/resumable',
  randomUUID: () => selectedDevice.id === device.id
    ? '60000000-0000-4000-8000-000000000001'
    : '60000000-0000-4000-8000-000000000002',
  now: () => Date.parse('2026-08-21T11:00:00.000Z'),
})

async function upload(clients, requestBody = body, selectedDevice = device, selectedContext = context) {
  const response = responseRecorder()
  await handleDeviceInspectionUpload({ method: 'POST', body: requestBody }, response, uploadDependencies(clients, selectedDevice, selectedContext))
  return response
}

test('first create-upload creates one inspection and returns resumable information', async () => {
  const { clients, database } = memoryClients()
  const response = await upload(clients)
  assert.equal(response.statusCode, 201)
  assert.equal(response.body.inspectionId, '60000000-0000-4000-8000-000000000001')
  assert.equal(response.body.status, 'uploading')
  assert.equal(response.body.recovered, false)
  assert.equal(response.body.signedUploadUrl, 'http://127.0.0.1:54321/storage/v1/upload/resumable')
  assert.equal(database.tables.checkvan_inspections.length, 1)
})

test('retry with new requestId and same deviceGeneratedId/hash/size recovers the same inspection', async () => {
  const { clients, database } = memoryClients()
  const first = await upload(clients)
  const retry = await upload(clients)
  assert.equal(retry.statusCode, 200)
  assert.equal(retry.body.inspectionId, first.body.inspectionId)
  assert.equal(retry.body.recovered, true)
  assert.equal(database.tables.checkvan_inspections.length, 1)
})

test('same deviceGeneratedId with incompatible hash is a real conflict', async () => {
  const { clients } = memoryClients()
  await upload(clients)
  const response = await upload(clients, { ...body, documentHash: 'cd'.repeat(32) })
  assert.equal(response.statusCode, 409)
  assert.deepEqual(response.body, { error: 'INSPECTION_CONFLICT' })
})

test('a retry cannot alter the route snapshot of an existing inspection', async () => {
  const { clients, database } = memoryClients()
  await upload(clients)
  const response = await upload(clients, { ...body, routeUsed: 'CA_A27' })
  assert.equal(response.statusCode, 409)
  assert.deepEqual(response.body, { error: 'INSPECTION_CONFLICT' })
  assert.equal(database.tables.checkvan_inspections[0].route_used, 'CA_A26')
})

test('route snapshot validation is optional for legacy uploads and bounded when supplied', async () => {
  const { clients } = memoryClients()
  assert.equal((await upload(clients, { ...body, routeUsed: undefined })).statusCode, 201)
  assert.deepEqual((await upload(memoryClients().clients, { ...body, routeUsed: 'x'.repeat(101) })).body, { error: 'INVALID_ROUTE_USED' })
})

test('expired QR identity cannot create an inspection with a route snapshot', async () => {
  const { clients, database } = memoryClients(); const response = responseRecorder()
  await handleDeviceInspectionUpload({ method: 'POST', body }, response, {
    ...uploadDependencies(clients),
    requireIdentity: async () => { throw Object.assign(new Error('DRIVER_SESSION_EXPIRED'), { status: 401 }) },
  })
  assert.equal(response.statusCode, 401)
  assert.equal(database.tables.checkvan_inspections.length, 0)
})

test('a signed device cannot attribute an inspection to a different valid colleague', async () => {
  const { clients, database } = memoryClients(); const response = responseRecorder()
  await handleDeviceInspectionUpload({ method: 'POST', body }, response, {
    ...uploadDependencies(clients),
    requireIdentity: async () => ({ driver: { id: '70000000-0000-4000-8000-000000000099', first_name: 'Other', last_name: 'Driver' } }),
  })
  assert.equal(response.statusCode, 403); assert.deepEqual(response.body, { error: 'DRIVER_IDENTITY_MISMATCH' }); assert.equal(database.tables.checkvan_inspections.length, 0)
})

test('same deviceGeneratedId of another device cannot recover the first device inspection', async () => {
  const { clients, database } = memoryClients()
  const first = await upload(clients)
  const second = await upload(clients, body, otherDevice, { ...context, assignment: { ...context.assignment, id: 'assignment-other' } })
  assert.equal(second.statusCode, 201)
  assert.notEqual(second.body.inspectionId, first.body.inspectionId)
  assert.equal(database.tables.checkvan_inspections.length, 2)
})

test('finalize succeeds once and repeated finalize is idempotent without changing hash/path', async () => {
  const { clients, database } = memoryClients()
  const created = await upload(clients)
  const row = database.tables.checkvan_inspections[0]
  const original = { hash: row.document_hash, path: row.storage_object_path }
  database.objects.set(`${row.storage_bucket}/${row.storage_object_path}`, { name: 'document.pdf', metadata: { size: body.documentSizeBytes } })
  const request = { method: 'POST', body: { inspectionId: created.body.inspectionId } }
  const dependencies = { clients, authenticate: async () => device, resolveContext: async () => context, requireIdentity: async () => ({ driver: { id: body.driverId } }), now: () => Date.parse('2026-08-21T12:00:00.000Z') }
  const first = responseRecorder(); await handleDeviceInspectionFinalize(request, first, dependencies)
  const repeated = responseRecorder(); await handleDeviceInspectionFinalize(request, repeated, dependencies)
  assert.equal(first.statusCode, 200); assert.equal(repeated.statusCode, 200)
  assert.deepEqual(repeated.body, { inspectionId: created.body.inspectionId, status: 'available', finalizedAt: '2026-08-21T12:00:00.000Z' })
  assert.equal(row.document_hash, original.hash); assert.equal(row.storage_object_path, original.path)
})

test('a confirmed return revokes only the verified driver session', async () => {
  const { clients, database } = memoryClients()
  const created = await upload(clients, { ...body, inspectionType: 'return' })
  const row = database.tables.checkvan_inspections[0]
  database.objects.set(`${row.storage_bucket}/${row.storage_object_path}`, { name: 'document.pdf', metadata: { size: body.documentSizeBytes } })
  const revoked = []
  const response = responseRecorder()
  await handleDeviceInspectionFinalize({ method: 'POST', body: { inspectionId: created.body.inspectionId } }, response, {
    clients,
    authenticate: async () => device,
    resolveContext: async () => context,
    requireIdentity: async () => ({ driver: { id: body.driverId }, session: { id: 'verified-session' } }),
    revokeIdentity: async (_clients, session) => { revoked.push(session.id) },
    now: () => Date.parse('2026-08-21T12:00:00.000Z'),
  })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(revoked, ['verified-session'])
})

test('finalize rejects missing/wrong-path objects and incompatible size', async () => {
  for (const object of [null, { name: 'document.pdf', metadata: { size: body.documentSizeBytes + 1 } }]) {
    const { clients, database } = memoryClients(); const created = await upload(clients); const row = database.tables.checkvan_inspections[0]
    if (object) database.objects.set(`${row.storage_bucket}/${row.storage_object_path}`, object)
    const response = responseRecorder()
    await handleDeviceInspectionFinalize({ method: 'POST', body: { inspectionId: created.body.inspectionId } }, response, { clients, authenticate: async () => device, resolveContext: async () => context, requireIdentity: async () => ({ driver: { id: body.driverId } }) })
    assert.equal(response.statusCode, 409)
    assert.ok(['UPLOAD_NOT_FOUND', 'UPLOAD_SIZE_MISMATCH'].includes(response.body.error))
    assert.equal(row.upload_status, 'uploading')
  }
})

test('organization isolation prevents finalize through another context', async () => {
  const { clients } = memoryClients(); const created = await upload(clients); const response = responseRecorder()
  await handleDeviceInspectionFinalize({ method: 'POST', body: { inspectionId: created.body.inspectionId } }, response, {
    clients, authenticate: async () => device, resolveContext: async () => ({ ...context, organization: { ...organization, id: 'other-org' } }), requireIdentity: async () => ({ driver: { id: body.driverId } }),
  })
  assert.equal(response.statusCode, 404)
  assert.deepEqual(response.body, { error: 'INSPECTION_NOT_FOUND' })
})

function authenticationClients({ revoked = false, mismatchedDeviceKey = false, normalizedKeyMissing = false } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const publicKeySpkiBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
  const key = { key_id: 'sha256:test', device_key_id: '70000000-0000-4000-8000-000000000001', key_version: 1, public_key_spki_base64: publicKeySpkiBase64, algorithm: 'ECDSA_P256_SHA256', status: 'active' }
  const storedDevice = { id: device.id, key_id: key.key_id, device_key_id: mismatchedDeviceKey ? 'different' : key.device_key_id, key_version: 1, public_key_spki_base64: publicKeySpkiBase64, algorithm: 'ECDSA_P256_SHA256', status: revoked ? 'revoked' : 'active' }
  const calls = []
  const requestIds = new Set()
  const client = { from(table) { return {
    select() { return this }, eq(column, value) { calls.push([table, column, value]); return this },
    maybeSingle: async () => ({ data: table === 'checkvan_device_keys' ? (normalizedKeyMissing ? null : key) : storedDevice, error: null }),
    insert: async (value) => {
      if (requestIds.has(value.request_id)) return { data: null, error: new Error('duplicate') }
      requestIds.add(value.request_id); return { data: null, error: null }
    },
  } } }
  return { clients: { checkvan: client }, privateKey, key, calls, requestIds }
}

function signedRequest(auth) {
  const request = { method: 'POST', url: '/api/device-inspection-upload', body, headers: {
    'x-checkvan-device-id': device.id, 'x-checkvan-key-id': auth.key.key_id,
    'x-checkvan-timestamp': new Date().toISOString(), 'x-checkvan-request-id': crypto.randomUUID(),
  } }
  request.headers['x-checkvan-signature'] = sign('sha256', Buffer.from(canonicalDeviceRequest(request, body)), auth.privateKey).toString('base64')
  return request
}

test('authentication binds database deviceId to the registered deviceKeyId/keyId/public key', async () => {
  const auth = authenticationClients(); const result = await authenticateDeviceRequest(signedRequest(auth), auth.clients)
  assert.equal(result.id, device.id)
  assert.ok(auth.calls.some(([, column, value]) => column === 'id' && value === device.id))
})

test('authentication supports an enrolled legacy device whose complete identity is stored on the device row', async () => {
  const auth = authenticationClients({ normalizedKeyMissing: true })
  const result = await authenticateDeviceRequest(signedRequest(auth), auth.clients)
  assert.equal(result.id, device.id)
})

test('revoked or key-mismatched devices are rejected', async () => {
  for (const options of [{ revoked: true }, { mismatchedDeviceKey: true }]) {
    const auth = authenticationClients(options)
    await assert.rejects(authenticateDeviceRequest(signedRequest(auth), auth.clients), (error) => error.status === 401 && error.message === 'DEVICE_AUTH_INVALID')
  }
})

test('replay of the same requestId is rejected', async () => {
  const auth = authenticationClients(); const request = signedRequest(auth)
  await authenticateDeviceRequest(request, auth.clients)
  await assert.rejects(authenticateDeviceRequest(request, auth.clients), (error) => error.status === 409 && error.message === 'DEVICE_REQUEST_REPLAYED')
})

test('application retry with a fresh requestId is accepted by anti-replay', async () => {
  const auth = authenticationClients()
  const first = signedRequest(auth); const second = signedRequest(auth)
  assert.notEqual(first.headers['x-checkvan-request-id'], second.headers['x-checkvan-request-id'])
  await authenticateDeviceRequest(first, auth.clients); await authenticateDeviceRequest(second, auth.clients)
  assert.equal(auth.requestIds.size, 2)
})

test('invalid assignment/license/grant is rejected server-side', async () => {
  const assignments = [{ data: null, error: null }, { data: { id: 'assignment', license_id: 'license' }, error: null }]
  for (const assignmentResult of assignments) {
    const client = { from(table) { return { select() { return this }, eq() { return this }, maybeSingle: async () => {
      if (table === 'checkvan_device_assignments') return assignmentResult
      if (table === 'checkvan_founder_entitlements') return { data: null, error: null }
      if (table === 'checkvan_licenses') return { data: { id: 'license', status: 'active', product_mode: 'company', cloud_enabled: true, access_grant: 'INVALID', starts_at: '2026-01-01' }, error: null }
      return { data: organization, error: null }
    } } } }
    await assert.rejects(resolveDeviceContext(device, { checkvan: client }), (error) => error.status === 403)
  }
})
