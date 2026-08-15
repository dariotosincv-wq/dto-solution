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
  let phase = 'file-validation'
  let diagnostic = {}
  const validation = validatePdfFile(file)
  if (validation) throw new Error(validation)
  let loadingTask
  const labels = []
  const images = []
  const photos = {}
  let fullText = ''
  const report = (details) => {
    phase = details.phase
    diagnostic = { ...diagnostic, ...details }
    console.info('[checkvan-comparison]', diagnostic)
  }
  try {
    phase = 'file-array-buffer'
    report({ phase })
    const data = new Uint8Array(await file.arrayBuffer())
    phase = 'pdf-open'
    report({ phase, bufferLength: data.length })
    loadingTask = getDocument({ data })
    const pdf = await loadingTask.promise
    report({ phase: 'pdf-open-complete', pageCount: pdf.numPages })
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      phase = 'page-read'
      diagnostic = { pageNumber }
      report({ phase, page: pageNumber })
      const page = await pdf.getPage(pageNumber)
      phase = 'text-read'
      const textContent = await page.getTextContent()
      fullText += ` ${textContent.items.map((item) => item.str).join(' | ')}`
      for (const item of textContent.items) {
        const category = recognizeCategory(item.str)
        if (category) labels.push({ category, page: pageNumber, x: item.transform[4], y: item.transform[5] })
      }
      phase = 'image-object-discovery'
      const operators = await page.getOperatorList()
      let transform = null
      for (let index = 0; index < operators.fnArray.length; index += 1) {
        if (operators.fnArray[index] === OPS.transform) transform = operators.argsArray[index]
        if (operators.fnArray[index] === OPS.paintImageXObject && transform) {
          images.push({ page: pageNumber, name: operators.argsArray[index][0], x: transform[4], y: transform[5], width: Math.abs(transform[0]), height: Math.abs(transform[3]), pageRef: page })
        }
      }
      report({ phase: 'page-discovery-complete', page: pageNumber })
      onProgress(pageNumber, pdf.numPages)
    }
    if (!/CHECK\s*VAN/i.test(fullText)) throw new Error('not-checkvan')
    const matches = matchLabelsToImages(labels, images)
    if (!matches.size) throw new Error('no-categories')
    for (const category of CHECKVAN_CATEGORIES) {
      const match = matches.get(category.id)
      if (match) {
        diagnostic = { category: category.id, page: match.page, objectId: match.name }
        report({ phase: 'image-object-resolve', ...diagnostic })
        const image = await imageObject(match.pageRef, match.name)
        report({ phase: 'image-object-resolved', ...diagnostic, imageKind: image?.kind ?? null, width: image?.width ?? null, height: image?.height ?? null, bufferLength: image?.data?.length ?? null, hasBitmap: Boolean(image?.bitmap) })
        photos[category.id] = await imageToUrl(image, 1280, (details) => report({ ...diagnostic, ...details }))
      }
    }
    report({ phase: 'comparison-ready', previewCount: Object.keys(photos).length })
    return { metadata: parseCheckvanMetadata(fullText), photos, loadingTask }
  } catch (error) {
    console.error('[checkvan-comparison]', { phase, category: diagnostic.category ?? null, page: diagnostic.page ?? null, objectId: diagnostic.objectId ?? null, imageKind: diagnostic.imageKind ?? null, width: diagnostic.width ?? null, height: diagnostic.height ?? null, error, stack: error?.stack })
    console.info('[checkvan-comparison]', { phase: 'document-cleanup-start', previewCount: Object.keys(photos).length })
    Object.values(photos).forEach((url) => URL.revokeObjectURL(url))
    await loadingTask?.destroy?.()
    console.info('[checkvan-comparison]', { phase: 'document-cleanup-complete' })
    throw error
  }
}
