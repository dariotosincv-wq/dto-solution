import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeConvocationDriverName, parseConvocationDefinitiveItems, parseItalianVehicleReference } from '../company/src/lib/convocationDefinitiveCore.js'

const item = (page, x, y, text) => ({ page, x, y, page_width: 600, text })

test('convocation parser keeps only DELIVERY rows and extracts fake driver, shift and vehicle values', () => {
  const preview = parseConvocationDefinitiveItems([
    item(1, 30, 770, 'Convocazione definitiva 15/10/2030'),
    item(1, 30, 700, 'UFFICIO'),
    item(1, 30, 620, 'DELIVERY'),
    item(1, 30, 580, 'ALFA BETA'), item(1, 215, 580, 'Turno'), item(1, 90, 568, '(V-01-AA123BB)'),
    item(1, 330, 580, 'GAMMA DELTA'), item(1, 485, 580, 'Turno 2 Wave'), item(1, 390, 568, '(V-02-CC456DD)'),
    item(1, 30, 530, 'UFFICIO'), item(1, 30, 500, 'OMEGA UFFICIO'), item(1, 215, 500, 'Turno'), item(1, 90, 488, '(OFF-01-EE789FF)'),
  ])
  assert.equal(preview.convocation_date, '2030-10-15')
  assert.deepEqual(preview.rows, [
    { row: 1, status: 'parsed', driver_name: 'ALFA BETA', driver_name_key: 'ALFA BETA', shift_type: 'TURNO', internal_vehicle_code: 'V-01', vehicle_plate: 'AA123BB', issues: [] },
    { row: 2, status: 'parsed', driver_name: 'GAMMA DELTA', driver_name_key: 'GAMMA DELTA', shift_type: 'TURNO_2_WAVE', internal_vehicle_code: 'V-02', vehicle_plate: 'CC456DD', issues: [] },
  ])
  assert.deepEqual(preview.outcomes, [])
})

test('convocation parser accepts a fake driver name with a small PDF font baseline offset', () => {
  const preview = parseConvocationDefinitiveItems([
    item(1, 30, 620, 'DELIVERY'),
    item(1, 30, 586, 'NOME CON BASELINE DIVERSA'), item(1, 215, 580, 'Turno'), item(1, 90, 568, '(V-03-EE789FF)'),
  ])
  assert.deepEqual(preview.rows, [
    { row: 1, status: 'parsed', driver_name: 'NOME CON BASELINE DIVERSA', driver_name_key: 'NOME CON BASELINE DIVERSA', shift_type: 'TURNO', internal_vehicle_code: 'V-03', vehicle_plate: 'EE789FF', issues: [] },
  ])
})

test('convocation parser infers shifted two-column cells from TURNO anchors', () => {
  const preview = parseConvocationDefinitiveItems([
    item(1, 20, 700, 'DELIVERY'),
    item(1, 55, 650, 'ALFA BETA'), item(1, 260, 650, 'Turno'), item(1, 110, 635, '(V-01-AA123BB)'),
    item(1, 370, 650, 'GAMMA DELTA'), item(1, 515, 650, 'Turno'), item(1, 405, 635, '(V-02-CC456DD)'),
  ])
  assert.equal(preview.rows.filter((row) => row.status === 'parsed').length, 2)
  assert.equal(preview.rows[1].vehicle_plate, 'CC456DD')
})

test('convocation parser reports incomplete or orphan fake rows without inventing values', () => {
  const preview = parseConvocationDefinitiveItems([
    item(1, 30, 620, 'DELIVERY'),
    item(1, 30, 580, 'NOME FITTIZIO'), item(1, 215, 580, 'Turno'), item(1, 90, 568, '(SENZA-TARGA)'),
    item(1, 390, 520, '(ORF-01-AA123BB)'),
  ])
  assert.deepEqual(preview.rows[0], { row: 1, status: 'incomplete', driver_name: 'NOME FITTIZIO', driver_name_key: 'NOME FITTIZIO', shift_type: 'TURNO', internal_vehicle_code: null, vehicle_plate: null, issues: ['ITALIAN_PLATE_NOT_FOUND'] })
  assert.deepEqual(preview.outcomes, [{ row: 2, status: 'uninterpretable', issues: ['ORPHAN_VEHICLE_REFERENCE'] }])
})

test('normalization is a matching hint only and Italian vehicle values preserve their internal code', () => {
  assert.equal(normalizeConvocationDriverName(' D’Angélo  Luigi '), 'D ANGELO LUIGI')
  assert.deepEqual(parseItalianVehicleReference('(MP-06-FX560XP)'), { internal_code: 'MP-06', plate: 'FX560XP', issue: null })
  assert.deepEqual(parseItalianVehicleReference('(MP-06)'), { internal_code: null, plate: null, issue: 'ITALIAN_PLATE_NOT_FOUND' })
})

test('browser PDF reader keeps file bytes, extracted text and coordinates out of persistence paths', () => {
  const source = readFileSync(new URL('../company/src/lib/convocationDefinitivePdf.js', import.meta.url), 'utf8')
  assert.match(source, /file\.arrayBuffer\(\)/)
  assert.match(source, /loadingTask\?\.destroy/)
  assert.doesNotMatch(source, /\b(fetch|localStorage|sessionStorage|indexedDB|supabase)\b|file\.name/)
})
