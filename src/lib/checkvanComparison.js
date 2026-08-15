import { getDocument, OPS } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { GlobalWorkerOptions } from 'pdfjs-dist'
import { CHECKVAN_CATEGORIES, matchLabelsToImages, parseCheckvanMetadata, recognizeCategory, validatePdfFile } from './checkvanComparisonCore.js'

export { CHECKVAN_CATEGORIES, matchLabelsToImages, parseCheckvanMetadata, platesDiffer, recognizeCategory, releaseComparison, validatePdfFile } from './checkvanComparisonCore.js'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl


async function imageObject(page, name) {
  return new Promise((resolve) => page.objs.get(name, resolve))
}

async function imageToUrl(image, maxDimension = 1280) {
  const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * ratio))
  const height = Math.max(1, Math.round(image.height * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: false })
  if (image.bitmap) context.drawImage(image.bitmap, 0, 0, width, height)
  else {
    const source = document.createElement('canvas')
    source.width = image.width
    source.height = image.height
    source.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0)
    context.drawImage(source, 0, 0, width, height)
    source.width = source.height = 0
  }
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  canvas.width = canvas.height = 0
  image.bitmap?.close?.()
  if (!blob) throw new Error('image')
  return URL.createObjectURL(blob)
}

export async function readCheckvanPdf(file, onProgress = () => {}) {
  const validation = validatePdfFile(file)
  if (validation) throw new Error(validation)
  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const pdf = await loadingTask.promise
  const labels = []
  const images = []
  let fullText = ''
  try {
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
    const photos = {}
    for (const category of CHECKVAN_CATEGORIES) {
      const match = matches.get(category.id)
      if (match) photos[category.id] = await imageToUrl(await imageObject(match.pageRef, match.name))
    }
    return { metadata: parseCheckvanMetadata(fullText), photos, loadingTask }
  } catch (error) {
    await loadingTask.destroy()
    throw error
  }
}
