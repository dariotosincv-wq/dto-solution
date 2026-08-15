export const CHECKVAN_IMAGE_KIND = {
  RGB_24BPP: 2,
  RGBA_32BPP: 3,
}

const CHUNK_ROWS = 32

export function copyPixelsToRgba(source, kind, destination, pixelCount) {
  if (kind === CHECKVAN_IMAGE_KIND.RGBA_32BPP) {
    destination.set(source.subarray(0, pixelCount * 4))
    return
  }
  if (kind !== CHECKVAN_IMAGE_KIND.RGB_24BPP) {
    throw new Error(`Unsupported PDF image format: ${kind ?? 'unknown'}`)
  }
  for (let sourceIndex = 0, destinationIndex = 0; sourceIndex < pixelCount * 3; sourceIndex += 3) {
    destination[destinationIndex++] = source[sourceIndex]
    destination[destinationIndex++] = source[sourceIndex + 1]
    destination[destinationIndex++] = source[sourceIndex + 2]
    destination[destinationIndex++] = 255
  }
}

export async function imageToUrl(image, maxDimension = 1280) {
  if (!image?.width || !image?.height) throw new Error('Invalid PDF image dimensions')
  const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * ratio))
  const height = Math.max(1, Math.round(image.height * ratio))
  const preview = document.createElement('canvas')
  preview.width = width
  preview.height = height
  const previewContext = preview.getContext('2d', { alpha: false })
  let chunk = null
  try {
    if (image.bitmap) {
      previewContext.drawImage(image.bitmap, 0, 0, width, height)
    } else {
      if (!image.data) throw new Error('PDF image has no bitmap or pixel data')
      if (![CHECKVAN_IMAGE_KIND.RGB_24BPP, CHECKVAN_IMAGE_KIND.RGBA_32BPP].includes(image.kind)) {
        throw new Error(`Unsupported PDF image format: ${image.kind ?? 'unknown'}`)
      }
      chunk = document.createElement('canvas')
      chunk.width = image.width
      const chunkContext = chunk.getContext('2d', { alpha: false })
      const channels = image.kind === CHECKVAN_IMAGE_KIND.RGB_24BPP ? 3 : 4
      for (let sourceRow = 0; sourceRow < image.height; sourceRow += CHUNK_ROWS) {
        const rows = Math.min(CHUNK_ROWS, image.height - sourceRow)
        chunk.height = rows
        const imageData = chunkContext.createImageData(image.width, rows)
        const pixelCount = image.width * rows
        const sourceOffset = sourceRow * image.width * channels
        copyPixelsToRgba(image.data.subarray(sourceOffset), image.kind, imageData.data, pixelCount)
        chunkContext.putImageData(imageData, 0, 0)
        previewContext.drawImage(chunk, 0, 0, image.width, rows, 0, sourceRow * ratio, width, rows * ratio)
      }
    }
    const blob = await new Promise((resolve) => preview.toBlob(resolve, 'image/jpeg', 0.88))
    if (!blob) throw new Error('Unable to create image preview')
    return URL.createObjectURL(blob)
  } finally {
    if (chunk) chunk.width = chunk.height = 0
    preview.width = preview.height = 0
  }
}
