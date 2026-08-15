export const DEFAULT_COMPARISON_SYNCED = true
export const DEFAULT_PHOTO_TRANSFORM = Object.freeze({ zoom: 1, x: 0, y: 0 })

export function comparisonTransformKey(categoryId, view, side, synced) {
  return `${categoryId}-${view}-${synced ? 'synced' : side}`
}

export function changeSyncMode(transforms, categoryId, synced) {
  const next = { ...transforms }
  for (const view of ['list', 'modal']) {
    const sharedKey = comparisonTransformKey(categoryId, view, 'before', true)
    const beforeKey = comparisonTransformKey(categoryId, view, 'before', false)
    const afterKey = comparisonTransformKey(categoryId, view, 'after', false)
    if (synced) {
      const shared = next[sharedKey] ?? DEFAULT_PHOTO_TRANSFORM
      next[beforeKey] = { ...shared }
      next[afterKey] = { ...shared }
    } else {
      next[sharedKey] = { ...(next[beforeKey] ?? next[afterKey] ?? next[sharedKey] ?? DEFAULT_PHOTO_TRANSFORM) }
    }
  }
  return next
}

export const compactDocumentLabel = (metadata = {}) => [metadata.inspectionType, metadata.date, metadata.time].filter(Boolean).join(' ')

export function compactVehicleLabel(first = {}, second = {}) {
  return [first.plate || second.plate, first.vehicle || second.vehicle].filter(Boolean).join(' · ')
}
