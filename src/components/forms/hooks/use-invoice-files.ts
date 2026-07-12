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
  // Upload-once: an image the receipt-generation flow already uploaded stores its mediaId here,
  // keyed by the same row index as the File map, so submit doesn't re-upload it.
  const mediaIdsRef = useRef<Map<number, number>>(new Map())

  function handleRemoveLineItem(index: number, removeValue: (index: number) => void) {
    invoiceFilesRef.current = reindexAfterRemoval(invoiceFilesRef.current, index)
    mediaIdsRef.current = reindexAfterRemoval(mediaIdsRef.current, index)
    removeValue(index)
  }

  function handleFileChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // A new File at this row invalidates any previously uploaded mediaId for it.
    mediaIdsRef.current.delete(index)
    if (file) invoiceFilesRef.current.set(index, file)
    else invoiceFilesRef.current.delete(index)
  }

  // Register N batch-picked receipts at N consecutive indices in one call — the file
  // becomes that row's invoice via the same positional submit path as a per-row pick.
  function registerFilesAt(startIndex: number, files: File[]) {
    setFilesAt(invoiceFilesRef.current, startIndex, files)
    files.forEach((_, offset) => mediaIdsRef.current.delete(startIndex + offset))
  }

  function getFile(index: number): File | undefined {
    return invoiceFilesRef.current.get(index)
  }

  function getFiles(): Map<number, File> {
    return new Map(invoiceFilesRef.current)
  }

  function getMediaId(index: number): number | undefined {
    return mediaIdsRef.current.get(index)
  }

  function setMediaId(index: number, mediaId: number) {
    mediaIdsRef.current.set(index, mediaId)
  }

  // Swap a row's File for a same-bytes clone under a new name so the FV label can mirror the
  // Opis-based receipt rename. Display-only — the (single, submit-time) upload uses this renamed
  // File; the caller bumps fileInputKey to re-read the name.
  function renameFile(index: number, newName: string) {
    const existing = invoiceFilesRef.current.get(index)
    if (!existing) return
    invoiceFilesRef.current.set(index, new File([existing], newName, { type: existing.type }))
  }

  function getMediaIds(): Map<number, number> {
    return new Map(mediaIdsRef.current)
  }

  function reset() {
    invoiceFilesRef.current = new Map()
    mediaIdsRef.current = new Map()
  }

  return {
    handleRemoveLineItem,
    handleFileChange,
    registerFilesAt,
    getFile,
    getFiles,
    getMediaId,
    setMediaId,
    renameFile,
    getMediaIds,
    reset,
  }
}
