import assert from 'node:assert/strict'
import test from 'node:test'
import { searchNacScanPages } from '../src/lib/nacscanPdfSearch.js'
import { loadNacScanWebPreferences, resolveNacScanLanguage, saveNacScanWebPreferences } from '../src/lib/nacscanWebPreferences.js'
import { createNacScanSignature, deleteNacScanSignature, loadNacScanSignatures, saveNacScanSignatures } from '../src/lib/nacscanWebSignatures.js'
import { createAndroidCompatiblePdfName, resolveDriveArchivePath } from '../src/lib/nacscanGoogleDrive.js'
import { saveNacScanFile } from '../src/lib/nacscanWebStorage.js'

function memoryStorage() {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
}

test('language preference survives reload and auto follows supported browser languages', () => {
  const storage = memoryStorage()
  saveNacScanWebPreferences({ languagePreference: 'fr' }, storage)
  assert.equal(loadNacScanWebPreferences(storage).languagePreference, 'fr')
  assert.equal(resolveNacScanLanguage('auto', 'de-DE'), 'de')
  assert.equal(resolveNacScanLanguage('auto', 'nl-NL'), 'it')
})

test('saved signatures persist and deletion promotes a remaining default', () => {
  const storage = memoryStorage()
  const first = createNacScanSignature('data:image/png;base64,one', [], 'Firma lavoro')
  const second = createNacScanSignature('data:image/png;base64,two', [first], 'Firma privata')
  saveNacScanSignatures([first, second], storage)
  assert.equal(loadNacScanSignatures(storage).length, 2)
  const remaining = deleteNacScanSignature(loadNacScanSignatures(storage), first.id)
  assert.equal(remaining[0].isDefault, true)
})

test('multipage search finds occurrences, phrases and reports image-only documents honestly', async () => {
  const contentByPage = { 1: [{ str: 'Prima fattura', transform: [1, 0, 0, 12, 10, 90], width: 60, height: 12 }], 2: [{ str: 'numero', transform: [1, 0, 0, 12, 20, 80], width: 35, height: 12 }, { str: 'fattura', transform: [1, 0, 0, 12, 60, 80], width: 40, height: 12 }] }
  const getDocument = () => ({ promise: Promise.resolve({ getPage: async (number) => ({ getViewport: () => ({ width: 100, height: 100 }), getTextContent: async () => ({ items: contentByPage[number] }) }), destroy: async () => {} }), destroy: async () => {} })
  const pages = [{ id: 'p1', kind: 'pdf', bytes: new Uint8Array([1]), pageNumber: 1 }, { id: 'p2', kind: 'pdf', bytes: new Uint8Array([1]), pageNumber: 2 }]
  const word = await searchNacScanPages(pages, 'fattura', getDocument)
  assert.equal(word.results.length, 2)
  const phrase = await searchNacScanPages(pages, 'numero fattura', getDocument)
  assert.equal(phrase.results[0].pageId, 'p2')
  assert.deepEqual(await searchNacScanPages([{ id: 'image', kind: 'image' }], 'x', getDocument), { searchable: false, results: [] })
})

test('Drive uses the Android NACScan company/type/year/month/day path', () => {
  assert.deepEqual(resolveDriveArchivePath('ENEL', 'Fatture', new Date(2026, 6, 15), 'it'), ['ENEL', 'Fatture', '2026', 'Luglio', '15'])
  assert.deepEqual(resolveDriveArchivePath('A/B', 'Documenti', new Date(2026, 0, 2), 'it').slice(0, 2), ['A B', 'Documenti'])
})

test('PDF names follow Android conventions for imported, signed and scanned documents', () => {
  assert.equal(createAndroidCompatiblePdfName([{ kind: 'pdf', name: 'contratto.pdf', annotations: [] }]), 'contratto-modificato.pdf')
  assert.equal(createAndroidCompatiblePdfName([{ kind: 'pdf', name: 'contratto.pdf', annotations: [{ type: 'signature' }] }]), 'contratto-firmato.pdf')
  assert.equal(createAndroidCompatiblePdfName([{ kind: 'image' }], new Date(2026, 6, 15, 9, 8, 7, 6)), 'nacscan-documento-2026-07-15-09-08-07-006.pdf')
})

test('selected browser directory receives the generated PDF', async () => {
  let written = null
  const writable = { write: async (value) => { written = value }, close: async () => {} }
  const handle = { name: 'NACSCAN', queryPermission: async () => 'granted', getFileHandle: async (name) => { assert.equal(name, 'documento.pdf'); return { createWritable: async () => writable } } }
  const blob = new Blob(['pdf'], { type: 'application/pdf' })
  assert.deepEqual(await saveNacScanFile(blob, 'documento.pdf', handle), { method: 'directory', label: 'NACSCAN' })
  assert.equal(written, blob)
})
