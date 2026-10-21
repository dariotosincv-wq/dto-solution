import assert from 'node:assert/strict'
import test from 'node:test'
import { confirmedDepartureRows, departureDriverLabel } from '../company/src/lib/operationalDeparturePreview.js'

test('pre-start shows only ordered TURNO rows of a confirmed operational day', () => {
  const rows = confirmedDepartureRows({ day: { status: 'confirmed' }, rows: [
    { id: 'two', work_status: 'TURNO', departure_order: 2 },
    { id: 'rest', work_status: 'RIPOSO', departure_order: null },
    { id: 'one', work_status: 'TURNO', departure_order: 1 },
  ] })
  assert.deepEqual(rows.map((row) => row.id), ['one', 'two'])
  assert.deepEqual(confirmedDepartureRows({ day: { status: 'draft' }, rows }), [])
})

test('pre-start driver labels use the confirmed day snapshots only', () => {
  assert.equal(departureDriverLabel({ driver_first_name_snapshot: 'Ada', driver_last_name_snapshot: 'Rossi' }), 'Ada Rossi')
  assert.equal(departureDriverLabel({}), 'Driver non disponibile')
})
