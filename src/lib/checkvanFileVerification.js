export const MAX_CHECKVAN_PDF_BYTES = 25 * 1024 * 1024
export const MAX_CHECKVAN_BATCH_FILES = 10

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

export function validateCheckvanBatch(files) {
  if (files.length > MAX_CHECKVAN_BATCH_FILES) {
    return { code: 'batch_size', file: null }
  }

  for (const file of files) {
    const code = validateCheckvanPdf(file)
    if (code) return { code, file }
  }

  return null
}

export async function verifyCheckvanFiles(files, verifyHash) {
  const results = []

  for (const file of files) {
    try {
      const sha256 = await calculateSha256(file)
      const verified = await verifyHash(sha256)
      results.push({ name: file.name, status: verified ? 'verified' : 'not_verified' })
    } catch {
      results.push({ name: file.name, status: 'unavailable' })
    }
  }

  return results
}

export function summarizeCheckvanResults(results) {
  return results.reduce((summary, result) => ({
    ...summary,
    [result.status]: summary[result.status] + 1,
  }), {
    verified: 0,
    not_verified: 0,
    unavailable: 0,
  })
}

export const initialCheckvanVerificationState = Object.freeze({
  files: [],
  isVerifying: false,
  results: [],
  selectionError: '',
})

export function checkvanVerificationReducer(state, action) {
  switch (action.type) {
    case 'select':
      return { ...initialCheckvanVerificationState, files: action.files }
    case 'reject':
      return { ...initialCheckvanVerificationState, selectionError: action.message }
    case 'start':
      return { ...state, isVerifying: true, results: [], selectionError: '' }
    case 'complete':
      return { ...state, isVerifying: false, results: action.results }
    case 'reset':
      return { ...initialCheckvanVerificationState }
    default:
      return state
  }
}
