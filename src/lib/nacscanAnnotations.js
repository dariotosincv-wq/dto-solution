export function visualToPagePoint(x, y, rotation = 0) {
  const angle = ((rotation % 360) + 360) % 360
  if (angle === 90) return { x: y, y: 1 - x }
  if (angle === 180) return { x: 1 - x, y: 1 - y }
  if (angle === 270) return { x: 1 - y, y: x }
  return { x, y }
}

export function pageToVisualPoint(x, y, rotation = 0) {
  const angle = ((rotation % 360) + 360) % 360
  if (angle === 90) return { x: 1 - y, y: x }
  if (angle === 180) return { x: 1 - x, y: 1 - y }
  if (angle === 270) return { x: y, y: 1 - x }
  return { x, y }
}

export function createTextAnnotation(x, y, text, fontSize = 18, color = 'black') {
  return { id: crypto.randomUUID(), type: 'text', x, y, text, fontSize, color, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none' }
}

const clampPoint = (value) => Math.max(0, Math.min(1, value))

export function movePagePointFromVisualDelta(point, deltaX, deltaY, rotation = 0) {
  const visual = pageToVisualPoint(point.x, point.y, rotation)
  return visualToPagePoint(clampPoint(visual.x + deltaX), clampPoint(visual.y + deltaY), rotation)
}

export function updateTextAnnotation(annotation, changes) {
  return { ...annotation, ...changes, id: annotation.id, type: 'text' }
}

export function createCoverAnnotation(x, y) {
  return { id: crypto.randomUUID(), type: 'cover', x, y, width: 0.24, height: 0.06 }
}

export function createSignatureAnnotation(x, y, image, width = 0.3) {
  return { id: crypto.randomUUID(), type: 'signature', x, y, image, width }
}
