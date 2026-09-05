import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'vendor/driver-utility/provenance.json'), 'utf8'))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const verifyReference = process.argv.includes('--reference')
for (const file of manifest.files) {
  assert.equal(sha(readFileSync(resolve(root, file.destination))), file.sha256, `Ported file changed: ${file.destination}`)
  // Optional READ-ONLY comparison. No Git, builds or execution in Driver Utility.
  if (verifyReference) assert.equal(sha(readFileSync(resolve(manifest.sourceRoot, file.source))), file.sha256, `Reference changed: ${file.source}`)
}
const result = { checkedAt: new Date().toISOString(), files: manifest.files.length, originalTests: manifest.files.filter(f => f.kind === 'original-test').length, originalFixtures: manifest.files.filter(f => f.kind === 'original-fixture').length, byteIdentical: true, referenceReadOnlyComparison: verifyReference }
mkdirSync(resolve(root, 'artifacts/driver'), { recursive: true })
writeFileSync(resolve(root, 'artifacts/driver/provenance-check.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
