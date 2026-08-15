export const CHECKVAN_CATEGORIES = [
  ['front-full', 'Anteriore', 'Front'], ['front-left-half', 'Metà sinistra anteriore', 'Front left half'], ['front-right-half', 'Metà destra anteriore', 'Front right half'],
  ['left-full', 'Lato sinistro', 'Left side'], ['left-front-third', 'Lato sinistro anteriore', 'Front left side'], ['left-middle-third', 'Lato sinistro centrale', 'Middle left side'], ['left-rear-third', 'Lato sinistro posteriore', 'Rear left side'],
  ['rear-full', 'Posteriore', 'Rear'], ['rear-left-half', 'Metà sinistra posteriore', 'Rear left half'], ['rear-right-half', 'Metà destra posteriore', 'Rear right half'],
  ['right-full', 'Lato destro', 'Right side'], ['right-rear-third', 'Lato destro posteriore', 'Rear right side'], ['right-middle-third', 'Lato destro centrale', 'Middle right side'], ['right-front-third', 'Lato destro anteriore', 'Front right side'],
].map(([id, it, en]) => ({ id, it, en }))

const normalize = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
const categoryByLabel = new Map(CHECKVAN_CATEGORIES.map((category) => [normalize(category.it), category]))

export const recognizeCategory = (label) => categoryByLabel.get(normalize(label))?.id ?? null

export function parseCheckvanMetadata(text) {
  const read = (pattern) => text.match(pattern)?.[1]?.trim() || ''
  return { plate: read(/Targa:\s*([^|\n]+)/i), vehicle: read(/Veicolo:\s*([^|\n]+)/i), inspectionType: read(/Tipo di ispezione:\s*([^|\n]+)/i), date: read(/Data dell'ispezione:\s*([^|\n]+)/i), time: read(/Ora dell'ispezione:\s*([^|\n]+)/i) }
}

export const platesDiffer = (first, second) => Boolean(first && second && normalize(first) !== normalize(second))

export function matchLabelsToImages(labels, images) {
  const matches = new Map()
  for (const label of labels) {
    const candidates = images.filter((image) => image.page === label.page && image.y >= label.y && image.y - label.y < 90 && label.x >= image.x - 60 && label.x <= image.x + image.width + 20)
    const image = candidates.sort((a, b) => (a.y - label.y) - (b.y - label.y) || Math.abs(a.x - label.x) - Math.abs(b.x - label.x))[0]
    if (image) matches.set(label.category, image)
  }
  return matches
}

export function validatePdfFile(file) {
  if (!file || file.size === 0) return 'empty'
  if (file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf')) return 'type'
  return null
}

export async function releaseComparison(documents) {
  for (const document of documents.filter(Boolean)) {
    Object.values(document.photos ?? {}).forEach((url) => URL.revokeObjectURL(url))
    await document.loadingTask?.destroy?.()
  }
}
