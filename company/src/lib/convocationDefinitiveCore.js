const sectionLabel = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
const sortVisual = (left, right) => left.page - right.page || right.y - left.y || left.x - right.x
const italianPlate = /([A-Z])\s*([A-Z])\s*(\d)\s*(\d)\s*(\d)\s*([A-Z])\s*([A-Z])/

export function normalizeConvocationDriverName(value = '') { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('it-IT').replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' ') }

export function parseItalianVehicleReference(value = '') {
  const text = String(value).replace(/[()]/g, '').trim().toUpperCase(), match = text.match(italianPlate)
  if (!match) return { internal_code: null, plate: null, issue: 'ITALIAN_PLATE_NOT_FOUND' }
  const plate = match.slice(1).join(''), internal_code = text.replace(match[0], '').replace(/^[\s-]+|[\s-]+$/g, '').trim() || null
  return internal_code ? { internal_code, plate, issue: null } : { internal_code: null, plate, issue: 'INTERNAL_VEHICLE_CODE_NOT_FOUND' }
}

const parseDate = (items) => { for (const item of items) { const match = item.text.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/); if (!match) continue; const [, day, month, year] = match, candidate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`; if (!Number.isNaN(Date.parse(`${candidate}T00:00:00Z`))) return candidate } return null }
const inDeliverySection = (items) => { const ordered = [...items].sort(sortVisual), delivery = ordered.findIndex((item) => sectionLabel(item.text) === 'DELIVERY'); if (delivery < 0) return []; const end = ordered.findIndex((item, index) => index > delivery && sectionLabel(item.text) === 'UFFICIO'); return ordered.slice(delivery + 1, end < 0 ? undefined : end) }
const shiftLabel = (value) => /^[-\s]*TURNO\b/i.test(value)
const sameColumn = (item, anchor) => item.page === anchor.page && (item.x < item.page_width / 2) === (anchor.x < anchor.page_width / 2)
// PDF text runs with different fonts can share a visual row while their reported
// baselines differ slightly. Eight points remains well below the next row spacing.
const driverBaselineTolerance = 16

export function parseConvocationDefinitiveItems(items = []) {
  const normalized = items.filter((item) => typeof item?.text === 'string' && item.text.trim()).map((item) => ({ page: item.page, x: item.x, y: item.y, page_width: item.page_width || 595, text: item.text.trim() }))
  const deliveryItems = inDeliverySection(normalized), anchors = deliveryItems.filter((item) => shiftLabel(item.text)), usedVehicles = new Set()
  const rows = anchors.map((anchor, index) => {
    const onRow = deliveryItems.filter((item) => sameColumn(item, anchor) && Math.abs(item.y - anchor.y) <= driverBaselineTolerance && item.x < anchor.x && !shiftLabel(item.text) && !/^\(/.test(item.text))
    const driver_name = onRow.sort((left, right) => right.y - left.y || left.x - right.x).map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim() || null
    const vehicleItem = deliveryItems.filter((item) => sameColumn(item, anchor) && item.y < anchor.y && anchor.y - item.y <= 24 && /^\(.*\)$/.test(item.text)).sort((left, right) => right.y - left.y)[0]
    if (vehicleItem) usedVehicles.add(vehicleItem)
    const vehicle = vehicleItem ? parseItalianVehicleReference(vehicleItem.text) : { internal_code: null, plate: null, issue: 'VEHICLE_REFERENCE_NOT_FOUND' }, issues = []
    if (!driver_name) issues.push('DRIVER_NAME_NOT_FOUND'); if (vehicle.issue) issues.push(vehicle.issue)
    return { row: index + 1, status: issues.length ? 'incomplete' : 'parsed', driver_name, driver_name_key: driver_name ? normalizeConvocationDriverName(driver_name) : null, shift_type: sectionLabel(anchor.text).replace(/^-|-$|\s+/g, '_'), internal_vehicle_code: vehicle.internal_code, vehicle_plate: vehicle.plate, issues }
  })
  const orphanVehicles = deliveryItems.filter((item) => /^\(.*\)$/.test(item.text) && !usedVehicles.has(item))
  return { convocation_date: parseDate(normalized), rows, outcomes: orphanVehicles.map((_, index) => ({ row: anchors.length + index + 1, status: 'uninterpretable', issues: ['ORPHAN_VEHICLE_REFERENCE'] })) }
}
