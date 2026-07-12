import { useRef } from 'react'

// Pure index-keyed map algebra for the positional add-expense contract (lineItems[i] ↔
// file[i]). Exported standalone so they're unit-testable without a React renderer.
// Generic over the value so the receipt-generation failed/in-flight index sets (wrapped as
// maps) reuse the same shift.
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

  function getFile(index: number): File | undefined {
    return invoiceFilesRef.current.get(index)
  }

  function getFiles(): Map<number, File> {
    return new Map(invoiceFilesRef.current)
  }

  // Swap a row's File for a same-bytes clone under a new name so the FV label can mirror the
  // Opis-based receipt rename. Display-only — the (single, submit-time) upload uses this renamed
  // File; the caller bumps fileInputKey to re-read the name.
  function renameFile(index: number, newName: string) {
    const existing = invoiceFilesRef.current.get(index)
    if (!existing) return
    invoiceFilesRef.current.set(index, new File([existing], newName, { type: existing.type }))
  }

  function reset() {
    invoiceFilesRef.current = new Map()
  }

  return {
    handleRemoveLineItem,
    handleFileChange,
    registerFilesAt,
    getFile,
    getFiles,
    renameFile,
    reset,
  }
}
