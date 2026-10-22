import { normalizeConvocationDriverName } from './convocationDefinitiveCore.js'
import { matchOperationalDayPreviews } from './operationalDayMatchingCore.js'

const requiredConvocation = (row) => Boolean(row?.driver_name && row?.shift_type && row?.internal_vehicle_code && row?.vehicle_plate)
const requiredAssignment = (row) => Number.isInteger(row?.departure_group) && Boolean(row?.driver_name && row?.route) && Number.isInteger(row?.parking_lot_position) && Number.isInteger(row?.departure_order)
export const previewRowId = (source, row) => `${source}${row?.source_file_index == null ? '' : `:${row.source_file_index}`}:${row.row}`

const assignmentSource = (file, file_index, row) => ({
  file_index,
  file_name: file.file_name || `Uscita ${file_index + 1}`,
  row: row.row,
})
const assignmentSignature = (row) => [
  normalizeConvocationDriverName(row.driver_name),
  row.departure_group ?? '',
  normalizeConvocationDriverName(row.route),
  row.parking_lot_position ?? '',
  normalizeConvocationDriverName(row.atlas_indication),
  row.departure_wave ?? '',
].join('|')

export function mergeAssignmentDeparturePreviews(files = []) {
  const groups = new Map(), outcomes = []
  for (const [file_index, file] of files.entries()) {
    const preview = file.preview || file
    for (const row of preview.rows || []) {
      const source = assignmentSource(file, file_index, row)
      const driver_name_key = normalizeConvocationDriverName(row.driver_name)
      const groupKey = driver_name_key || `__row_${file_index}_${row.row}`
      const candidates = groups.get(groupKey) || []
      candidates.push({ ...row, source_file_index: file_index, source_files: [source] })
      groups.set(groupKey, candidates)
    }
    for (const outcome of preview.outcomes || []) outcomes.push({
      ...outcome,
      assignment_sources: [assignmentSource(file, file_index, outcome)],
    })
  }

  const rows = []
  for (const [driver_name_key, candidates] of groups) {
    if (driver_name_key.startsWith('__row_') || candidates.length === 1) {
      rows.push(...candidates)
      continue
    }
    const signatures = new Set(candidates.map(assignmentSignature))
    if (signatures.size === 1) {
      rows.push({ ...candidates[0], source_files: candidates.flatMap(candidate => candidate.source_files) })
      continue
    }
    outcomes.push({
      status: 'AMBIGUO',
      driver_name: candidates[0].driver_name,
      driver_name_key,
      issues: ['DUPLICATE_ASSIGNMENT_DRIVER_ACROSS_FILES'],
      assignment_sources: candidates.flatMap(candidate => candidate.source_files),
    })
  }

  return {
    departure_date: null,
    departure_date_status: 'not_verifiable_from_content',
    rows: rows
      .sort((left, right) => left.source_file_index - right.source_file_index || left.row - right.row)
      .map((row, index) => ({ ...row, departure_order: index + 1 })),
    outcomes,
  }
}

const vehicleConflicts = (rows) => {
  const byCode = new Map(), byPlate = new Map(), byVehicle = new Map()
  const add = (index, value, row) => {
    if (!value) return
    const items = index.get(value) || []
    items.push(row)
    index.set(value, items)
  }
  for (const row of rows) {
    const code = normalizeConvocationDriverName(row.internal_vehicle_code)
    const plate = normalizeConvocationDriverName(row.vehicle_plate)
    add(byCode, code, row)
    add(byPlate, plate, row)
    add(byVehicle, `${code}|${plate}`, row)
  }
  const issuesByDriver = new Map()
  const flag = (items, issue) => {
    if (items.length < 2) return
    for (const row of items) {
      const issues = issuesByDriver.get(row.driver_name_key) || new Set()
      issues.add(issue)
      issuesByDriver.set(row.driver_name_key, issues)
    }
  }
  for (const items of byCode.values()) if (new Set(items.map(row => normalizeConvocationDriverName(row.vehicle_plate))).size > 1) flag(items, 'DUPLICATE_VEHICLE_CODE_INCOMPATIBLE')
  for (const items of byPlate.values()) if (new Set(items.map(row => normalizeConvocationDriverName(row.internal_vehicle_code))).size > 1) flag(items, 'DUPLICATE_VEHICLE_PLATE_INCOMPATIBLE')
  for (const items of byVehicle.values()) if (new Set(items.map(row => row.driver_name_key)).size > 1) flag(items, 'DUPLICATE_VEHICLE_ASSIGNMENT')
  return rows
    .filter(row => issuesByDriver.has(row.driver_name_key))
    .map(row => ({
      status: 'AMBIGUO',
      driver_name: row.driver_name,
      driver_name_key: row.driver_name_key,
      issues: [...issuesByDriver.get(row.driver_name_key)],
      assignment_sources: row.assignment_sources || [],
    }))
}

const manualMatch = (convocation, assignment, manual_link_id) => ({
  status: 'MANUAL_MATCHED', manual_confirmation: true, operational_date: convocation.operational_date,
  manual_link_id,
  driver_id: null, driver_name: convocation.driver_name, driver_lookup_name: assignment.driver_name, driver_name_key: normalizeConvocationDriverName(convocation.driver_name),
  shift_type: convocation.shift_type, internal_vehicle_code: convocation.internal_vehicle_code, vehicle_plate: convocation.vehicle_plate,
  departure_group: assignment.departure_group, route: assignment.route, parking_lot_position: assignment.parking_lot_position,
  atlas_indication: assignment.atlas_indication || null, departure_wave: assignment.departure_wave ?? null, departure_order: assignment.departure_order,
  assignment_sources: assignment.source_files || [],
})

const tokens = (name) => normalizeConvocationDriverName(name).split(' ').filter(Boolean)
const isSafeNameSuggestion = (convocationName, assignmentName) => {
  const shortName = tokens(convocationName), fullName = tokens(assignmentName)
  if (!shortName.length || !fullName.length || shortName.length >= fullName.length) return false
  return shortName.every((token, index) => token === fullName[index])
}

const suggestedLinks = (convocationRows, assignmentRows, excludedConvocation, excludedAssignment) => {
  const suggestions = []
  for (const convocationRow of convocationRows) {
    const convocationId = previewRowId('convocation', convocationRow)
    if (excludedConvocation.has(convocationId) || !requiredConvocation(convocationRow)) continue
    const candidates = assignmentRows.filter((assignmentRow) => {
      const assignmentId = previewRowId('assignment_departure', assignmentRow)
      return !excludedAssignment.has(assignmentId) && requiredAssignment(assignmentRow) && isSafeNameSuggestion(convocationRow.driver_name, assignmentRow.driver_name)
    })
    if (candidates.length !== 1) continue
    const assignmentRow = candidates[0], assignmentId = previewRowId('assignment_departure', assignmentRow)
    suggestions.push({ id: `suggested:${convocationId}|${assignmentId}`, convocation_row_id: convocationId, assignment_row_id: assignmentId, convocation_name: convocationRow.driver_name, assignment_name: assignmentRow.driver_name })
    excludedConvocation.add(convocationId); excludedAssignment.add(assignmentId)
  }
  return suggestions
}

export function buildOperationalDayImportPreview({ convocation = {}, assignment = {}, manual_links = [] } = {}) {
  const automatic = matchOperationalDayPreviews({ convocation, assignment })
  const convocationRows = Array.isArray(convocation.rows) ? convocation.rows : [], assignmentRows = Array.isArray(assignment.rows) ? assignment.rows : []
  const usedConvocation = new Set(), usedAssignment = new Set(), manualRows = [], resolvedKeys = new Set()
  for (const link of manual_links) {
    const convocationRow = convocationRows.find((row) => previewRowId('convocation', row) === link.convocation_row_id)
    const assignmentRow = assignmentRows.find((row) => previewRowId('assignment_departure', row) === link.assignment_row_id)
    if (!convocationRow || !assignmentRow || usedConvocation.has(link.convocation_row_id) || usedAssignment.has(link.assignment_row_id) || !requiredConvocation(convocationRow) || !requiredAssignment(assignmentRow)) continue
    usedConvocation.add(link.convocation_row_id); usedAssignment.add(link.assignment_row_id)
    resolvedKeys.add(normalizeConvocationDriverName(convocationRow.driver_name)); resolvedKeys.add(normalizeConvocationDriverName(assignmentRow.driver_name))
    manualRows.push(manualMatch({ ...convocationRow, operational_date: automatic.operational_date }, assignmentRow, link.id))
  }
  const conflictingVehicles = vehicleConflicts(automatic.rows)
  const conflictingVehicleKeys = new Set(conflictingVehicles.map(outcome => outcome.driver_name_key))
  const mergeOutcomes = assignment.outcomes || []
  const excludedAssignmentKeys = new Set(mergeOutcomes.map(outcome => outcome.driver_name_key).filter(Boolean))
  const outcomes = [
    ...automatic.outcomes.filter((outcome) => !resolvedKeys.has(outcome.driver_name_key) && !excludedAssignmentKeys.has(outcome.driver_name_key) && !conflictingVehicleKeys.has(outcome.driver_name_key)),
    ...mergeOutcomes,
    ...conflictingVehicles,
  ]
  const rows = [...automatic.rows.filter(row => !conflictingVehicleKeys.has(row.driver_name_key)), ...manualRows].sort((left, right) => left.departure_order - right.departure_order)
  const occupiedConvocation = new Set(usedConvocation), occupiedAssignment = new Set(usedAssignment)
  for (const row of automatic.rows) {
    const convocationRow = convocationRows.find((candidate) => normalizeConvocationDriverName(candidate.driver_name) === row.driver_name_key)
    const assignmentRow = assignmentRows.find((candidate) => normalizeConvocationDriverName(candidate.driver_name) === row.driver_name_key)
    if (convocationRow) occupiedConvocation.add(previewRowId('convocation', convocationRow))
    if (assignmentRow) occupiedAssignment.add(previewRowId('assignment_departure', assignmentRow))
  }
  const suggestions = suggestedLinks(convocationRows, assignmentRows, occupiedConvocation, occupiedAssignment)
  return {
    ...automatic,
    rows, outcomes, suggestions,
    summary: {
      convocation_rows: convocationRows.length,
      assignment_rows: assignmentRows.length,
      complete_matches: rows.length,
      missing: outcomes.filter((outcome) => outcome.status === 'MANCANTE').length,
      ambiguous: outcomes.filter((outcome) => outcome.status === 'AMBIGUO').length,
    },
  }
}
