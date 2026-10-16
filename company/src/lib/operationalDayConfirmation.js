import { normalizeConvocationDriverName } from './convocationDefinitiveCore.js'

const key = value => normalizeConvocationDriverName(value || '')

const indexDrivers = (drivers) => {
  const index = new Map()
  for (const driver of drivers) {
    const name = key(`${driver.last_name} ${driver.first_name}`)
    const items = index.get(name) || []
    items.push(driver)
    index.set(name, items)
  }
  return index
}

export function prepareOperationalDayConfirmation(rows, drivers, vehicles) {
  const driverIndex = indexDrivers(drivers)
  const vehicleIndex = new Map()
  for (const vehicle of vehicles) {
    if (vehicle.status !== 'active') continue
    vehicleIndex.set(`${key(vehicle.internal_code)}|${key(vehicle.plate)}`, vehicle)
  }

  const unresolved = []
  const confirmed = []
  for (const row of rows) {
    const driverName = row.driver_lookup_name || row.driver_name
    const candidates = driverIndex.get(key(driverName)) || []
    const activeDrivers = candidates.filter(driver => driver.status === 'active')
    const archivedDrivers = candidates.filter(driver => driver.status === 'archived')
    const vehicle = vehicleIndex.get(`${key(row.internal_vehicle_code)}|${key(row.vehicle_plate)}`)

    if (activeDrivers.length !== 1 || !vehicle) {
      const archivedDriver = activeDrivers.length === 0 && archivedDrivers.length === 1 ? archivedDrivers[0] : null
      unresolved.push({
        driver: driverName,
        vehicle: `${row.internal_vehicle_code} · ${row.vehicle_plate}`,
        missing_driver: !archivedDriver && activeDrivers.length !== 1,
        archived_driver: archivedDriver ? { driver_id: archivedDriver.driver_id, first_name: archivedDriver.first_name, last_name: archivedDriver.last_name } : null,
        missing_vehicle: !vehicle,
        departure_order: row.departure_order,
        departure_group: row.departure_group,
        parking_lot_position: row.parking_lot_position,
        departure_wave: row.departure_wave,
        route: row.route,
        driver_name_key: key(driverName) || null,
        vehicle_internal_code_key: key(row.internal_vehicle_code) || null,
        vehicle_plate_key: key(row.vehicle_plate) || null,
      })
      continue
    }

    confirmed.push({
      driver_id: activeDrivers[0].driver_id,
      vehicle_id: vehicle.vehicle_id,
      work_status: 'TURNO',
      route: row.route,
      departure_order: row.departure_order,
      departure_group: row.departure_group,
      parking_lot_position: row.parking_lot_position,
      departure_wave: row.departure_wave,
      source: 'manual',
      notes: null,
    })
  }
  return { rows: confirmed, unresolved }
}

export function operationalDayAnomalyPayload(unresolved) {
  return unresolved.map((item, index) => ({
    client_row_id: crypto.randomUUID(),
    reason_code: item.archived_driver ? 'DRIVER_ARCHIVED' : item.missing_vehicle ? 'VEHICLE_MISSING' : 'DRIVER_MISSING',
    driver_id: item.archived_driver?.driver_id ?? null,
    vehicle_id: null,
    driver_name_key: item.driver_name_key,
    vehicle_internal_code_key: item.vehicle_internal_code_key,
    vehicle_plate_key: item.vehicle_plate_key,
    route: item.route ?? null,
    departure_order: item.departure_order ?? null,
    departure_group: item.departure_group ?? null,
    parking_lot_position: item.parking_lot_position ?? null,
    departure_wave: item.departure_wave ?? null,
    local_index: index,
  }))
}
