const sortVisual = (left, right) => left.page - right.page || right.y - left.y || left.x - right.x
const groupPattern = /^GRUPPO\s+(\d+)$/i
const routePattern = /^[A-Z]{2}_[A-Z]\d{1,2}$/i
const rowTolerance = 8

const inBand = (item, minimum, maximum) => {
  const position = item.x / item.page_width
  return position >= minimum && position <= maximum
}

const onVisualRow = (items, anchor, predicate) => items
  .filter((item) => item.page === anchor.page && Math.abs(item.y - anchor.y) <= rowTolerance && predicate(item))
  .sort((left, right) => left.x - right.x)

const valueFrom = (items) => items.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim() || null

export function parseAssignmentDepartureItems(items = []) {
  const normalized = items
    .filter((item) => typeof item?.text === 'string' && item.text.trim())
    .map((item) => ({ page: item.page, x: item.x, y: item.y, page_width: item.page_width || 595, text: item.text.trim() }))
  const anchors = normalized.filter((item) => groupPattern.test(item.text)).sort(sortVisual)
  let departureWave = 1, previousParkingLotPosition = null
  const rows = anchors.map((anchor, index) => {
    const departureGroup = Number(groupPattern.exec(anchor.text)[1])
    const route = valueFrom(onVisualRow(normalized, anchor, (item) => inBand(item, 0.18, 0.32) && routePattern.test(item.text)))
    const driverName = valueFrom(onVisualRow(normalized, anchor, (item) => inBand(item, 0.32, 0.52)))
    const parkingText = valueFrom(onVisualRow(normalized, anchor, (item) => inBand(item, 0.53, 0.65) && /^\d+$/.test(item.text)))
    const parkingLotPosition = parkingText === null ? null : Number(parkingText)
    const atlasIndication = valueFrom(onVisualRow(normalized, anchor, (item) => inBand(item, 0.65, 0.75) && /^ATLAS$/i.test(item.text)))
    if (parkingLotPosition === 0 && previousParkingLotPosition !== null && previousParkingLotPosition > 0) departureWave += 1
    if (parkingLotPosition !== null) previousParkingLotPosition = parkingLotPosition
    const issues = []
    if (!Number.isInteger(departureGroup)) issues.push('DEPARTURE_GROUP_NOT_FOUND')
    if (!route) issues.push('ROUTE_NOT_FOUND')
    if (!driverName) issues.push('DRIVER_NAME_NOT_FOUND')
    if (!Number.isInteger(parkingLotPosition)) issues.push('PARKING_LOT_POSITION_NOT_FOUND')
    return {
      row: index + 1,
      status: issues.length ? 'incomplete' : 'parsed',
      departure_group: departureGroup,
      route,
      driver_name: driverName,
      parking_lot_position: parkingLotPosition,
      atlas_indication: atlasIndication,
      // Informational only: this never affects the global queue order.
      departure_wave: departureWave,
      departure_order: index + 1,
      issues,
    }
  })
  return {
    departure_date: null,
    departure_date_status: 'not_verifiable_from_content',
    rows,
    outcomes: [],
  }
}
