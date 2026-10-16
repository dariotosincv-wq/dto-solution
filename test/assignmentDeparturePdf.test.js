import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseAssignmentDepartureItems } from '../company/src/lib/assignmentDepartureCore.js'

const item = (x, y, text) => ({ page: 1, x, y, page_width: 600, text })
const fakeRow = (index, parkingLotPosition) => [
  item(60, 780 - index * 15, `GRUPPO ${index < 33 ? 2 : 3}`),
  item(134, 780 - index * 15, `CA_A${String(index + 1).padStart(2, '0')}`),
  item(220, 780 - index * 15, `NOME FITTIZIO ${index + 1}`),
  item(350, 780 - index * 15, String(parkingLotPosition)),
]

test('assignment parser keeps a global continuous order when fake Parking Lot restarts', () => {
  const preview = parseAssignmentDepartureItems([
    ...Array.from({ length: 33 }, (_, index) => fakeRow(index, index)).flat(),
    ...fakeRow(33, 0),
  ])
  assert.equal(preview.departure_date, null)
  assert.equal(preview.departure_date_status, 'not_verifiable_from_content')
  assert.equal(preview.rows.length, 34)
  assert.deepEqual(preview.rows.slice(31).map((row) => ({ parking_lot_position: row.parking_lot_position, departure_order: row.departure_order, departure_wave: row.departure_wave })), [
    { parking_lot_position: 31, departure_order: 32, departure_wave: 1 },
    { parking_lot_position: 32, departure_order: 33, departure_wave: 1 },
    { parking_lot_position: 0, departure_order: 34, departure_wave: 2 },
  ])
})

test('assignment parser preserves an optional fake Atlas indication and reports missing required values', () => {
  const preview = parseAssignmentDepartureItems([
    item(60, 700, 'GRUPPO 2'), item(134, 700, 'CA_A23'), item(220, 700, 'NOME FITTIZIO'), item(350, 700, '8'), item(400, 700, 'ATLAS'),
    item(60, 680, 'GRUPPO 3'), item(220, 680, 'SENZA ROTTA'), item(350, 680, '9'),
  ])
  assert.deepEqual(preview.rows[0], { row: 1, status: 'parsed', departure_group: 2, route: 'CA_A23', driver_name: 'NOME FITTIZIO', parking_lot_position: 8, atlas_indication: 'ATLAS', departure_wave: 1, departure_order: 1, issues: [] })
  assert.deepEqual(preview.rows[1].issues, ['ROUTE_NOT_FOUND'])
})

test('browser assignment reader keeps PDF bytes and extracted coordinates out of persistence paths', () => {
  const source = readFileSync(new URL('../company/src/lib/assignmentDeparturePdf.js', import.meta.url), 'utf8')
  assert.match(source, /file\.arrayBuffer\(\)/)
  assert.match(source, /loadingTask\?\.destroy/)
  assert.doesNotMatch(source, /\b(fetch|localStorage|sessionStorage|indexedDB|supabase)\b|file\.name/)
})
