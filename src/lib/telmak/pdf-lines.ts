// Browser-only: pdfjs touches DOM globals on import, so it is loaded on demand, never at module scope.
async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  return pdfjs
}

// Rebuild visual lines: group text items by their baseline y, order each line by x. Cells on one
// line are joined with ' | ' — the parser locates a value as the cell after its label.
export async function pdfLines(file: File): Promise<string[]> {
  const pdfjs = await loadPdfjs()
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), verbosity: 0 })
  const doc = await task.promise
  const lines: string[] = []
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const { items } = await page.getTextContent()
      const rows = new Map<number, { x: number; s: string }[]>()
      for (const it of items) {
        if (!('str' in it) || !it.str.trim()) continue
        const y = Math.round(it.transform[5])
        const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y
        if (!rows.has(key)) rows.set(key, [])
        rows.get(key)!.push({ x: it.transform[4], s: it.str })
      }
      for (const y of [...rows.keys()].sort((a, b) => b - a)) {
        lines.push(
          rows
            .get(y)!
            .sort((a, b) => a.x - b.x)
            .map((i) => i.s.trim())
            .join(' | '),
        )
      }
    }
  } finally {
    await task.destroy()
  }
  return lines
}
