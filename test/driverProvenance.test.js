import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'

const manifest = JSON.parse(readFileSync(new URL('../vendor/driver-utility/provenance.json', import.meta.url), 'utf8'))
test('ported Driver Utility source, tests and fixtures retain their original SHA-256', () => {
  for (const entry of manifest.files) {
    const bytes = readFileSync(new URL('../' + entry.destination, import.meta.url))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.destination)
  }
})
