export function confirmedDepartureRows(snapshot) {
  if (snapshot?.day?.status !== 'confirmed' || !Array.isArray(snapshot.rows)) return []
  return snapshot.rows
    .filter((row) => row?.work_status === 'TURNO' && Number.isInteger(row.departure_order))
    .sort((left, right) => left.departure_order - right.departure_order)
}

export function departureDriverLabel(row) {
  const label = [row?.driver_first_name_snapshot, row?.driver_last_name_snapshot]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .trim()
  return label || 'Driver non disponibile'
}
