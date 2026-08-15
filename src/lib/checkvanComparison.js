import { getDocument, OPS } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { GlobalWorkerOptions } from 'pdfjs-dist'
import { CHECKVAN_CATEGORIES, matchLabelsToImages, parseCheckvanMetadata, recognizeCategory, validatePdfFile } from './checkvanComparisonCore.js'
import { imageToUrl } from './checkvanImagePreview.js'

export { CHECKVAN_CATEGORIES, matchLabelsToImages, parseCheckvanMetadata, platesDiffer, recognizeCategory, releaseComparison, validatePdfFile } from './checkvanComparisonCore.js'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl


async function imageObject(page, name) {
  return new Promise((resolve) => page.objs.get(name, resolve))
}

export async function readCheckvanPdf(file, onProgress = () => {}) {
  const validation = validatePdfFile(file)
  if (validation) throw new Error(validation)
  let loadingTask
  const labels = []
  const images = []
  const photos = {}
  let fullText = ''
  try {
    const data = new Uint8Array(await file.arrayBuffer())
    loadingTask = getDocument({ data })
    const pdf = await loadingTask.promise
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()
      fullText += ` ${textContent.items.map((item) => item.str).join(' | ')}`
      for (const item of textContent.items) {
        const category = recognizeCategory(item.str)
        if (category) labels.push({ category, page: pageNumber, x: item.transform[4], y: item.transform[5] })
      }
      const operators = await page.getOperatorList()
      let transform = null
      for (let index = 0; index < operators.fnArray.length; index += 1) {
        if (operators.fnArray[index] === OPS.transform) transform = operators.argsArray[index]
        if (operators.fnArray[index] === OPS.paintImageXObject && transform) {
          images.push({ page: pageNumber, name: operators.argsArray[index][0], x: transform[4], y: transform[5], width: Math.abs(transform[0]), height: Math.abs(transform[3]), pageRef: page })
        }
      }
      onProgress(pageNumber, pdf.numPages)
    }
    if (!/CHECK\s*VAN/i.test(fullText)) throw new Error('not-checkvan')
    const matches = matchLabelsToImages(labels, images)
    if (!matches.size) throw new Error('no-categories')
    for (const category of CHECKVAN_CATEGORIES) {
      const match = matches.get(category.id)
      if (match) {
        const image = await imageObject(match.pageRef, match.name)
        photos[category.id] = await imageToUrl(image)
      }
    }
    return { metadata: parseCheckvanMetadata(fullText), photos, loadingTask }
  } catch (error) {
    Object.values(photos).forEach((url) => URL.revokeObjectURL(url))
    await loadingTask?.destroy?.()
    throw error
  }
}
