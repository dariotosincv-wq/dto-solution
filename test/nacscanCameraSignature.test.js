import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../src/pages/NacScanWebPage.jsx', import.meta.url), 'utf8')

test('camera uses getUserMedia and has explicit denied/unavailable fallback', () => {
  assert.match(source, /getUserMedia/)
  assert.match(source, /facingMode/)
  assert.match(source, /permesso negato/)
  assert.match(source, /Importa immagine/)
})

test('signature supports draw, image import, page placement, move and resize', () => {
  assert.match(source, /Importa firma/)
  assert.match(source, /activeTool === 'signature'/)
  assert.match(source, /Ingrandisci firma/)
  assert.match(source, /moveDrag/)
})

test('text extraction exposes progress, readable output and copy', () => {
  assert.match(source, /Elaborazione in corso/)
  assert.match(source, /nacscan-extracted-text/)
  assert.match(source, /clipboard/)
})
