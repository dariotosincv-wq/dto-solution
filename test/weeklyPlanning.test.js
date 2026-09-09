import test from 'node:test'
import assert from 'node:assert/strict'
import { sortDrivers, driverSummary, dailySummary, filterDrivers, findConflicts, resolveEffective, copyPreviousWeek, weekStart, weekDays, shiftDay, validDate, entryKey, resolveRoute } from '../company/src/lib/weeklyPlanning.js'
import { planningInput, planningWeek, mutatePlanning, readPlanning } from '../api/_lib/companyPlanning.js'

const start = '2026-09-07'
const entry = (driver_id = 'a', assignment_date = start, vehicle_id = 'v1', work_status = 'TURNO') => ({ driver_id, assignment_date, vehicle_id, work_status })
const id = '10000000-0000-4000-8000-000000000001'
const drivers = [{ driver_id: 'c', last_name: 'Zeta', first_name: 'Beta', expected_weekly_days: 5 }, { driver_id: 'b', last_name: 'Alfa', first_name: 'Zeta', expected_weekly_days: 4 }, { driver_id: 'a', last_name: 'Alfa', first_name: 'Beta', expected_weekly_days: 3 }]

test('surname then first name ordering, without mutating the directory', () => {
  assert.deepEqual(sortDrivers(drivers).map(item => item.driver_id), ['a', 'b', 'c'])
  assert.equal(drivers[0].driver_id, 'c')
})
test('profiles 3/4/5, negative/zero/positive deviations are informational', () => {
  for (const expected of [3, 4, 5]) for (const planned of [expected - 1, expected, expected + 1]) {
    const value = driverSummary(Array.from({ length: planned }, () => entry()), expected)
    assert.equal(value.planned, planned); assert.equal(value.delta, planned - expected)
  }
  assert.equal(driverSummary(Array.from({ length: 6 }, () => entry()), 3).delta, 3)
  assert.equal(driverSummary([entry()], null).delta, null)
  assert.equal(driverSummary([], 0).delta, 0)
})
test('absences complete the calendar without being counted as worked shifts', () => {
  const value = driverSummary([entry(), ...Array.from({ length: 6 }, () => entry('a', start, null, 'FERIE'))], 5)
  assert.equal(value.planned, 1); assert.equal(value.absent, true); assert.equal(value.incomplete, false)
})
test('daily coverage counts shifts, distinct vehicles and optional/zero demand', () => {
  const entries = [entry(), entry('b'), entry('c', start, null, 'RIPOSO'), entry('d', start, null)]
  assert.deepEqual(dailySummary(entries, 5), { planned: 3, vehicles: 1, required: 5, missing: 2 })
  assert.equal(dailySummary(entries).missing, null)
  assert.equal(dailySummary(entries, 0).missing, 0)
})
test('vehicle conflicts include both drivers, unavailable and missing vehicles; rest is exempt', () => {
  const entries = [entry(), entry('b'), entry('c', start, 'v2'), entry('d', start, null), entry('e', start, null, 'RIPOSO'), entry('f', shiftDay(start, 1))]
  const conflicts = findConflicts(entries, [{ vehicle_id: 'v1', status: 'active' }, { vehicle_id: 'v2', status: 'inactive' }])
  assert.equal(conflicts.size, 4)
  assert.match(conflicts.get(entryKey('a', start))[0], /più driver/)
  assert.match(conflicts.get(entryKey('c', start))[0], /non disponibile/)
  assert.match(conflicts.get(entryKey('d', start))[0], /senza mezzo/)
})
test('copy previous week shifts all seven dates and fills only empty cells, idempotently', () => {
  const source = weekDays(shiftDay(start, -7)).map(date => ({ ...entry('a', date), route: '33', notes: 'Nota test' }))
  const target = [entry('a', start, null, 'FERIE')]
  const copy = copyPreviousWeek(source, target, start)
  assert.equal(copy.length, 6); assert.equal(copy[0].assignment_date, '2026-09-08'); assert.equal(copy[0].route, '33')
  assert.equal(copyPreviousWeek(source, [...target, ...copy], start).length, 0)
  assert.equal(source[0].assignment_date, '2026-08-31')
  assert.deepEqual(copyPreviousWeek([], target, start), [])
})
test('operational day is immediately prepared from the plan; overrides preserve original', () => {
  const planned = [{ ...entry(), route: '33', notes: 'Piano' }]
  assert.equal(resolveEffective(planned)[0].source, 'planned')
  const daily = [entry('a', start, 'v2')]
  const dailyResolved = resolveEffective(planned, [], daily)[0]
  assert.equal(dailyResolved.vehicle_id, 'v2'); assert.equal(dailyResolved.route, '33')
  const override = { ...entry('a', start, null, 'MALATTIA'), route: null, notes: 'Variazione' }
  assert.equal(resolveEffective(planned, [override], daily)[0].work_status, 'MALATTIA')
  assert.equal(planned[0].vehicle_id, 'v1'); assert.equal(planned[0].work_status, 'TURNO')
  assert.equal(resolveEffective([], [override])[0].source, 'override')
})
test('instant search by surname/name, profile, status and all quick filters', () => {
  const entries = [entry('a'), entry('b', start, null, 'FERIE')]
  const summaries = new Map([['a', { delta: -1, incomplete: true, absent: false, conflicts: 1 }], ['b', { delta: 0, incomplete: false, absent: true, conflicts: 0 }], ['c', { delta: 1, incomplete: false, absent: false, conflicts: 0 }]])
  const ids = filters => filterDrivers(drivers, summaries, filters, entries).map(item => item.driver_id)
  assert.deepEqual(ids({ search: 'aLFa b' }), ['a'])
  assert.deepEqual(ids({ search: 'B' }), ['a', 'c'])
  assert.deepEqual(ids({ search: 'nessuno' }), [])
  assert.deepEqual(ids({ profile: '4' }), ['b'])
  assert.deepEqual(ids({ status: 'FERIE' }), ['b'])
  for (const [quick, expected] of [['all', ['a', 'b', 'c']], ['incomplete', ['a']], ['under', ['a']], ['equal', ['b']], ['over', ['c']], ['absent', ['b']], ['conflicts', ['a']]]) assert.deepEqual(ids({ quick }), expected)
})
test('week boundaries, leap days and daylight-saving use calendar dates', () => {
  assert.equal(weekStart('2026-09-13'), start)
  assert.equal(weekStart('2027-01-01'), '2026-12-28')
  assert.equal(shiftDay('2028-02-28', 1), '2028-02-29')
  assert.equal(weekDays('2026-03-23').at(-1), '2026-03-29')
  assert.equal(validDate('2026-02-30'), false)
  assert.throws(() => planningWeek('2026-09-08'))
})
test('API validates dates, revisions, scoped IDs, nullable routes and bounded fields', () => {
  const input = { action: 'SAVE', week_start: start, revision: 0, assignment_date: start, driver_id: id, work_status: 'TURNO', vehicle_id: null, route: '' }
  assert.equal(planningInput(input).route, null)
  assert.equal(planningInput({ ...input, work_status: 'FERIE', vehicle_id: id, route: '33' }).vehicle_id, null)
  for (const invalid of [{ revision: -1 }, { revision: '1' }, { assignment_date: '2026-09-14' }, { work_status: 'INVALID' }, { driver_id: 'invalid' }, { vehicle_id: 'invalid' }, { notes: 'x'.repeat(2001) }, { route: {} }]) assert.throws(() => planningInput({ ...input, ...invalid }))
  assert.equal(planningInput({ ...input, action: 'REQUIREMENT', required_drivers: null }).required_drivers, null)
  assert.throws(() => planningInput({ ...input, action: 'REQUIREMENT', required_drivers: -1 }))
})
test('mutation forwards server organization/actor, never user-supplied scope; stale write is 409', async () => {
  let args
  const client = { rpc: async (_name, input) => { args = input; return { data: { revision: 1 } } } }
  await mutatePlanning(client, 'server-org', 'server-user', { action: 'COPY_PREVIOUS', week_start: start, revision: 0, organization_id: 'attacker-org' })
  assert.equal(args.p_organization_id, 'server-org'); assert.equal(args.p_auth_subject, 'server-user'); assert.equal(args.p_input.organization_id, undefined)
  await assert.rejects(mutatePlanning({ rpc: async () => ({ error: { message: 'PLANNING_STALE' } }) }, 'org', 'user', { action: 'COPY_PREVIOUS', week_start: start, revision: 0 }), error => error.status === 409)
})
test('weekly read uses a single snapshot and prepares the effective day', async () => {
  const result = await readPlanning({ rpc: async (_name, args) => { assert.equal(args.p_start, start); return { data: { revision: 3, entries: [entry()], overrides: [], daily: [], requirements: [] } } } }, 'org', start)
  assert.equal(result.revision, 3); assert.equal(result.effective[0].source, 'planned')
})
test('future route contract uses current route automatically and confirms fallback only', () => {
  assert.deepEqual(resolveRoute('33', '44'), { route: '33', needs_confirmation: false })
  assert.deepEqual(resolveRoute(null, '44'), { route: '44', needs_confirmation: true })
})
test('100 drivers × 7 days can be indexed, searched and summarized together', () => {
  const catalog = Array.from({ length: 100 }, (_, index) => ({ driver_id: String(index), last_name: `Driver ${index}`, first_name: 'Test', expected_weekly_days: 5 }))
  const entries = catalog.flatMap(driver => weekDays(start).map(date => entry(driver.driver_id, date, `v${driver.driver_id}`)))
  assert.equal(entries.length, 700)
  assert.equal(findConflicts(entries, catalog.map(driver => ({ vehicle_id: `v${driver.driver_id}`, status: 'active' }))).size, 0)
  const summaries = new Map(catalog.map(driver => [driver.driver_id, driverSummary(entries.filter(item => item.driver_id === driver.driver_id), 5)]))
  assert.equal(filterDrivers(catalog, summaries, { quick: 'over' }, entries).length, 100)
})
