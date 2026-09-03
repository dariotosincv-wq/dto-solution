import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../src/pages/NacScanWebPage.jsx', import.meta.url), 'utf8')

test('web home follows the five canonical NACScan Android actions', () => {
  const labels = ['Scansiona', 'Modifica PDF', 'Estrai testo', 'Archivio', 'Impostazioni']
  for (const label of labels) assert.match(source, new RegExp(`>${label}<`))
})

test('web home completes the grid with the official Google Play CTA', async () => {
  const applications = await readFile(new URL('../src/data/applications.js', import.meta.url), 'utf8')
  assert.match(source, /getApplicationBySlug\('nacscan'\)\.playStoreUrl/)
  assert.match(source, /NACScan su Google Play/)
  assert.match(source, /Scarica l’app gratuita per Android/)
  assert.match(source, /target="_blank" rel="noopener noreferrer"/)
  assert.match(applications, /https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.dariot\.app\.nacscan/)
})

test('viewer follows NACScan quick actions and tools sheet terminology', () => {
  for (const label of ['Trova testo', 'Pagina precedente', 'Pagina successiva', 'Strumenti', 'Compila PDF', 'Raddrizza pagina', 'Aggiungi pagine', 'Copri testo', 'Firma']) assert.match(source, new RegExp(label))
})

test('NACScan identity and local-only promise are visible', () => {
  assert.match(source, /logo-nacscan\.webp/)
  assert.match(source, /Scansiona · Firma · Salva/)
  assert.match(source, /non vengono caricati online/)
})
