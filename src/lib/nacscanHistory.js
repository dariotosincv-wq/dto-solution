const clonePage = (page) => ({ ...page, annotations: page.annotations?.map((annotation) => ({ ...annotation })) })

// PDF bytes and object URLs stay shared: history only copies the editable document structure.
export function createDocumentSnapshot(pages, selectedId) {
  return { pages: pages.map(clonePage), selectedId }
}

export const createNacScanHistory = () => ({ past: [], future: [] })

export function recordNacScanHistory(history, snapshot, limit = 30) {
  return { past: [...history.past, snapshot].slice(-limit), future: [] }
}

export function undoNacScanHistory(history, current) {
  const snapshot = history.past.at(-1)
  if (!snapshot) return null
  return { snapshot, history: { past: history.past.slice(0, -1), future: [current, ...history.future] } }
}

export function redoNacScanHistory(history, current) {
  const [snapshot, ...future] = history.future
  if (!snapshot) return null
  return { snapshot, history: { past: [...history.past, current], future } }
}
