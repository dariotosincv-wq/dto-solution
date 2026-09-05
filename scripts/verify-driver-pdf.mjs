import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import assert from 'node:assert/strict'

const output = resolve(import.meta.dirname, '../artifacts/driver')
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const context = await browser.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome' })
  const page = await context.newPage()
  const requests = []
  page.on('request', request => requests.push(request.url()))
  await page.goto('http://127.0.0.1:5173/test/driver-browser/fixture.html')
  await page.waitForFunction(() => typeof window.runPdfParity === 'function')
  const results = await page.evaluate(() => window.runPdfParity())
  const errors = await page.evaluate(() => window.runPdfErrors())
  assert.deepEqual(errors.map(result => result.code), ['FILE_EMPTY', 'FILE_NOT_PDF', 'PDF_SCANNED_DOCUMENT', 'PDF_INVALID'])
  assert(errors.every(result => result.status === 'failed'))
  const reports = results.map(({ bytes, ...result }) => {
    writeFileSync(resolve(output, result.name + '.pdf'), Buffer.from(bytes))
    const equal = isDeepStrictEqual(result.expected, result.actual)
    return { ...result, fixtureToRealPdfEquivalent: equal }
  })
  writeFileSync(resolve(output, 'pdf-parity.json'), JSON.stringify({ source: 'Synthetic PDFs generated from the four unchanged original anonymized fixtures; not original personal payslip PDFs.', requests, errors, reports }, null, 2))
  assert(requests.every(url => url.startsWith('http://127.0.0.1:5173/') || url.startsWith('blob:')), 'External request during local PDF import')
  for (const report of reports) {
    assert.notEqual(report.imported.status, 'failed', report.name)
    assert.equal(report.imported.pipeline, 'PRODUCTION')
    const storage = JSON.stringify(report.stored)
    for (const key of ['rawTextTemporary','rawLine','sourceGeometry','temporaryReadDiagnostic']) assert(!storage.includes(`"${key}"`), `Temporary data persisted: ${key}`)
  }
  console.log(JSON.stringify(reports.map(r => ({ name: r.name, pages: r.extractedPages, equal: r.fixtureToRealPdfEquivalent, status: r.imported.status, summary: r.actual.parser.summary, confidence: r.actual.parser.confidence }))))
  if (reports.some(r => !r.fixtureToRealPdfEquivalent)) process.exitCode = 1
} finally { await browser.close() }
