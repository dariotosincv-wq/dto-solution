export function nacScanDocumentStateKey(pages) {
  return JSON.stringify(pages.map(({ id, kind, name, mime, pageNumber, rotation, annotations = [] }) => ({ id, kind, name, mime, pageNumber, rotation, annotations })))
}

export function hasNacScanUnsavedChanges(pages, savedStateKey) {
  return pages.length > 0 && nacScanDocumentStateKey(pages) !== savedStateKey
}
