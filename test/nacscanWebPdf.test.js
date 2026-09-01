import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { inspectNacScanPdf } from '../src/lib/nacscanPdf.js'

async function makePdf({ pages = 1, text = false, scanned = false } = {}) {
  const pdf = await PDFDocument.create()
  const font = text ? await pdf.embedFont(StandardFonts.Helvetica) : null
  const pixel = scanned
    ? await pdf.embedPng('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X2NDNwAAAABJRU5ErkJggg==')
    : null

  for (let index = 0; index < pages; index += 1) {
    const page = pdf.addPage([595, 842])
    if (font) page.drawText(`Documento pagina ${index + 1}`, { x: 50, y: 780, size: 18, font, color: rgb(0, 0, 0) })
    if (pixel) page.drawImage(pixel, { x: 0, y: 0, width: 595, height: 842 })
  }
  return pdf.save()
}

test('imports a normal one-page PDF', async () => {
  assert.deepEqual(await inspectNacScanPdf(await makePdf()), { pageCount: 1 })
})

test('imports a multi-page PDF with text', async () => {
  assert.deepEqual(await inspectNacScanPdf(await makePdf({ pages: 4, text: true })), { pageCount: 4 })
})

test('imports an image-only scanned PDF', async () => {
  assert.deepEqual(await inspectNacScanPdf(await makePdf({ scanned: true })), { pageCount: 1 })
})

test('File API and a filename with spaces preserve valid PDF bytes', async () => {
  const file = new File([await makePdf({ pages: 2, text: true })], 'documento prova con spazi.pdf', { type: 'application/pdf' })
  const bytes = new Uint8Array(await file.arrayBuffer())
  assert.equal(file.name, 'documento prova con spazi.pdf')
  assert.deepEqual(await inspectNacScanPdf(bytes), { pageCount: 2 })
})
