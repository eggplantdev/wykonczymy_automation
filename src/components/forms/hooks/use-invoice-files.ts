import { useRef } from 'react'

import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'
import { BlockedFileError, processUploadFile } from '@/lib/utils/process-upload-file'

// Cap parallel ingest processing to match the scan (GENERATION_CONCURRENCY) and upload
// (UPLOAD_CONCURRENCY) paths: a batch pick (10-20+ files) each runs main-thread CompressorJS
// plus a possible ~1.3 MB HEIC WASM decode, so an unbounded Promise.all would freeze the UI.
const INGEST_CONCURRENCY = 4

// Files that couldn't enter the map (unconvertible HEIC / oversize) — surfaced to the caller so
// it can show a per-item Polish message. A blocked file leaves its row without a File.
export type IngestResultT = { blocked: BlockedFileError[] }

export function useInvoiceFiles(initialFiles?: Map<string, File>) {
  const invoiceFilesRef = useRef<Map<string, File>>(initialFiles ?? new Map())

  function handleRemoveLineItem(id: string, index: number, removeValue: (index: number) => void) {
    invoiceFilesRef.current.delete(id)
    removeValue(index)
  }

  // Process the picked file at ingest (HEIC-convert / compress / size-guard) and store the
  // processed File, so both consumers (scan + submit) read the already-processed bytes. A
  // blocked file is not stored (and any prior File on this row is cleared) and returned to the
  // caller for messaging.
  async function handleFileChange(
    id: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<IngestResultT> {
    const file = e.target.files?.[0]
    if (!file) {
      invoiceFilesRef.current.delete(id)
      return { blocked: [] }
    }
    try {
      invoiceFilesRef.current.set(id, await processUploadFile(file))
      return { blocked: [] }
    } catch (error) {
      if (!(error instanceof BlockedFileError)) throw error
      invoiceFilesRef.current.delete(id)
      return { blocked: [error] }
    }
  }

  // Register N batch-picked receipts against N row ids in one call — each becomes that row's
  // invoice, paired to its row by stable id (never a positional shift, so a blocked file can't
  // misalign later rows). `ids[i]` is the row for `files[i]`; successes are stored, blocked files
  // are collected and returned so one bad file in a batch never discards the others.
  async function registerFilesAt(ids: string[], files: File[]): Promise<IngestResultT> {
    const blocked: BlockedFileError[] = []
    await mapWithConcurrency(files, INGEST_CONCURRENCY, async (file, offset) => {
      try {
        invoiceFilesRef.current.set(ids[offset], await processUploadFile(file))
      } catch (error) {
        if (!(error instanceof BlockedFileError)) throw error
        blocked.push(error)
      }
    })
    return { blocked }
  }

  function getFile(id: string): File | undefined {
    return invoiceFilesRef.current.get(id)
  }

  function getFiles(): Map<string, File> {
    return new Map(invoiceFilesRef.current)
  }

  // Swap a row's File for a same-bytes clone under a new name so the FV label can mirror the
  // Opis-based receipt rename. Display-only — the (single, submit-time) upload uses this renamed
  // File; the caller bumps fileInputKey to re-read the name.
  function renameFile(id: string, newName: string) {
    const existing = invoiceFilesRef.current.get(id)
    if (!existing) return
    invoiceFilesRef.current.set(id, new File([existing], newName, { type: existing.type }))
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
