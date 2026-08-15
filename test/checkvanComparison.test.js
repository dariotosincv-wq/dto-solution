import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { CHECKVAN_CATEGORIES, matchLabelsToImages, parseCheckvanMetadata, platesDiffer, recognizeCategory, releaseComparison, validatePdfFile } from '../src/lib/checkvanComparisonCore.js'
import { clampZoom } from '../src/lib/zoom.js'

test('recognizes exactly the 14 canonical categories', () => {
  assert.equal(CHECKVAN_CATEGORIES.length, 14)
  for (const category of CHECKVAN_CATEGORIES) assert.equal(recognizeCategory(category.it), category.id)
})

test('excludes plate, signature and additional photographs', () => {
  for (const label of ['Foto targa - GS131WM', 'Firma', 'Foto aggiuntiva 1']) assert.equal(recognizeCategory(label), null)
})

test('matches by category, page and geometry rather than stream order', () => {
  const labels = [{ category: 'front-full', page: 1, x: 40, y: 100 }, { category: 'rear-full', page: 2, x: 300, y: 100 }]
  const images = [{ name: 'wrong-order', page: 2, x: 290, y: 110, width: 200 }, { name: 'correct', page: 1, x: 30, y: 110, width: 200 }]
  const result = matchLabelsToImages(labels, images)
  assert.equal(result.get('front-full').name, 'correct'); assert.equal(result.get('rear-full').name, 'wrong-order')
})

test('leaves a missing category absent', () => assert.equal(matchLabelsToImages([{ category: 'front-full', page: 1, x: 0, y: 0 }], []).has('front-full'), false))

test('parses metadata and compares readable plates', () => {
  const data = parseCheckvanMetadata("Veicolo: S70 | Targa: GS131WM | Tipo di ispezione: Presa | Data dell'ispezione: 10/08/2026 | Ora dell'ispezione: 08:56 |")
  assert.deepEqual(data, { vehicle: 'S70', plate: 'GS131WM', inspectionType: 'Presa', date: '10/08/2026', time: '08:56' })
  assert.equal(platesDiffer('GS131WM', 'gs131wm'), false); assert.equal(platesDiffer('GS131WM', 'AB123CD'), true); assert.equal(platesDiffer('', 'AB123CD'), false)
})

test('rejects invalid or empty PDF selections', () => {
  assert.equal(validatePdfFile({ name: 'x.txt', type: 'text/plain', size: 4 }), 'type')
  assert.equal(validatePdfFile({ name: 'x.pdf', type: 'application/pdf', size: 0 }), 'empty')
  assert.equal(validatePdfFile({ name: 'x.pdf', type: 'application/pdf', size: 4 }), null)
})

test('reset cleanup revokes every object URL and destroys documents', async () => {
  const revoked = []; const original = URL.revokeObjectURL; URL.revokeObjectURL = (url) => revoked.push(url)
  let destroyed = false
  await releaseComparison([{ photos: { a: 'blob:a', b: 'blob:b' }, loadingTask: { destroy: async () => { destroyed = true } } }])
  URL.revokeObjectURL = original
  assert.deepEqual(revoked, ['blob:a', 'blob:b']); assert.equal(destroyed, true)
})

test('zoom clamps to supported range', () => { assert.equal(clampZoom(0), 1); assert.equal(clampZoom(2), 2); assert.equal(clampZoom(9), 4) })

test('comparison source has navigation and no upload/network/Supabase path', async () => {
  const page = await readFile(new URL('../src/pages/CheckVanComparisonPage.jsx', import.meta.url), 'utf8')
  const library = await readFile(new URL('../src/lib/checkvanComparison.js', import.meta.url), 'utf8')
  assert.match(page, /setActive\(active - 1\)/); assert.match(page, /setActive\(active \+ 1\)/)
  for (const forbidden of ['FormData', 'fetch(', 'supabase', 'XMLHttpRequest']) assert.equal(`${page}\n${library}`.toLowerCase().includes(forbidden.toLowerCase()), false)
})
