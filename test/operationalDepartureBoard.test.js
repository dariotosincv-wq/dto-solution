import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { boardRows, connectionPresentation, departurePresentation } from '../company/src/lib/operationalDepartureBoard.js'

test('confirmed day without phones keeps every ordered TURNO row visible', () => {
  const board = { day: { status: 'confirmed' }, queue: null, items: [
    { row: { id: 'one', departure_order: 1 }, item: null, departure_state: 'not_started', connection: { state: 'disconnected', last_contact_at: null } },
    { row: { id: 'two', departure_order: 2 }, item: null, departure_state: 'not_started', connection: { state: 'disconnected', last_contact_at: null } },
  ] }
  assert.equal(boardRows(board).length, 2)
  assert.equal(departurePresentation('not_started').label, 'Non avviata')
  assert.equal(connectionPresentation(board.items[0].connection).label, 'Non collegato')
})

test('board presents independent connection and departure states', () => {
  assert.equal(connectionPresentation({ state: 'connected' }).label, 'Collegato')
  assert.equal(connectionPresentation({ state: 'disconnected' }).label, 'Non collegato')
  assert.equal(departurePresentation('waiting').label, 'In attesa')
  assert.equal(departurePresentation('called').label, 'Pronto')
  assert.equal(departurePresentation('departed').label, 'Partito')
  assert.equal(departurePresentation('timed_out').label, 'Non partito / anomalia')
})

test('administrative board is company-scoped, uses an activity threshold and exposes no direct client grant', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261022115609_operational_departure_admin_board.sql', import.meta.url), 'utf8')
  assert.match(sql, /checkvan_area_memberships/)
  assert.match(sql, /role = 'COMPANY_ADMIN'/)
  assert.match(sql, /p_connected_within_seconds/)
  assert.match(sql, /last_used_at/)
  assert.match(sql, /last_validated_at/)
  assert.match(sql, /revoke all on function public\.internal_admin_read_operational_departure_board.*anon, authenticated/s)
  assert.match(sql, /grant execute on function public\.internal_admin_read_operational_departure_board.*to service_role/s)
})
