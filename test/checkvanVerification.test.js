import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  calculateSha256,
  checkvanVerificationReducer,
  initialCheckvanVerificationState,
  MAX_CHECKVAN_BATCH_FILES,
  MAX_CHECKVAN_PDF_BYTES,
  summarizeCheckvanResults,
  validateCheckvanBatch,
  validateCheckvanPdf,
  verifyCheckvanFiles,
} from '../src/lib/checkvanFileVerification.js'

function testFile({ name = 'checkvan.pdf', size = 10, type = 'application/pdf' } = {}) {
  return { name, size, type }
}

function pdfFile(name, content) {
  const file = new Blob([content], { type: 'application/pdf' })
  Object.defineProperty(file, 'name', { value: name })
  return file
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

test('accepts one PDF and a batch of up to 10 PDFs', () => {
  assert.equal(validateCheckvanBatch([testFile()]), null)
  assert.equal(
    validateCheckvanBatch(Array.from({ length: MAX_CHECKVAN_BATCH_FILES }, (_, index) => (
      testFile({ name: `checkvan-${index}.pdf` })
    ))),
    null,
  )
})

test('rejects 11 PDFs before verification', () => {
  const files = Array.from({ length: MAX_CHECKVAN_BATCH_FILES + 1 }, (_, index) => (
    testFile({ name: `checkvan-${index}.pdf` })
  ))

  assert.deepEqual(validateCheckvanBatch(files), { code: 'batch_size', file: null })
})

test('rejects the whole batch clearly when one file is invalid', () => {
  const invalid = testFile({ name: 'notes.txt', type: 'text/plain' })
  assert.deepEqual(
    validateCheckvanBatch([testFile(), invalid]),
    { code: 'type', file: invalid },
  )
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

test('verifies one PDF with the existing hash verifier', async () => {
  const calls = []
  const results = await verifyCheckvanFiles([pdfFile('registered.pdf', 'registered')], async (sha256) => {
    calls.push(sha256)
    return true
  })

  assert.deepEqual(results, [{ name: 'registered.pdf', status: 'verified' }])
  assert.equal(calls.length, 1)
  assert.match(calls[0], /^[0-9a-f]{64}$/)
})

test('verifies multiple PDFs sequentially and keeps verified and not verified distinct', async () => {
  let activeCalls = 0
  let maxActiveCalls = 0
  const received = []
  const files = [pdfFile('one.pdf', 'one'), pdfFile('two.pdf', 'two')]
  const results = await verifyCheckvanFiles(files, async (sha256) => {
    activeCalls += 1
    maxActiveCalls = Math.max(maxActiveCalls, activeCalls)
    received.push(sha256)
    await Promise.resolve()
    activeCalls -= 1
    return received.length === 1
  })

  assert.deepEqual(results, [
    { name: 'one.pdf', status: 'verified' },
    { name: 'two.pdf', status: 'not_verified' },
  ])
  assert.equal(maxActiveCalls, 1)
  assert.equal(received.length, 2)
  received.forEach((sha256) => assert.match(sha256, /^[0-9a-f]{64}$/))
})

test('keeps an RPC or network error separate and continues the batch', async () => {
  let call = 0
  const results = await verifyCheckvanFiles(
    [pdfFile('offline.pdf', 'offline'), pdfFile('present.pdf', 'present')],
    async () => {
      call += 1
      if (call === 1) throw new Error('NETWORK_ERROR')
      return true
    },
  )

  assert.deepEqual(results, [
    { name: 'offline.pdf', status: 'unavailable' },
    { name: 'present.pdf', status: 'verified' },
  ])
  assert.deepEqual(summarizeCheckvanResults(results), {
    verified: 1,
    not_verified: 0,
    unavailable: 1,
  })
})

test('reset clears a completed single verification without reloading', () => {
  const completed = {
    files: [testFile()],
    isVerifying: false,
    results: [{ name: 'checkvan.pdf', status: 'verified' }],
    selectionError: '',
  }

  assert.deepEqual(
    checkvanVerificationReducer(completed, { type: 'reset' }),
    initialCheckvanVerificationState,
  )
})

test('reset clears a completed multi-document batch', () => {
  const completed = {
    files: [testFile({ name: 'one.pdf' }), testFile({ name: 'two.pdf' })],
    isVerifying: false,
    results: [
      { name: 'one.pdf', status: 'verified' },
      { name: 'two.pdf', status: 'not_verified' },
    ],
    selectionError: '',
  }

  assert.deepEqual(
    checkvanVerificationReducer(completed, { type: 'reset' }),
    initialCheckvanVerificationState,
  )
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

test('multi-file UI keeps file names local and enables reset without navigation', async () => {
  const page = await readFile(
    new URL('../src/pages/CheckVanVerificationPage.jsx', import.meta.url),
    'utf8',
  )

  assert.match(page, /multiple/)
  assert.match(page, /resetVerification/)
  assert.match(page, /dispatch\(\{ type: 'reset' \}\)/)
  assert.doesNotMatch(page, /window\.location|navigate\(|FormData|base64/i)
})
