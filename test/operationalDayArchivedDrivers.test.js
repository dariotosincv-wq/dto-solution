import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { canManageVehicles, ROLES } from '../company/src/access.js'
import { driverStatusUpdate } from '../api/_lib/companyDrivers.js'
import { requireCompanyAdmin } from '../api/_lib/companyVehicles.js'
import { prepareOperationalDayConfirmation } from '../company/src/lib/operationalDayConfirmation.js'

const driverId = '80000000-0000-4000-8000-000000000001'
const vehicleId = '80000000-0000-4000-8000-000000000002'
const row = {
  driver_name: 'NOME FITTIZIO',
  internal_vehicle_code: 'M-01',
  vehicle_plate: 'AA123BB',
  route: 'CA_A23',
  departure_order: 9,
  departure_group: 2,
  parking_lot_position: 8,
  departure_wave: 1,
}
const vehicle = { vehicle_id: vehicleId, internal_code: 'M-01', plate: 'AA123BB', status: 'active' }
const activeDriver = { driver_id: driverId, first_name: 'FITTIZIO', last_name: 'NOME', status: 'active' }
const archivedDriver = { ...activeDriver, status: 'archived', archived_at: '2030-01-01T00:00:00.000Z' }

test('active driver remains a valid confirmed row with its original departure fields', () => {
  const prepared = prepareOperationalDayConfirmation([row], [activeDriver], [vehicle])
  assert.equal(prepared.unresolved.length, 0)
  assert.deepEqual(prepared.rows[0], {
    driver_id: driverId,
    vehicle_id: vehicleId,
    work_status: 'TURNO',
    route: 'CA_A23',
    departure_order: 9,
    departure_group: 2,
    parking_lot_position: 8,
    departure_wave: 1,
    source: 'manual',
    notes: null,
  })
})

test('active driver is resolved when the PDF uses first name followed by last name', () => {
  const prepared = prepareOperationalDayConfirmation([{ ...row, driver_name: 'FITTIZIO NOME' }], [activeDriver], [vehicle])
  assert.equal(prepared.unresolved.length, 0)
  assert.equal(prepared.rows.length, 1)
  assert.equal(prepared.rows[0].driver_id, driverId)
})

test('ambiguous reversed names remain unresolved instead of choosing a driver', () => {
  const reverseNameDriver = { driver_id: '80000000-0000-4000-8000-000000000003', first_name: 'NOME', last_name: 'FITTIZIO', status: 'active' }
  const prepared = prepareOperationalDayConfirmation([{ ...row, driver_name: 'NOME FITTIZIO' }], [activeDriver, reverseNameDriver], [vehicle])
  assert.equal(prepared.rows.length, 0)
  assert.equal(prepared.unresolved.length, 1)
  assert.equal(prepared.unresolved[0].missing_driver, true)
})

test('an inactive vehicle remains unresolved even when the driver name is valid', () => {
  const prepared = prepareOperationalDayConfirmation([row], [activeDriver], [{ ...vehicle, status: 'inactive' }])
  assert.equal(prepared.rows.length, 0)
  assert.equal(prepared.unresolved.length, 1)
  assert.equal(prepared.unresolved[0].missing_driver, false)
  assert.equal(prepared.unresolved[0].missing_vehicle, true)
})

test('archived driver is distinguished from a missing driver without creating a duplicate', () => {
  const archived = prepareOperationalDayConfirmation([row], [archivedDriver], [vehicle])
  assert.equal(archived.rows.length, 0)
  assert.deepEqual(archived.unresolved[0].archived_driver, { driver_id: driverId, first_name: 'FITTIZIO', last_name: 'NOME' })
  assert.equal(archived.unresolved[0].missing_driver, false)
  assert.equal(archived.unresolved[0].departure_order, 9)

  const missing = prepareOperationalDayConfirmation([row], [], [vehicle])
  assert.equal(missing.rows.length, 0)
  assert.equal(missing.unresolved[0].archived_driver, null)
  assert.equal(missing.unresolved[0].missing_driver, true)
})

test('reactivation only changes archived status fields and never anagraphic data', () => {
  const at = '2030-01-02T03:04:05.000Z'
  assert.deepEqual(driverStatusUpdate('REACTIVATE', at), { status: 'active', archived_at: null, updated_at: at })
  assert.deepEqual(driverStatusUpdate('ARCHIVE', at), { status: 'archived', archived_at: at, updated_at: at })
  assert.equal(driverStatusUpdate('PROFILE', at), null)
})

test('the import UI and API require company-admin authorization for manual reactivation', async () => {
  assert.equal(canManageVehicles({ role: ROLES.COMPANY_ADMIN, capabilities: { useTools: true } }), true)
  assert.equal(canManageVehicles({ role: ROLES.COMPANY_OPERATOR, capabilities: { useTools: true } }), false)
  assert.throws(() => requireCompanyAdmin({ organization: { id: 'org' }, membership: { role: 'COMPANY_OPERATOR' } }), { message: 'COMPANY_ADMIN_REQUIRED', status: 403 })

  const [page, gateway] = await Promise.all([
    readFile(new URL('../company/src/pages/OperationalDayImportPreviewPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../api/platform.js', import.meta.url), 'utf8'),
  ])
  assert.match(page, /Driver archiviato:/)
  assert.match(page, /Riattiva driver/)
  assert.match(page, /action: 'REACTIVATE'/)
  assert.match(page, /setDirectory\(current/)
  assert.match(gateway, /const \{ user, context \} = await companyContext\(request, clients\)/)
  assert.match(gateway, /if \(isReactivate\) update = update\.eq\('status', 'archived'\)/)
  assert.match(gateway, /eq\('organization_id', context\.organization\.id\)/)
  assert.match(gateway, /DRIVER_NOT_ARCHIVED/)
})
