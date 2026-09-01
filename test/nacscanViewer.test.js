import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../src/pages/NacScanWebPage.jsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/styles/pages.css', import.meta.url), 'utf8')

test('large viewer provides bounded zoom, fit width and page navigation', () => {
  assert.match(source, /ZOOM_LEVELS = \[0\.5, 0\.75, 1, 1\.25, 1\.5, 2\]/)
  assert.match(source, /Adatta alla larghezza/)
  assert.match(source, /onPrevious/)
  assert.match(source, /onNext/)
})

test('fullscreen has an Escape fallback and viewport overlay', () => {
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /setFullscreen\(false\)/)
  assert.match(styles, /\.nacscan-viewer\.is-fullscreen/)
  assert.match(styles, /position: fixed/)
})

test('viewer keeps existing rotate, signature, reorder, delete and export actions', () => {
  for (const action of ['moveSelected', 'rotation:', 'setSignatureOpen', 'removeSelected', 'exportPdf']) assert.match(source, new RegExp(action))
})
