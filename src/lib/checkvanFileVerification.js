export const MAX_CHECKVAN_PDF_BYTES = 25 * 1024 * 1024

export function validateCheckvanPdf(file) {
  if (!file) return 'missing'

  const hasPdfExtension = file.name.toLowerCase().endsWith('.pdf')
  const hasAcceptedMimeType = !file.type || file.type === 'application/pdf'

  if (!hasPdfExtension || !hasAcceptedMimeType) return 'type'
  if (file.size > MAX_CHECKVAN_PDF_BYTES) return 'size'
  if (file.size === 0) return 'empty'

  return null
}

export async function calculateSha256(file) {
  const bytes = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)

  return Array.from(new Uint8Array(digest), (byte) => (
    byte.toString(16).padStart(2, '0')
  )).join('')
}
