export function dashboardSummary(vehicles, reports, inspections) {
  const fleet = vehicles?.filter(vehicle => vehicle.status !== 'archived') ?? null
  const byId = new Map(fleet?.map(vehicle => [vehicle.vehicle_id, vehicle]) ?? [])
  const open = reports?.filter(report => report.status === 'OPEN') ?? null
  const events = [
    ...(inspections ?? []).map(item => ({ id: `inspection-${item.id}`, date: item.inspectedAt, plate: item.vehiclePlate, label: item.inspectionType === 'pickup' ? 'Presa mezzo registrata' : item.inspectionType === 'return' ? 'Riconsegna registrata' : 'Ispezione registrata', kind: 'inspection' })),
    ...(reports ?? []).map(item => ({ id: `report-${item.report_id}`, date: item.reported_at, plate: byId.get(item.vehicle_id)?.plate, label: 'Segnalazione tecnica registrata', kind: 'report', vehicleId: byId.has(item.vehicle_id) ? item.vehicle_id : null })),
  ].filter(item => Number.isFinite(Date.parse(item.date))).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 5)
  return { fleet, byId, open, events, active: fleet?.filter(item => item.status === 'active').length ?? null, inactive: fleet?.filter(item => item.status === 'inactive').length ?? null, attention: fleet && open ? new Set(open.filter(item => byId.has(item.vehicle_id)).map(item => item.vehicle_id)).size : null }
}
