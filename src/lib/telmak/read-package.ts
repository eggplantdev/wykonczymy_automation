import { parseTelmak, unreadableDoc } from '@/lib/telmak/parse-telmak'
import type { TelmakPackageFileT } from '@/lib/telmak/check-row'

type PdfjsT = typeof import('pdfjs-dist')
type PdfWorkerT = InstanceType<PdfjsT['PDFWorker']>

// Browser-only: pdfjs touches DOM globals on import, so it is loaded on demand, never at module scope.
async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  return pdfjs
}

// Cells on one line are joined with ' | ' — the parser locates a value as the cell after its label.
async function pdfLines(pdfjs: PdfjsT, worker: PdfWorkerT, file: File): Promise<string[]> {
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    worker,
    verbosity: 0,
  })
  const lines: string[] = []
  try {
    const doc = await task.promise
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

// One worker for the whole package: pdfjs spawns (and compiles) a fresh one per document otherwise.
export async function readTelmakPackage(files: File[]): Promise<TelmakPackageFileT[]> {
  const pdfjs = await loadPdfjs()
  const worker = new pdfjs.PDFWorker()
  const out: TelmakPackageFileT[] = []
  try {
    for (const file of files) {
      let doc
      try {
        doc = parseTelmak(await pdfLines(pdfjs, worker, file), file.name)
      } catch {
        doc = unreadableDoc(file.name, 'nie da się otworzyć PDF-a')
      }
      const preview = {
        url: URL.createObjectURL(file),
        filename: file.name,
        mimeType: 'application/pdf',
      }
      out.push({ doc, file, preview })
    }
  } finally {
    worker.destroy()
  }
  return out
}
