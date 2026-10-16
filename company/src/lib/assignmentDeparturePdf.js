import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { parseAssignmentDepartureItems } from './assignmentDepartureCore.js'

export { parseAssignmentDepartureItems } from './assignmentDepartureCore.js'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export async function readAssignmentDeparturePdf(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || (file.type && file.type !== 'application/pdf')) throw new Error('È richiesto un PDF locale.')
  let loadingTask
  try {
    const data = new Uint8Array(await file.arrayBuffer())
    loadingTask = getDocument({ data })
    const pdf = await loadingTask.promise, items = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber), viewport = page.getViewport({ scale: 1 }), textContent = await page.getTextContent()
      for (const item of textContent.items) items.push({ page: pageNumber, x: item.transform[4], y: item.transform[5], page_width: viewport.width, text: item.str })
    }
    return parseAssignmentDepartureItems(items)
  } finally {
    await loadingTask?.destroy?.()
  }
}
