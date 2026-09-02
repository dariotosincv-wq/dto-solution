import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../src/pages/NacScanWebPage.jsx', import.meta.url), 'utf8')

test('web home follows the five canonical NACScan Android actions', () => {
  const labels = ['Scansiona', 'Modifica PDF', 'Estrai testo', 'Archivio', 'Impostazioni']
  for (const label of labels) assert.match(source, new RegExp(`>${label}<`))
})

test('viewer follows NACScan quick actions and tools sheet terminology', () => {
  for (const label of ['Trova testo', 'Pagina precedente', 'Pagina successiva', 'Strumenti', 'Compila PDF', 'Raddrizza pagina', 'Aggiungi pagine', 'Copri testo', 'Firma']) assert.match(source, new RegExp(label))
})

test('NACScan identity and local-only promise are visible', () => {
  assert.match(source, /logo-nacscan\.webp/)
  assert.match(source, /Scansiona · Firma · Salva/)
  assert.match(source, /non vengono caricati online/)
})
