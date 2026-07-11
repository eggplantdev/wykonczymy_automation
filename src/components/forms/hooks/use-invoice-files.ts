import { useRef } from 'react'

// Pure index-keyed map algebra for the positional add-expense contract (lineItems[i] ↔
// file[i]). Exported standalone so they're unit-testable without a React renderer.
// Generic over the value so the Phase-4 mediaId map (Map<number, number>) reuses reindex.
export function reindexAfterRemoval<V>(map: Map<number, V>, removedIndex: number): Map<number, V> {
  const next = new Map<number, V>()
  map.forEach((value, i) => {
    if (i < removedIndex) next.set(i, value)
    else if (i > removedIndex) next.set(i - 1, value)
  })
  return next
}

export function setFilesAt(map: Map<number, File>, startIndex: number, files: File[]): void {
  files.forEach((file, offset) => map.set(startIndex + offset, file))
}

export function useInvoiceFiles(initialFiles?: Map<number, File>) {
  const invoiceFilesRef = useRef<Map<number, File>>(initialFiles ?? new Map())

  function handleRemoveLineItem(index: number, removeValue: (index: number) => void) {
    invoiceFilesRef.current = reindexAfterRemoval(invoiceFilesRef.current, index)
    removeValue(index)
  }

  function handleFileChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) invoiceFilesRef.current.set(index, file)
    else invoiceFilesRef.current.delete(index)
  }

  // Register N batch-picked receipts at N consecutive indices in one call — the file
  // becomes that row's invoice via the same positional submit path as a per-row pick.
  function registerFilesAt(startIndex: number, files: File[]) {
    setFilesAt(invoiceFilesRef.current, startIndex, files)
  }

  function getFileName(index: number): string | undefined {
    return invoiceFilesRef.current.get(index)?.name
  }

  function getFiles(): Map<number, File> {
    return new Map(invoiceFilesRef.current)
  }

  function reset() {
    invoiceFilesRef.current = new Map()
  }

  return { handleRemoveLineItem, handleFileChange, registerFilesAt, getFileName, getFiles, reset }
}
