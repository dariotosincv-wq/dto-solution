export const MAX_COMPARISON_ZOOM = 6
export const clampZoom = (zoom) => Math.min(MAX_COMPARISON_ZOOM, Math.max(1, zoom))
export const zoomAtPointer = ({ zoom, x, y, pointX, pointY, nextZoom }) => {
  const scale = nextZoom / zoom
  return { zoom: nextZoom, x: pointX - (pointX - x) * scale, y: pointY - (pointY - y) * scale }
}
