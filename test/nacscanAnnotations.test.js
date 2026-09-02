import assert from 'node:assert/strict'
import test from 'node:test'
import { createCoverAnnotation, createTextAnnotation, visualToPdfPoint } from '../src/lib/nacscanAnnotations.js'

test('creates normalized text and graphical cover annotations', () => {
  const text = createTextAnnotation(.2, .3, 'Prova', 24, 'blue')
  const cover = createCoverAnnotation(.4, .5)
  assert.deepEqual({ type: text.type, x: text.x, y: text.y, text: text.text, fontSize: text.fontSize, color: text.color }, { type: 'text', x: .2, y: .3, text: 'Prova', fontSize: 24, color: 'blue' })
  assert.deepEqual({ type: cover.type, width: cover.width, height: cover.height }, { type: 'cover', width: .24, height: .06 })
})

test('maps visual coordinates for rotated PDF pages', () => {
  assert.deepEqual(visualToPdfPoint(.2, .3, 0), { x: .2, y: .7 })
  assert.deepEqual(visualToPdfPoint(.2, .3, 90), { x: .3, y: .2 })
  assert.deepEqual(visualToPdfPoint(.2, .3, 180), { x: .8, y: .3 })
  assert.deepEqual(visualToPdfPoint(.2, .3, 270), { x: .7, y: .8 })
})
