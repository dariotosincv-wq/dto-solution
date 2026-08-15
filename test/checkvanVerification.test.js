import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  calculateSha256,
  MAX_CHECKVAN_PDF_BYTES,
  validateCheckvanPdf,
} from '../src/lib/checkvanFileVerification.js'

function testFile({ name = 'checkvan.pdf', size = 10, type = 'application/pdf' } = {}) {
  return { name, size, type }
}

test('accepts a PDF within the size limit', () => {
  assert.equal(validateCheckvanPdf(testFile()), null)
  assert.equal(validateCheckvanPdf(testFile({ type: '' })), null)
})

test('rejects missing, empty, non-PDF and oversized files locally', () => {
  assert.equal(validateCheckvanPdf(null), 'missing')
  assert.equal(validateCheckvanPdf(testFile({ size: 0 })), 'empty')
  assert.equal(validateCheckvanPdf(testFile({ name: 'notes.txt', type: 'text/plain' })), 'type')
  assert.equal(validateCheckvanPdf(testFile({ size: MAX_CHECKVAN_PDF_BYTES + 1 })), 'size')
})

test('calculates a lowercase 64-character SHA-256 digest', async () => {
  const file = new Blob(['abc'])
  const sha256 = await calculateSha256(file)

  assert.equal(
    sha256,
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  )
  assert.match(sha256, /^[0-9a-f]{64}$/)
})

test('SQL contract remains exact-match, read-only and anon cannot select the table', async () => {
  const migration = await readFile(
    new URL('../supabase/checkvan-migrations/20260815190000_create_verify_checkvan_document_hash.sql', import.meta.url),
    'utf8',
  )

  assert.match(migration, /p_sha256 !~ '\^\[0-9a-f\]\{64\}\$'/)
  assert.match(migration, /certification\.document_hash = p_sha256/)
  assert.match(migration, /certification\.status = 'active'/)
  assert.match(migration, /certification\.revoked_at is null/)
  assert.match(migration, /grant execute on function public\.verify_checkvan_document_hash\(text\) to anon/)
  assert.doesNotMatch(migration, /grant\s+select/i)
  assert.doesNotMatch(migration, /\b(insert into|update public\.|delete from)\b/i)
})

test('frontend sends only the SHA-256 argument to the verification RPC', async () => {
  const client = await readFile(
    new URL('../src/lib/checkvanSupabase.js', import.meta.url),
    'utf8',
  )

  assert.match(client, /'verify_checkvan_document_hash'/)
  assert.match(client, /\{ p_sha256: sha256 \}/)
  assert.doesNotMatch(client, /FormData|\.upload\(|file\.name|arrayBuffer/)
})
