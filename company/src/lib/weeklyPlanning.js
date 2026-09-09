export const WORK_STATUSES = Object.freeze(['TURNO', 'RIPOSO', 'FERIE', 'PERMESSO', 'MALATTIA', 'ALTRO'])
export const STATUS_LABELS = Object.freeze({ TURNO: 'Turno', RIPOSO: 'Riposo', FERIE: 'Ferie', PERMESSO: 'Permesso', MALATTIA: 'Malattia', ALTRO: 'Altro' })
const alphabet = new Intl.Collator('it', { sensitivity: 'base', numeric: true })
export const entryKey = (driverId, date) => `${driverId}:${date}`
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
}
export function shiftDay(date, offset) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + offset)
  return value.toISOString().slice(0, 10)
}
export function weekStart(date) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  return shiftDay(date, -(day + 6) % 7)
}
export const weekDays = (start) => Array.from({ length: 7 }, (_, index) => shiftDay(start, index))
export const sortDrivers = (drivers) => [...drivers].sort((a, b) => alphabet.compare(a.last_name, b.last_name) || alphabet.compare(a.first_name, b.first_name) || alphabet.compare(a.driver_id, b.driver_id))
export function driverSummary(entries, expected) {
  const planned = entries.filter(entry => entry?.work_status === 'TURNO').length
  return { planned, expected, delta: expected == null ? null : planned - expected, incomplete: entries.filter(Boolean).length < 7, absent: entries.some(entry => ['FERIE', 'PERMESSO', 'MALATTIA', 'ALTRO'].includes(entry?.work_status)) }
}
export function filterDrivers(drivers, summaries, { search = '', profile = '', status = '', quick = 'all' } = {}, entries = []) {
  const query = search.trim().toLocaleLowerCase('it')
  return sortDrivers(drivers.filter(driver => {
    const summary = summaries.get(driver.driver_id)
    if (query && ![`${driver.last_name} ${driver.first_name}`, `${driver.first_name} ${driver.last_name}`, driver.driver_code ?? ''].some(value => value.toLocaleLowerCase('it').includes(query))) return false
    if (profile && String(driver.expected_weekly_days) !== profile) return false
    if (status && !entries.some(entry => entry.driver_id === driver.driver_id && entry.work_status === status)) return false
    return quick === 'all' || (quick === 'incomplete' && summary.incomplete) || (quick === 'under' && summary.delta != null && summary.delta < 0) || (quick === 'equal' && summary.delta === 0) || (quick === 'over' && summary.delta > 0) || (quick === 'absent' && summary.absent) || (quick === 'conflicts' && summary.conflicts > 0)
  }))
}
export function findConflicts(entries, vehicles) {
  const catalog = new Map(vehicles.map(vehicle => [vehicle.vehicle_id, vehicle]))
  const used = new Map(), conflicts = new Map()
  const add = (entry, message) => { const key = entryKey(entry.driver_id, entry.assignment_date); conflicts.set(key, [...(conflicts.get(key) ?? []), message]) }
  for (const entry of entries) {
    if (entry.work_status !== 'TURNO') continue
    if (!entry.vehicle_id) { add(entry, 'Turno senza mezzo'); continue }
    if (catalog.get(entry.vehicle_id)?.status !== 'active') add(entry, 'Mezzo non disponibile')
    const key = `${entry.assignment_date}:${entry.vehicle_id}`
    used.set(key, [...(used.get(key) ?? []), entry])
  }
  for (const group of used.values()) if (group.length > 1) for (const entry of group) add(entry, 'Mezzo assegnato a più driver')
  return conflicts
}
export function dailySummary(entries, required = null) {
  const shifts = entries.filter(entry => entry.work_status === 'TURNO')
  return { planned: shifts.length, vehicles: new Set(shifts.map(entry => entry.vehicle_id).filter(Boolean)).size, required, missing: required == null ? null : Math.max(0, required - shifts.length) }
}
// The operational day is available immediately. Overrides never mutate the plan.
// Legacy daily assignments are vehicle-only overrides; explicit planning overrides win.
export function resolveEffective(planned, overrides = [], daily = []) {
  const result = new Map(planned.map(entry => [entryKey(entry.driver_id, entry.assignment_date), { ...entry, source: 'planned' }]))
  for (const entry of daily) {
    const key = entryKey(entry.driver_id, entry.assignment_date)
    result.set(key, { ...result.get(key), ...entry, work_status: 'TURNO', source: 'daily' })
  }
  for (const entry of overrides) result.set(entryKey(entry.driver_id, entry.assignment_date), { ...entry, source: 'override' })
  return [...result.values()]
}
export function copyPreviousWeek(source, target, start) {
  const occupied = new Set(target.map(entry => entryKey(entry.driver_id, entry.assignment_date)))
  return source.filter(entry => entry.assignment_date >= shiftDay(start, -7) && entry.assignment_date < start).map(entry => ({ ...entry, assignment_date: shiftDay(entry.assignment_date, 7) })).filter(entry => !occupied.has(entryKey(entry.driver_id, entry.assignment_date)))
}
export function resolveRoute(current, lastKnown) {
  return current?.trim() ? { route: current.trim(), needs_confirmation: false } : { route: lastKnown?.trim() || null, needs_confirmation: true }
}
