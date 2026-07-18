import { useRef, useState } from 'react'

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
  // Reactive so attach/rename/remove re-render the FV label in place (no remount key). A mirror
  // ref, synced every render, backs the reads: getFiles()/getFile() run inside async paths (submit,
  // scan) after awaits, where the `files` closure would be stale — the ref always holds the latest
  // committed map. Writes go through functional setFiles so concurrent batch-ingest tasks compose.
  const [files, setFiles] = useState<Map<string, File>>(initialFiles ?? new Map())
  // Latest-value mirror: getFiles()/getFile() are read inside async paths (submit, scan) whose
  // closure — held by the TanStack form's onSubmit — can lag behind the current render. Mirroring
  // state into the ref each render keeps those reads current without an effect (which would lag by
  // a render). Read-only of `.current`; the value tracks `files` exactly, so this is safe.
  const filesRef = useRef(files)
  // eslint-disable-next-line react-hooks/refs -- intentional latest-value mirror, see above
  filesRef.current = files

  function handleRemoveLineItem(id: string, index: number, removeValue: (index: number) => void) {
    setFiles((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
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
      setFiles((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
      return { blocked: [] }
    }
    try {
      const processed = await processUploadFile(file)
      setFiles((prev) => new Map(prev).set(id, processed))
      return { blocked: [] }
    } catch (error) {
      if (!(error instanceof BlockedFileError)) throw error
      setFiles((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
      return { blocked: [error] }
    }
  }

  // Register N batch-picked receipts against N row ids in one call — each becomes that row's
  // invoice, paired to its row by stable id (never a positional shift, so a blocked file can't
  // misalign later rows). `ids[i]` is the row for `picked[i]`; successes are stored via functional
  // updates (concurrent tasks compose), blocked files are collected and returned so one bad file
  // in a batch never discards the others.
  async function registerFilesAt(ids: string[], picked: File[]): Promise<IngestResultT> {
    const blocked: BlockedFileError[] = []
    await mapWithConcurrency(picked, INGEST_CONCURRENCY, async (file, offset) => {
      try {
        const processed = await processUploadFile(file)
        setFiles((prev) => new Map(prev).set(ids[offset], processed))
      } catch (error) {
        if (!(error instanceof BlockedFileError)) throw error
        blocked.push(error)
      }
    })
    return { blocked }
  }

  function getFile(id: string): File | undefined {
    return filesRef.current.get(id)
  }

  function getFiles(): Map<string, File> {
    return new Map(filesRef.current)
  }

  // Swap a row's File for a same-bytes clone under a new name so the FV label can mirror the
  // Opis-based receipt rename. The reactive store re-renders the label in place.
  function renameFile(id: string, newName: string) {
    setFiles((prev) => {
      const existing = prev.get(id)
      if (!existing) return prev
      return new Map(prev).set(id, new File([existing], newName, { type: existing.type }))
    })
  }

  function reset() {
    setFiles(new Map())
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
