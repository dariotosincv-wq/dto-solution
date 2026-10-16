import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildOperationalDayImportPreview, previewRowId } from '../company/src/lib/operationalDayImportPreview.js'

const convocation = { convocation_date: '2030-10-15', rows: [
  { row: 1, status: 'parsed', driver_name: 'AUTISTA AUTOMATICO', shift_type: 'TURNO', internal_vehicle_code: 'M-01', vehicle_plate: 'AA123BB' },
  { row: 2, status: 'parsed', driver_name: 'AUTISTA CORTO', shift_type: 'TURNO', internal_vehicle_code: 'M-02', vehicle_plate: 'CC456DD' },
] }
const assignment = { departure_date: null, departure_date_status: 'not_verifiable_from_content', rows: [
  { row: 1, status: 'parsed', driver_name: 'autista automatico', departure_group: 1, route: 'CA_A01', parking_lot_position: 0, departure_wave: 1, departure_order: 1 },
  { row: 2, status: 'parsed', driver_name: 'AUTISTA CORTO ESTESO', departure_group: 2, route: 'CA_A02', parking_lot_position: 0, departure_wave: 2, departure_order: 2 },
] }

test('preview summary stays in memory and includes a fake manual confirmation only once', () => {
  const withoutManual = buildOperationalDayImportPreview({ convocation, assignment })
  assert.deepEqual(withoutManual.summary, { convocation_rows: 2, assignment_rows: 2, complete_matches: 1, missing: 2, ambiguous: 0 })
  const manual = { id: 'fake-link', convocation_row_id: previewRowId('convocation', convocation.rows[1]), assignment_row_id: previewRowId('assignment_departure', assignment.rows[1]) }
  const withManual = buildOperationalDayImportPreview({ convocation, assignment, manual_links: [manual, manual] })
  assert.equal(withManual.rows.length, 2)
  assert.equal(withManual.rows[1].manual_confirmation, true)
  assert.deepEqual(withManual.summary, { convocation_rows: 2, assignment_rows: 2, complete_matches: 2, missing: 0, ambiguous: 0 })
})

test('preview rejects incomplete fake manual rows rather than inventing a result', () => {
  const incomplete = { ...assignment, rows: [{ ...assignment.rows[0], route: null }, assignment.rows[1]] }
  const result = buildOperationalDayImportPreview({ convocation, assignment: incomplete, manual_links: [{ id: 'bad', convocation_row_id: 'convocation:1', assignment_row_id: 'assignment_departure:1' }] })
  assert.equal(result.rows.length, 0)
  assert.equal(result.summary.complete_matches, 0)
})

test('import preview UI has no persistence or network path', () => {
  const source = readFileSync(new URL('../company/src/pages/OperationalDayImportPreviewPage.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\b(fetch|localStorage|sessionStorage|indexedDB|supabase)\b|file\.name/)
})
