import test from 'node:test'
import assert from 'node:assert/strict'
import { dashboardSummary } from '../company/src/lib/dashboardSummary.js'

test('dashboard never presents missing data as a healthy empty fleet', () => {
  const result = dashboardSummary(null, null, null)
  assert.equal(result.fleet, null)
  assert.equal(result.open, null)
  assert.equal(result.active, null)
  assert.equal(result.attention, null)
})
test('dashboard counts vehicles once and keeps administrative status separate from reports', () => {
  const result = dashboardSummary([{ vehicle_id: 'a', status: 'active' }, { vehicle_id: 'b', status: 'inactive' }, { vehicle_id: 'c', status: 'archived' }], [{ vehicle_id: 'a', status: 'OPEN' }, { vehicle_id: 'a', status: 'OPEN' }, { vehicle_id: 'c', status: 'OPEN' }, { vehicle_id: 'b', status: 'RESOLVED' }], [])
  assert.equal(result.fleet.length, 2)
  assert.equal(result.active, 1)
  assert.equal(result.inactive, 1)
  assert.equal(result.attention, 1)
  assert.equal(result.open.length, 3)
})
test('dashboard accepts genuine zero results but leaves partial indicators unknown', () => {
  assert.equal(dashboardSummary([], [], []).attention, 0)
  assert.equal(dashboardSummary([], null, []).attention, null)
})
test('activity sorts available facts by timestamp and ignores invalid dates', () => {
  const result = dashboardSummary([], [{ report_id: 'r', reported_at: '2026-09-06T08:00:00Z' }], [{ id: 'i', inspectedAt: '2026-09-06T09:00:00Z', inspectionType: 'return' }, { id: 'bad', inspectedAt: 'invalid' }])
  assert.deepEqual(result.events.map(item => item.id), ['inspection-i', 'report-r'])
  assert.equal(result.events[0].label, 'Riconsegna registrata')
})
