export function normalizeDocumentText(value) {
  return String(value).toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function documentLineText(line) {
  return typeof line === 'string' ? line : line.text
}

export function searchDocumentPages(pages, query) {
  const target = normalizeDocumentText(query.trim())
  if (!target) return []
  return pages.filter((page) => page.lines.some((line) => normalizeDocumentText(documentLineText(line)).includes(target)))
}
