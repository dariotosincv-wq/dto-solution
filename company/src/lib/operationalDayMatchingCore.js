import { normalizeConvocationDriverName } from './convocationDefinitiveCore.js'

const driverKey = (row) => row?.driver_name_key || normalizeConvocationDriverName(row?.driver_name || '') || null
const indexByDriver = (rows = []) => rows.reduce((index, row) => {
  const key = driverKey(row)
  if (!key) return index
  const candidates = index.get(key) || []
  candidates.push(row)
  index.set(key, candidates)
  return index
}, new Map())

const hasConvocationFields = (row) => Boolean(row?.driver_name && row?.shift_type && row?.internal_vehicle_code && row?.vehicle_plate)
const hasAssignmentFields = (row) => Number.isInteger(row?.departure_group) && Boolean(row?.route && row?.driver_name) && Number.isInteger(row?.parking_lot_position) && Number.isInteger(row?.departure_order)

const resolveConfirmedDriver = (row, source, variants) => {
  const key = driverKey(row)
  if (!key) return { driver_id: null, ambiguous: false }
  const driverIds = new Set(variants
    .filter((variant) => variant?.source === source && variant?.normalized_name === key && !variant?.revoked_at && typeof variant?.driver_id === 'string')
    .map((variant) => variant.driver_id))
  return { driver_id: driverIds.size === 1 ? [...driverIds][0] : null, ambiguous: driverIds.size > 1 }
}

const duplicateIssues = (convocationCandidates, assignmentCandidates) => [
  ...(convocationCandidates.length > 1 ? ['DUPLICATE_CONVOCATION_DRIVER'] : []),
  ...(assignmentCandidates.length > 1 ? ['DUPLICATE_ASSIGNMENT_DRIVER'] : []),
]

export function matchOperationalDayPreviews({ convocation = {}, assignment = {}, confirmed_driver_name_variants = [] } = {}) {
  const convocationRows = Array.isArray(convocation.rows) ? convocation.rows : []
  const assignmentRows = Array.isArray(assignment.rows) ? assignment.rows : []
  const convocationByDriver = indexByDriver(convocationRows), assignmentByDriver = indexByDriver(assignmentRows)
  const operationalDate = convocation.convocation_date || null
  const rows = [], outcomes = []
  const pendingConvocation = new Map(), pendingAssignment = new Map()
  const keys = new Set([...convocationByDriver.keys(), ...assignmentByDriver.keys()])

  for (const key of keys) {
    const convocationCandidates = convocationByDriver.get(key) || [], assignmentCandidates = assignmentByDriver.get(key) || []
    const duplicates = duplicateIssues(convocationCandidates, assignmentCandidates)
    const driverName = convocationCandidates[0]?.driver_name || assignmentCandidates[0]?.driver_name || null
    if (duplicates.length) {
      outcomes.push({ status: 'AMBIGUO', driver_name: driverName, driver_name_key: key, issues: duplicates })
      continue
    }
    if (!convocationCandidates.length || !assignmentCandidates.length) {
      if (convocationCandidates.length) pendingConvocation.set(key, convocationCandidates[0])
      else pendingAssignment.set(key, assignmentCandidates[0])
      continue
    }
    const [convocationRow] = convocationCandidates, [assignmentRow] = assignmentCandidates, issues = []
    const convocationDriver = resolveConfirmedDriver(convocationRow, 'convocation', confirmed_driver_name_variants)
    const assignmentDriver = resolveConfirmedDriver(assignmentRow, 'assignment_departure', confirmed_driver_name_variants)
    if (convocationDriver.ambiguous || assignmentDriver.ambiguous || (convocationDriver.driver_id && assignmentDriver.driver_id && convocationDriver.driver_id !== assignmentDriver.driver_id)) {
      outcomes.push({ status: 'AMBIGUO', driver_name: driverName, driver_name_key: key, issues: ['CONFIRMED_DRIVER_VARIANT_AMBIGUOUS'] })
      continue
    }
    const identicalNames = driverKey(convocationRow) === driverKey(assignmentRow)
    if (!identicalNames && (!convocationDriver.driver_id || !assignmentDriver.driver_id || convocationDriver.driver_id !== assignmentDriver.driver_id)) {
      outcomes.push({ status: 'MANCANTE', driver_name: driverName, driver_name_key: key, issues: ['CONFIRMED_DRIVER_VARIANT_REQUIRED'] })
      continue
    }
    if (!hasConvocationFields(convocationRow)) issues.push('CONVOCATION_REQUIRED_DATA_MISSING')
    if (!hasAssignmentFields(assignmentRow)) issues.push('ASSIGNMENT_DEPARTURE_REQUIRED_DATA_MISSING')
    if (issues.length) {
      outcomes.push({ status: 'MANCANTE', driver_name: driverName, driver_name_key: key, issues })
      continue
    }
    rows.push({
      status: 'MATCHED',
      operational_date: operationalDate,
      driver_id: convocationDriver.driver_id || assignmentDriver.driver_id || null,
      driver_name: convocationRow.driver_name,
      driver_name_key: key,
      shift_type: convocationRow.shift_type,
      internal_vehicle_code: convocationRow.internal_vehicle_code,
      vehicle_plate: convocationRow.vehicle_plate,
      departure_group: assignmentRow.departure_group,
      route: assignmentRow.route,
      parking_lot_position: assignmentRow.parking_lot_position,
      atlas_indication: assignmentRow.atlas_indication || null,
      departure_wave: assignmentRow.departure_wave ?? null,
      departure_order: assignmentRow.departure_order,
      ...(assignmentRow.source_files ? { assignment_sources: assignmentRow.source_files } : {}),
    })
  }

  const assignmentsByResolvedDriver = new Map()
  for (const [key, assignmentRow] of pendingAssignment) {
    const resolved = resolveConfirmedDriver(assignmentRow, 'assignment_departure', confirmed_driver_name_variants)
    if (!resolved.driver_id || resolved.ambiguous) continue
    const candidates = assignmentsByResolvedDriver.get(resolved.driver_id) || []
    candidates.push({ key, assignmentRow, resolved })
    assignmentsByResolvedDriver.set(resolved.driver_id, candidates)
  }
  const crossMatchedConvocation = new Set(), crossMatchedAssignment = new Set()
  for (const [key, convocationRow] of pendingConvocation) {
    const convocationDriver = resolveConfirmedDriver(convocationRow, 'convocation', confirmed_driver_name_variants)
    const candidates = convocationDriver.driver_id && !convocationDriver.ambiguous ? assignmentsByResolvedDriver.get(convocationDriver.driver_id) || [] : []
    if (candidates.length !== 1) continue
    const [{ key: assignmentKey, assignmentRow }] = candidates
    const issues = []
    if (!hasConvocationFields(convocationRow)) issues.push('CONVOCATION_REQUIRED_DATA_MISSING')
    if (!hasAssignmentFields(assignmentRow)) issues.push('ASSIGNMENT_DEPARTURE_REQUIRED_DATA_MISSING')
    if (issues.length) outcomes.push({ status: 'MANCANTE', driver_name: convocationRow.driver_name, driver_name_key: key, issues })
    else rows.push({
      status: 'MATCHED', operational_date: operationalDate, driver_id: convocationDriver.driver_id,
      driver_name: convocationRow.driver_name, driver_name_key: key,
      shift_type: convocationRow.shift_type, internal_vehicle_code: convocationRow.internal_vehicle_code, vehicle_plate: convocationRow.vehicle_plate,
      departure_group: assignmentRow.departure_group, route: assignmentRow.route, parking_lot_position: assignmentRow.parking_lot_position,
      atlas_indication: assignmentRow.atlas_indication || null, departure_wave: assignmentRow.departure_wave ?? null, departure_order: assignmentRow.departure_order,
      ...(assignmentRow.source_files ? { assignment_sources: assignmentRow.source_files } : {}),
    })
    crossMatchedConvocation.add(key)
    crossMatchedAssignment.add(assignmentKey)
  }
  for (const [key, row] of pendingConvocation) {
    if (crossMatchedConvocation.has(key)) continue
    const resolved = resolveConfirmedDriver(row, 'convocation', confirmed_driver_name_variants)
    outcomes.push({ status: resolved.ambiguous ? 'AMBIGUO' : 'MANCANTE', driver_name: row.driver_name, driver_name_key: key, issues: [resolved.ambiguous ? 'CONFIRMED_DRIVER_VARIANT_AMBIGUOUS' : 'MISSING_IN_ASSIGNMENT_DEPARTURE'] })
  }
  for (const [key, row] of pendingAssignment) {
    if (crossMatchedAssignment.has(key)) continue
    const resolved = resolveConfirmedDriver(row, 'assignment_departure', confirmed_driver_name_variants)
    outcomes.push({ status: resolved.ambiguous ? 'AMBIGUO' : 'MANCANTE', driver_name: row.driver_name, driver_name_key: key, issues: [resolved.ambiguous ? 'CONFIRMED_DRIVER_VARIANT_AMBIGUOUS' : 'MISSING_IN_CONVOCATION'] })
  }

  const missingDriverCount = [...convocationRows, ...assignmentRows].filter((row) => !driverKey(row)).length
  for (let index = 0; index < missingDriverCount; index += 1) {
    outcomes.push({ status: 'MANCANTE', driver_name: null, driver_name_key: null, issues: ['DRIVER_NAME_NOT_FOUND'] })
  }
  return {
    operational_date: operationalDate,
    operational_date_status: operationalDate ? 'from_convocation' : 'not_verifiable_from_convocation',
    assignment_departure_date_status: assignment.departure_date_status || 'not_verifiable_from_content',
    rows: rows.sort((left, right) => left.departure_order - right.departure_order),
    outcomes,
  }
}
