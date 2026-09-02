export function visualToPdfPoint(x, y, rotation = 0) {
  const angle = ((rotation % 360) + 360) % 360
  if (angle === 90) return { x: y, y: x }
  if (angle === 180) return { x: 1 - x, y: y }
  if (angle === 270) return { x: 1 - y, y: 1 - x }
  return { x, y: 1 - y }
}

export function createTextAnnotation(x, y, text, fontSize = 18, color = 'black') {
  return { id: crypto.randomUUID(), type: 'text', x, y, text, fontSize, color }
}

export function createCoverAnnotation(x, y) {
  return { id: crypto.randomUUID(), type: 'cover', x, y, width: 0.24, height: 0.06 }
}
