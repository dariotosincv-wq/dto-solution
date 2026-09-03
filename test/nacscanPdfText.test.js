import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument } from 'pdf-lib'
import { drawNacScanText, embedNacScanTextFonts } from '../src/lib/nacscanPdfText.js'

test('exports normal, bold, italic, bold italic and underlined text to a valid PDF', async () => {
  const document = await PDFDocument.create()
  const page = document.addPage([600, 800])
  const fonts = await embedNacScanTextFonts(document)
  const styles = [
    {},
    { fontWeight: 'bold' },
    { fontStyle: 'italic' },
    { fontWeight: 'bold', fontStyle: 'italic' },
    { textDecoration: 'underline' },
  ]

  styles.forEach((style, index) => drawNacScanText(page, { type: 'text', text: `Stile ${index}`, x: .1, y: .1 + index * .1, fontSize: 18, color: 'black', ...style }, fonts))
  const bytes = await document.save()
  const reopened = await PDFDocument.load(bytes)
  assert.equal(reopened.getPageCount(), 1)
  assert.ok(bytes.length > 500)
})
