export function containedImageBox(containerWidth, containerHeight, naturalWidth, naturalHeight) {
  if (![containerWidth, containerHeight, naturalWidth, naturalHeight].every((value) => Number.isFinite(value) && value > 0)) return null
  const scale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight)
  const width = naturalWidth * scale; const height = naturalHeight * scale
  return { left: (containerWidth - width) / 2, top: (containerHeight - height) / 2, width, height }
}

export function pointerToNormalized(point, box) {
  if (point.x < box.left || point.x > box.left + box.width || point.y < box.top || point.y > box.top + box.height) return null
  return { x: Math.max(0, Math.min(1, (point.x - box.left) / box.width)), y: Math.max(0, Math.min(1, (point.y - box.top) / box.height)) }
}
