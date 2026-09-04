import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { containedImageBox, pointerToNormalized } from '../company/src/lib/damageImageGeometry.js'

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9)

test('normalized damage remains visually identical across responsive sizes', () => {
  for (const [width, height] of [[360, 480], [412, 620], [768, 900], [1280, 720], [1920, 1080]]) {
    const box = containedImageBox(width, height, 900, 360)
    const point = pointerToNormalized({ x: box.left + .7 * box.width, y: box.top + .3 * box.height }, box)
    close(point.x, .7); close(point.y, .3)
  }
})

test('front, rear, left and right use their own real image aspect ratio', () => {
  for (const [view, naturalWidth, naturalHeight] of [['FRONT',512,256],['REAR',512,256],['LEFT',900,360],['RIGHT',900,360]]) {
    const box = containedImageBox(500, 500, naturalWidth, naturalHeight)
    assert.deepEqual(pointerToNormalized({ x: box.left + box.width / 2, y: box.top + box.height / 2 }, box), { x: .5, y: .5 }, view)
  }
})

test('letterbox clicks are rejected and image boundaries clamp to canonical range', () => {
  const box = containedImageBox(400, 500, 900, 360)
  assert.equal(pointerToNormalized({ x: 200, y: 20 }, box), null)
  assert.deepEqual(pointerToNormalized({ x: box.left, y: box.top }, box), { x: 0, y: 0 })
  assert.deepEqual(pointerToNormalized({ x: box.left + box.width, y: box.top + box.height }, box), { x: 1, y: 1 })
})

test('Area Aziende uses real contained image geometry for add, move and rendering', async () => {
  const source = await readFile(new URL('../company/src/components/DamageMap.jsx', import.meta.url), 'utf8')
  assert.match(source, /containedImageBox\(canvas\.clientWidth, canvas\.clientHeight/)
  assert.match(source, /pointerToNormalized/)
  assert.match(source, /imageBox\.left \+ d\.normalized_x \* imageBox\.width/)
  assert.match(source, /if \(!point\) return/)
})

test('mobile map fits the viewport, keeps all tabs reachable and rejects gestures as taps', async () => {
  const source = await readFile(new URL('../company/src/components/DamageMap.jsx', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../company/src/styles.css', import.meta.url), 'utf8')
  assert.match(styles, /\.damage-canvas\{[^}]*width:100%[^}]*min-width:0[^}]*touch-action:pan-y/)
  assert.match(styles, /@media\(max-width:48rem\).*\.damage-tabs\{[^}]*flex-wrap:nowrap[^}]*overflow-x:auto/s)
  assert.match(styles, /\.damage-tabs button\{[^}]*flex:0 0 auto[^}]*white-space:nowrap/s)
  assert.match(styles, /\.damage-canvas\{[^}]*height:min\(62\.5vw,calc\(100dvh - 14rem\)\)[^}]*aspect-ratio:auto/s)
  assert.match(source, /pointer\.pointerType === "mouse" \? 8 : 5/)
  assert.match(source, /gesture\.pointers\.size > 1.*gesture\.blocked = true/s)
  const canvasOpeningTag = source.match(/<div\s+ref=\{canvasRef\}[\s\S]*?>/)?.[0] || ''
  assert.doesNotMatch(canvasOpeningTag, /onClick=/)
})

test('touch drag captures the pointer and always releases it on up or cancel', async () => {
  const source = await readFile(new URL('../company/src/components/DamageMap.jsx', import.meta.url), 'utf8')
  assert.match(source, /setPointerCapture\?\.\(event\.pointerId\)/)
  assert.match(source, /hasPointerCapture\?\.\(pointerId\).*releasePointerCapture\(pointerId\)/s)
  assert.match(source, /cancelGesture[\s\S]*releaseGestureCapture\(event\.currentTarget, event\.pointerId\)/)
  assert.match(source, /finishGesture[\s\S]*releaseGestureCapture\(event\.currentTarget, event\.pointerId\)/)
})

test('drag from a marker cannot select it or create a phantom damage', async () => {
  const source = await readFile(new URL('../company/src/components/DamageMap.jsx', import.meta.url), 'utf8')
  assert.match(source, /pointer\?\.moved.*suppressMarkerClickUntil = performance\.now\(\) \+ 500/)
  assert.match(source, /performance\.now\(\) < gestureRef\.current\.suppressMarkerClickUntil/)
  assert.match(source, /if \(!intentionalTap \|\| disabled \|\| event\.target\.closest\("\[data-marker\]"\)\) return/)
})

test('vertical page scroll remains enabled while touch drag receives immediate feedback', async () => {
  const source = await readFile(new URL('../company/src/components/DamageMap.jsx', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../company/src/styles.css', import.meta.url), 'utf8')
  assert.match(styles, /\.damage-canvas\{[^}]*touch-action:pan-y/)
  assert.match(styles, /\.damage-canvas\.is-dragging\{[^}]*user-select:none/)
  assert.match(styles, /\.damage-canvas>img\{[^}]*pointer-events:none/)
  assert.match(source, /setDragging\(true\)/)
  assert.match(source, /setDragging\(false\)/)
})
