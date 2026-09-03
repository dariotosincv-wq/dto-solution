export const NACSCAN_SIGNATURES_KEY = 'nacscan.signatures'

export function loadNacScanSignatures(storage = localStorage) {
  try { return JSON.parse(storage.getItem(NACSCAN_SIGNATURES_KEY) || '[]').filter((item) => item?.id && item?.imageData) }
  catch { return [] }
}

export function saveNacScanSignatures(signatures, storage = localStorage) {
  storage.setItem(NACSCAN_SIGNATURES_KEY, JSON.stringify(signatures))
  return signatures
}

export function createNacScanSignature(imageData, signatures, name) {
  return { id: crypto.randomUUID(), name: name?.trim() || `Firma ${signatures.length + 1}`, imageData, createdAt: new Date().toISOString(), isDefault: signatures.length === 0 }
}

export function deleteNacScanSignature(signatures, id) {
  const next = signatures.filter((item) => item.id !== id)
  return next.length && !next.some((item) => item.isDefault) ? next.map((item, index) => ({ ...item, isDefault: index === 0 })) : next
}
