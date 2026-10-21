import assert from 'node:assert/strict'
import test from 'node:test'
import { PHOTO_VIEWER_MAX_ZOOM, PHOTO_VIEWER_MIN_ZOOM, clampPhotoZoom, nextPhotoZoom, zoomAtPoint } from '../company/src/lib/photoViewerState.js'

test('photo viewer clamps zoom between fit and 800 percent', () => {
  assert.equal(clampPhotoZoom(.2), PHOTO_VIEWER_MIN_ZOOM)
  assert.equal(clampPhotoZoom(20), PHOTO_VIEWER_MAX_ZOOM)
  assert.equal(nextPhotoZoom(7.5, 1), PHOTO_VIEWER_MAX_ZOOM)
})
test('photo viewer zoom keeps the pointer anchor stable', () => {
  assert.deepEqual(zoomAtPoint({ zoom: 1, x: 0, y: 0, pointX: 40, pointY: -20, nextZoom: 2 }), { zoom: 2, x: -40, y: 20 })
})
