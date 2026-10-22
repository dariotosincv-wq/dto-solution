import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildOperationalDayImportPreview, mergeAssignmentDeparturePreviews, previewRowId } from '../company/src/lib/operationalDayImportPreview.js'

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

const assignmentFile = (file_name, rows) => ({ file_name, preview: { rows, outcomes: [] } })
const assignmentRow = (driver_name, overrides = {}) => ({
  row: 1,
  status: 'parsed',
  driver_name,
  departure_group: 1,
  route: 'CA_A01',
  parking_lot_position: 1,
  departure_wave: 1,
  departure_order: 1,
  ...overrides,
})

test('merges two complementary assignment PDFs into one ordered preview', () => {
  const merged = mergeAssignmentDeparturePreviews([
    assignmentFile('uscita-1.pdf', [assignmentRow('AUTISTA AUTOMATICO')]),
    assignmentFile('uscita-2.pdf', [assignmentRow('AUTISTA CORTO', { route: 'CA_A02' })]),
  ])
  const result = buildOperationalDayImportPreview({ convocation, assignment: merged })
  assert.equal(merged.rows.length, 2)
  assert.deepEqual(merged.rows.map(row => row.departure_order), [1, 2])
  assert.deepEqual(result.rows.map(row => row.assignment_sources[0].file_name), ['uscita-1.pdf', 'uscita-2.pdf'])
})

test('merges three assignment PDFs in selected-file order', () => {
  const merged = mergeAssignmentDeparturePreviews([
    assignmentFile('uscita-1.pdf', [assignmentRow('AUTISTA 1')]),
    assignmentFile('uscita-2.pdf', [assignmentRow('AUTISTA 2')]),
    assignmentFile('uscita-3.pdf', [assignmentRow('AUTISTA 3')]),
  ])
  assert.deepEqual(merged.rows.map(row => [row.driver_name, row.departure_order, row.source_files[0].file_name]), [
    ['AUTISTA 1', 1, 'uscita-1.pdf'],
    ['AUTISTA 2', 2, 'uscita-2.pdf'],
    ['AUTISTA 3', 3, 'uscita-3.pdf'],
  ])
})

test('keeps the existing single-assignment-PDF flow compatible', () => {
  const merged = mergeAssignmentDeparturePreviews([
    assignmentFile('uscita.pdf', [assignmentRow('AUTISTA AUTOMATICO')]),
  ])
  const result = buildOperationalDayImportPreview({ convocation, assignment: merged })
  assert.equal(merged.rows.length, 1)
  assert.equal(merged.rows[0].departure_order, 1)
  assert.equal(result.rows.length, 1)
})

test('deduplicates an identical assignment row while retaining both source files', () => {
  const merged = mergeAssignmentDeparturePreviews([
    assignmentFile('uscita-a.pdf', [assignmentRow('AUTISTA DUPLICATO')]),
    assignmentFile('uscita-b.pdf', [assignmentRow('AUTISTA DUPLICATO')]),
  ])
  assert.equal(merged.rows.length, 1)
  assert.deepEqual(merged.rows[0].source_files.map(source => source.file_name), ['uscita-a.pdf', 'uscita-b.pdf'])
  assert.deepEqual(merged.outcomes, [])
})

test('keeps incompatible duplicate assignment drivers as a sourced ambiguity', () => {
  const merged = mergeAssignmentDeparturePreviews([
    assignmentFile('uscita-a.pdf', [assignmentRow('AUTISTA DUPLICATO')]),
    assignmentFile('uscita-b.pdf', [assignmentRow('AUTISTA DUPLICATO', { route: 'CA_A99' })]),
  ])
  assert.equal(merged.rows.length, 0)
  assert.deepEqual(merged.outcomes[0].issues, ['DUPLICATE_ASSIGNMENT_DRIVER_ACROSS_FILES'])
  assert.deepEqual(merged.outcomes[0].assignment_sources.map(source => source.file_name), ['uscita-a.pdf', 'uscita-b.pdf'])
})

test('keeps incompatible vehicle assignments out of automatic matches', () => {
  const duplicateVehicleConvocation = {
    convocation_date: '2030-10-15',
    rows: [
      { row: 1, status: 'parsed', driver_name: 'AUTISTA UNO', shift_type: 'TURNO', internal_vehicle_code: 'M-01', vehicle_plate: 'AA123BB' },
      { row: 2, status: 'parsed', driver_name: 'AUTISTA DUE', shift_type: 'TURNO', internal_vehicle_code: 'M-01', vehicle_plate: 'AA123BB' },
    ],
  }
  const result = buildOperationalDayImportPreview({
    convocation: duplicateVehicleConvocation,
    assignment: mergeAssignmentDeparturePreviews([
      assignmentFile('uscita.pdf', [assignmentRow('AUTISTA UNO'), assignmentRow('AUTISTA DUE', { row: 2, departure_order: 2 })]),
    ]),
  })
  assert.equal(result.rows.length, 0)
  assert.equal(result.summary.ambiguous, 2)
  assert.ok(result.outcomes.every(outcome => outcome.issues.includes('DUPLICATE_VEHICLE_ASSIGNMENT')))
})

test('import preview UI has no persistence or network path', () => {
  const source = readFileSync(new URL('../company/src/pages/OperationalDayImportPreviewPage.jsx', import.meta.url), 'utf8')
  assert.match(source, /multiple/)
  assert.match(source, /mergeAssignmentDeparturePreviews/)
  assert.match(source, /ASSIGNMENT_FILE_INVALID/)
  assert.match(source, /CONVOCATION_FILE_INVALID/)
  assert.doesNotMatch(source, /\b(fetch|localStorage|sessionStorage|indexedDB|supabase)\b/)
})
