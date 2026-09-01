import { PDFDocument } from 'pdf-lib'

export async function inspectNacScanPdf(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    throw new TypeError('PDF data must be a non-empty Uint8Array')
  }

  const document = await PDFDocument.load(bytes, { updateMetadata: false })
  const pageCount = document.getPageCount()
  if (pageCount < 1) throw new Error('PDF contains no pages')
  return { pageCount }
}
