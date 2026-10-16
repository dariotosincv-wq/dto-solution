import { normalizeConvocationDriverName } from './convocationDefinitiveCore.js'
import { matchOperationalDayPreviews } from './operationalDayMatchingCore.js'

const requiredConvocation = (row) => Boolean(row?.driver_name && row?.shift_type && row?.internal_vehicle_code && row?.vehicle_plate)
const requiredAssignment = (row) => Number.isInteger(row?.departure_group) && Boolean(row?.driver_name && row?.route) && Number.isInteger(row?.parking_lot_position) && Number.isInteger(row?.departure_order)
export const previewRowId = (source, row) => `${source}:${row.row}`

const manualMatch = (convocation, assignment, manual_link_id) => ({
  status: 'MANUAL_MATCHED', manual_confirmation: true, operational_date: convocation.operational_date,
  manual_link_id,
  driver_id: null, driver_name: convocation.driver_name, driver_lookup_name: assignment.driver_name, driver_name_key: normalizeConvocationDriverName(convocation.driver_name),
  shift_type: convocation.shift_type, internal_vehicle_code: convocation.internal_vehicle_code, vehicle_plate: convocation.vehicle_plate,
  departure_group: assignment.departure_group, route: assignment.route, parking_lot_position: assignment.parking_lot_position,
  atlas_indication: assignment.atlas_indication || null, departure_wave: assignment.departure_wave ?? null, departure_order: assignment.departure_order,
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
  const outcomes = automatic.outcomes.filter((outcome) => !resolvedKeys.has(outcome.driver_name_key))
  const rows = [...automatic.rows, ...manualRows].sort((left, right) => left.departure_order - right.departure_order)
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
