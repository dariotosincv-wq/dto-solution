import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { matchOperationalDayPreviews } from '../company/src/lib/operationalDayMatchingCore.js'

const convocationRow = (driver_name, overrides = {}) => ({ driver_name, shift_type: 'TURNO', internal_vehicle_code: 'MP-06', vehicle_plate: 'FX560XP', ...overrides })
const assignmentRow = (driver_name, overrides = {}) => ({ driver_name, departure_group: 2, route: 'CA_A23', parking_lot_position: 8, departure_wave: 1, departure_order: 9, ...overrides })
const previews = (convocationRows, assignmentRows) => ({ convocation: { convocation_date: '2030-10-15', rows: convocationRows }, assignment: { departure_date: null, departure_date_status: 'not_verifiable_from_content', rows: assignmentRows } })

test('matches a complete fake driver despite harmless case, whitespace and accent differences', () => {
  const result = matchOperationalDayPreviews(previews([convocationRow('D’Angélo   Luigi')], [assignmentRow(' d angelo luigi ')]))
  assert.equal(result.operational_date, '2030-10-15')
  assert.equal(result.assignment_departure_date_status, 'not_verifiable_from_content')
  assert.deepEqual(result.rows, [{ status: 'MATCHED', operational_date: '2030-10-15', driver_id: null, driver_name: 'D’Angélo   Luigi', driver_name_key: 'D ANGELO LUIGI', shift_type: 'TURNO', internal_vehicle_code: 'MP-06', vehicle_plate: 'FX560XP', departure_group: 2, route: 'CA_A23', parking_lot_position: 8, atlas_indication: null, departure_wave: 1, departure_order: 9 }])
  assert.deepEqual(result.outcomes, [])
})

test('reports fake missing drivers and required fields without choosing or inventing data', () => {
  const result = matchOperationalDayPreviews(previews([convocationRow('SOLO CONVOCAZIONE'), convocationRow('DATI INCOMPLETI', { vehicle_plate: null })], [assignmentRow('SOLO USCITA'), assignmentRow('DATI INCOMPLETI')]))
  assert.equal(result.rows.length, 0)
  assert.deepEqual(result.outcomes.map(({ status, issues }) => ({ status, issues })), [
    { status: 'MANCANTE', issues: ['CONVOCATION_REQUIRED_DATA_MISSING'] },
    { status: 'MANCANTE', issues: ['MISSING_IN_ASSIGNMENT_DEPARTURE'] },
    { status: 'MANCANTE', issues: ['MISSING_IN_CONVOCATION'] },
  ])
})

test('reports duplicate fake names on either source as ambiguous instead of selecting one candidate', () => {
  const result = matchOperationalDayPreviews(previews([convocationRow('OMONIMO'), convocationRow('OMONIMO', { vehicle_plate: 'AA123BB' })], [assignmentRow('OMONIMO'), assignmentRow('OMONIMO', { departure_order: 10 })]))
  assert.deepEqual(result.rows, [])
  assert.deepEqual(result.outcomes, [{ status: 'AMBIGUO', driver_name: 'OMONIMO', driver_name_key: 'OMONIMO', issues: ['DUPLICATE_CONVOCATION_DRIVER', 'DUPLICATE_ASSIGNMENT_DRIVER'] }])
})

test('reports fake rows without a driver name as missing', () => {
  const result = matchOperationalDayPreviews(previews([convocationRow(null)], [assignmentRow(null)]))
  assert.equal(result.rows.length, 0)
  assert.deepEqual(result.outcomes, [
    { status: 'MANCANTE', driver_name: null, driver_name_key: null, issues: ['DRIVER_NAME_NOT_FOUND'] },
    { status: 'MANCANTE', driver_name: null, driver_name_key: null, issues: ['DRIVER_NAME_NOT_FOUND'] },
  ])
})

test('matches differently named fake rows only when both source-specific variants confirm the same driver', () => {
  const driverId = '60000000-0000-4000-8000-000000000099'
  const result = matchOperationalDayPreviews({
    ...previews([convocationRow('NOME CORTO')], [assignmentRow('NOME CORTO ESTESO')]),
    confirmed_driver_name_variants: [
      { driver_id: driverId, source: 'convocation', normalized_name: 'NOME CORTO' },
      { driver_id: driverId, source: 'assignment_departure', normalized_name: 'NOME CORTO ESTESO' },
    ],
  })
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].driver_id, driverId)
  assert.deepEqual(result.outcomes, [])
})

test('does not use an unconfirmed or conflicting fake variant', () => {
  const unconfirmed = matchOperationalDayPreviews(previews([convocationRow('NOME A')], [assignmentRow('NOME B')]))
  assert.equal(unconfirmed.rows.length, 0)
  assert.deepEqual(unconfirmed.outcomes.map((outcome) => outcome.status), ['MANCANTE', 'MANCANTE'])
  const conflicting = matchOperationalDayPreviews({
    ...previews([convocationRow('NOME A')], [assignmentRow('NOME A')]),
    confirmed_driver_name_variants: [{ driver_id: '60000000-0000-4000-8000-000000000098', source: 'convocation', normalized_name: 'NOME A' }, { driver_id: '60000000-0000-4000-8000-000000000097', source: 'assignment_departure', normalized_name: 'NOME A' }],
  })
  assert.deepEqual(conflicting.outcomes.map((outcome) => outcome.status), ['AMBIGUO'])
})

test('matching core accepts only temporary parser objects and contains no PDF or persistence access', () => {
  const source = readFileSync(new URL('../company/src/lib/operationalDayMatchingCore.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /pdf|arrayBuffer|fetch|localStorage|sessionStorage|indexedDB|supabase/i)
})
