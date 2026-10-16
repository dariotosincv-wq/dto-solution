export function confirmedOperationalAssignment(day, driver, date) {
  if (!day?.day) return null
  const row = Array.isArray(day.rows) ? day.rows.find(item => item.driver_id === driver.id) : null
  if (!row) return { date, driver, status: 'NOT_CONVOKED', assignment: null, departure_order: null, assignment_state: 'CONFIRMED' }
  const assignment = row.work_status === 'TURNO' && row.vehicle_id
    ? { vehicle_id: row.vehicle_id, internal_code: row.vehicle_internal_code_snapshot, plate: row.vehicle_plate_snapshot, silhouette_category: 'NON_SPECIFICATA', route: row.route_snapshot ?? null, notes: row.notes ?? null, source: row.source }
    : null
  return { date, driver, status: row.work_status, assignment, departure_order: row.departure_order ?? null, assignment_state: 'CONFIRMED' }
}
