export const PHOTO_VIEWER_MIN_ZOOM = 1
export const PHOTO_VIEWER_MAX_ZOOM = 8
export const clampPhotoZoom = (zoom) => Math.min(PHOTO_VIEWER_MAX_ZOOM, Math.max(PHOTO_VIEWER_MIN_ZOOM, zoom))
export const nextPhotoZoom = (zoom, delta) => clampPhotoZoom(zoom + delta)
export const zoomAtPoint = ({ zoom, x, y, pointX, pointY, nextZoom }) => {
  const scale = nextZoom / zoom
  return { zoom: nextZoom, x: pointX - (pointX - x) * scale, y: pointY - (pointY - y) * scale }
}
