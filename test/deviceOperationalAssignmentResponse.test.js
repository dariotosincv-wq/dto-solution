import assert from 'node:assert/strict'
import test from 'node:test'
import { confirmedOperationalAssignment } from '../api/_lib/deviceOperationalAssignment.js'

const driver = { id: 'driver-1', first_name: 'Mario', last_name: 'Rossi' }
const day = rows => ({ day: { revision: 2 }, rows })

test('confirmed operational day exposes only the authenticated driver snapshot and global departure order', () => {
  const result = confirmedOperationalAssignment(day([{ driver_id: 'driver-1', work_status: 'TURNO', vehicle_id: 'van-1', vehicle_internal_code_snapshot: 'S116', vehicle_plate_snapshot: 'AA000AA', route_snapshot: 'CA_A26', departure_order: 34, source: 'pdf' }]), driver, '2026-10-15')
  assert.deepEqual(result, { date: '2026-10-15', driver, status: 'TURNO', assignment: { vehicle_id: 'van-1', internal_code: 'S116', plate: 'AA000AA', silhouette_category: 'NON_SPECIFICATA', route: 'CA_A26', notes: null, source: 'pdf' }, departure_order: 34, assignment_state: 'CONFIRMED' })
})

test('confirmed day does not fall back to an older assignment when the driver is not convoked', () => {
  const result = confirmedOperationalAssignment(day([{ driver_id: 'another-driver', work_status: 'TURNO' }]), driver, '2026-10-15')
  assert.equal(result.status, 'NOT_CONVOKED')
  assert.equal(result.assignment, null)
  assert.equal(result.assignment_state, 'CONFIRMED')
})

test('absence is confirmed without inventing a vehicle, route, or departure order', () => {
  const result = confirmedOperationalAssignment(day([{ driver_id: 'driver-1', work_status: 'FERIE', vehicle_id: null, departure_order: null }]), driver, '2026-10-15')
  assert.equal(result.status, 'FERIE')
  assert.equal(result.assignment, null)
  assert.equal(result.departure_order, null)
})
