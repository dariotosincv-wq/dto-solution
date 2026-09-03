const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim()

export async function searchNacScanPages(pages, query, getDocument) {
  const needle = normalize(query)
  if (!needle) return { searchable: false, results: [] }
  const results = []
  let searchable = false
  for (let index = 0; index < pages.length; index += 1) {
    const entry = pages[index]
    if (entry.kind !== 'pdf') continue
    const task = getDocument({ data: entry.bytes.slice() })
    try {
      const pdf = await task.promise
      const page = await pdf.getPage(entry.pageNumber)
      const viewport = page.getViewport({ scale: 1, rotation: 0 })
      const content = await page.getTextContent()
      const items = content.items.filter((item) => item.str?.trim())
      if (items.length) searchable = true
      const resultCountBeforePage = results.length
      for (const item of items) {
        const text = normalize(item.str)
        let from = 0
        while ((from = text.indexOf(needle, from)) >= 0) {
          results.push({ pageId: entry.id, pageIndex: index, x: item.transform[4] / viewport.width, y: 1 - item.transform[5] / viewport.height, width: Math.max(item.width / viewport.width, .02), height: Math.max(Math.abs(item.height || item.transform[3]) / viewport.height, .015) })
          from += Math.max(needle.length, 1)
        }
      }
      const pageText = normalize(items.map((item) => item.str).join(' '))
      if (results.length === resultCountBeforePage && pageText.includes(needle) && items[0]) {
        const item = items[0]
        results.push({ pageId: entry.id, pageIndex: index, x: item.transform[4] / viewport.width, y: 1 - item.transform[5] / viewport.height, width: Math.max(item.width / viewport.width, .02), height: Math.max(Math.abs(item.height || item.transform[3]) / viewport.height, .015) })
      }
      await pdf.destroy()
    } finally { await task.destroy() }
  }
  return { searchable, results }
}
