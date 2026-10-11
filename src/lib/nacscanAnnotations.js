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

export function visualRectToPageRect({ x, y, width, height }, rotation = 0) {
  const corners = [
    visualToPagePoint(x, y, rotation),
    visualToPagePoint(x + width, y, rotation),
    visualToPagePoint(x, y + height, rotation),
    visualToPagePoint(x + width, y + height, rotation),
  ]
  const xs = corners.map((point) => point.x)
  const ys = corners.map((point) => point.y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top }
}

export function pageRectToVisualRect({ x, y, width, height }, rotation = 0) {
  const corners = [
    pageToVisualPoint(x, y, rotation),
    pageToVisualPoint(x + width, y, rotation),
    pageToVisualPoint(x, y + height, rotation),
    pageToVisualPoint(x + width, y + height, rotation),
  ]
  const xs = corners.map((point) => point.x)
  const ys = corners.map((point) => point.y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top }
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

export function createCoverAnnotation(x, y, width = 0.24, height = 0.06) {
  return { id: crypto.randomUUID(), type: 'cover', x: clampPoint(x), y: clampPoint(y), width: clampPoint(width), height: clampPoint(height) }
}

export function createSignatureAnnotation(x, y, image, width = 0.3) {
  return { id: crypto.randomUUID(), type: 'signature', x, y, image, width }
}
