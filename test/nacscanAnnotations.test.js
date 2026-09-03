import assert from 'node:assert/strict'
import test from 'node:test'
import { createCoverAnnotation, createSignatureAnnotation, createTextAnnotation, pageToVisualPoint, visualToPagePoint } from '../src/lib/nacscanAnnotations.js'

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

test('creates a resizable signature anchored to the page', () => {
  const signature = createSignatureAnnotation(.25, .6, 'data:image/png;base64,test')
  assert.deepEqual({ type: signature.type, x: signature.x, y: signature.y, width: signature.width }, { type: 'signature', x: .25, y: .6, width: .3 })
})
