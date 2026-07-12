import { useRef } from 'react'

import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'
import { BlockedFileError, processUploadFile } from '@/lib/utils/process-upload-file'

// Cap parallel ingest processing to match the scan (GENERATION_CONCURRENCY) and upload
// (UPLOAD_CONCURRENCY) paths: a batch pick (10-20+ files) each runs main-thread CompressorJS
// plus a possible ~1.3 MB HEIC WASM decode, so an unbounded Promise.all would freeze the UI.
const INGEST_CONCURRENCY = 4

// Files that couldn't enter the map (unconvertible HEIC / oversize) — surfaced to the caller so
// it can show a per-item Polish message. A blocked file leaves its row's position without a File.
export type IngestResultT = { blocked: BlockedFileError[] }

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

  // Process the picked file at ingest (HEIC-convert / compress / size-guard) and store the
  // processed File, so both consumers (scan + submit) read the already-processed bytes. A
  // blocked file is not stored (and any prior File at this row is cleared) and returned to the
  // caller for messaging.
  async function handleFileChange(
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<IngestResultT> {
    const file = e.target.files?.[0]
    if (!file) {
      invoiceFilesRef.current.delete(index)
      return { blocked: [] }
    }
    try {
      invoiceFilesRef.current.set(index, await processUploadFile(file))
      return { blocked: [] }
    } catch (error) {
      if (!(error instanceof BlockedFileError)) throw error
      invoiceFilesRef.current.delete(index)
      return { blocked: [error] }
    }
  }

  // Register N batch-picked receipts at N consecutive indices in one call — each becomes that
  // row's invoice via the same positional submit path as a per-row pick. Each file is processed
  // at its FIXED startIndex + offset position (never a reindex/shift on a blocked file — that
  // would misalign every later row's receipt); successes are stored, blocked files are collected
  // and returned so one bad file in a batch never discards the others.
  async function registerFilesAt(startIndex: number, files: File[]): Promise<IngestResultT> {
    const blocked: BlockedFileError[] = []
    await mapWithConcurrency(files, INGEST_CONCURRENCY, async (file, offset) => {
      try {
        invoiceFilesRef.current.set(startIndex + offset, await processUploadFile(file))
      } catch (error) {
        if (!(error instanceof BlockedFileError)) throw error
        blocked.push(error)
      }
    })
    return { blocked }
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
