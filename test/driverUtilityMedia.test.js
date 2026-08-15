import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'
import { getApplicationBySlug } from '../src/data/applications.js'

const product = getApplicationBySlug('driver-utility')

test('Driver Utility uses its compact branded hero content', () => {
  assert.match(product.heroDescription, /Strumenti pratici/)
  assert.deepEqual(product.heroHighlights, ['Pensata per il lavoro sul campo', 'Strumenti raccolti in un’unica app'])
})

test('Driver Utility exposes all six screenshots in the canonical presentation order', async () => {
  assert.deepEqual(product.screenshots.map(({ label }) => label), ['Driver Utility', 'Controlla Mezzi', 'Busta Paga Driver', 'Turni Driver', 'QR Locali', 'Scansione QR'])
  for (const screenshot of product.screenshots) await access(new URL(`../public${screenshot.src}`, import.meta.url))
})

test('all six screenshots participate in the existing lightbox navigation', async () => {
  const media = await readFile(new URL('../src/components/products/ProductMedia.jsx', import.meta.url), 'utf8')
  assert.match(media, /realScreenshots\.findIndex/)
  assert.match(media, /Immagine precedente/)
  assert.match(media, /Immagine successiva/)
  assert.match(media, /event\.key === 'Escape'/)
})
