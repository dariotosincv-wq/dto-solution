import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { parseConvocationDefinitiveItems } from './convocationDefinitiveCore.js'

export { normalizeConvocationDriverName, parseConvocationDefinitiveItems, parseItalianVehicleReference } from './convocationDefinitiveCore.js'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export async function readConvocationDefinitivePdf(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || file.type && file.type !== 'application/pdf') throw new Error('INVALID_CONVOCATION_PDF')
  let loadingTask
  let pdf
  try {
    const data = new Uint8Array(await file.arrayBuffer())
    loadingTask = getDocument({ data })
    pdf = await loadingTask.promise
    const items = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })
      const textContent = await page.getTextContent()
      for (const item of textContent.items) if (typeof item.str === 'string' && item.str.trim()) items.push({ page: pageNumber, x: item.transform[4], y: item.transform[5], page_width: viewport.width, text: item.str })
    }
    return parseConvocationDefinitiveItems(items)
  } finally {
    await pdf?.destroy?.()
    await loadingTask?.destroy?.()
  }
}
