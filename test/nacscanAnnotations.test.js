import assert from 'node:assert/strict'
import test from 'node:test'
import { createCoverAnnotation, createSignatureAnnotation, createTextAnnotation, movePagePointFromVisualDelta, pageToVisualPoint, updateTextAnnotation, visualToPagePoint } from '../src/lib/nacscanAnnotations.js'

test('creates normalized text and graphical cover annotations', () => {
  const text = createTextAnnotation(.2, .3, 'Prova', 24, 'blue')
  const cover = createCoverAnnotation(.4, .5)
  assert.deepEqual({ type: text.type, x: text.x, y: text.y, text: text.text, fontSize: text.fontSize, color: text.color }, { type: 'text', x: .2, y: .3, text: 'Prova', fontSize: 24, color: 'blue' })
  assert.deepEqual({ type: cover.type, width: cover.width, height: cover.height }, { type: 'cover', width: .24, height: .06 })
})

test('page coordinates round-trip through every visual rotation', () => {
  for (const rotation of [0, 90, 180, 270]) {
    const visual = pageToVisualPoint(.2, .3, rotation)
    const page = visualToPagePoint(visual.x, visual.y, rotation)
    assert.ok(Math.abs(page.x - .2) < 1e-12)
    assert.ok(Math.abs(page.y - .3) < 1e-12)
  }
})

test('successive page rotations never mutate or drift the normalized anchor', () => {
  const original = { x: .173, y: .827 }
  for (const sequence of [[90, 0], [90, 180, 270, 0], [180, 0]]) {
    for (const rotation of sequence) {
      const visual = pageToVisualPoint(original.x, original.y, rotation)
      const restored = visualToPagePoint(visual.x, visual.y, rotation)
      assert.ok(Math.abs(restored.x - original.x) < 1e-12)
      assert.ok(Math.abs(restored.y - original.y) < 1e-12)
    }
  }
})

test('text formatting remains attached to the same annotation through rotations', () => {
  const annotation = updateTextAnnotation(createTextAnnotation(.3, .4, 'Testo'), { fontSize: 26, fontWeight: 'bold', fontStyle: 'italic', textDecoration: 'underline' })
  for (const rotation of [90, 180, 270, 360]) {
    const visual = pageToVisualPoint(annotation.x, annotation.y, rotation)
    visualToPagePoint(visual.x, visual.y, rotation)
    assert.deepEqual({ fontSize: annotation.fontSize, fontWeight: annotation.fontWeight, fontStyle: annotation.fontStyle, textDecoration: annotation.textDecoration }, { fontSize: 26, fontWeight: 'bold', fontStyle: 'italic', textDecoration: 'underline' })
  }
})

test('updates an existing text annotation without changing identity or adding another item', () => {
  const original = createTextAnnotation(.2, .3, 'Prima')
  const annotations = [original].map((item) => item.id === original.id ? updateTextAnnotation(item, { text: 'Dopo', fontSize: 32 }) : item)
  assert.equal(annotations.length, 1)
  assert.equal(annotations[0].id, original.id)
  assert.equal(annotations[0].text, 'Dopo')
  assert.equal(annotations[0].fontSize, 32)
})

test('drag deltas are stored in normalized original-page coordinates', () => {
  assert.deepEqual(movePagePointFromVisualDelta({ x: .2, y: .3 }, .1, -.05, 0), { x: .30000000000000004, y: .25 })
  const movedAt90 = movePagePointFromVisualDelta({ x: .2, y: .3 }, .1, -.05, 90)
  assert.ok(Math.abs(movedAt90.x - .15) < 1e-12)
  assert.ok(Math.abs(movedAt90.y - .2) < 1e-12)
})

test('creates a resizable signature anchored to the page', () => {
  const signature = createSignatureAnnotation(.25, .6, 'data:image/png;base64,test')
  assert.deepEqual({ type: signature.type, x: signature.x, y: signature.y, width: signature.width }, { type: 'signature', x: .25, y: .6, width: .3 })
})
