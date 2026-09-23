import { useRef, useState } from 'react'

import { ingestFiles } from '@/lib/media/ingest-files'
import type { BlockedFileError } from '@/lib/utils/process-upload-file'
import { splitExtension } from '@/lib/utils/append-short-id'

// Files that couldn't enter the map (unconvertible HEIC / oversize) — surfaced to the caller so
// it can show a per-item Polish message. A blocked file leaves its row without a File.
export type IngestResultT = { blocked: BlockedFileError[] }

export function useInvoiceFiles(initialFiles?: Map<string, File[]>) {
  // Reactive `files` re-renders the FV label in place (no remount key); `filesRef` is the
  // write-through source of truth the reads use. getFiles()/getRowFiles() run inside async paths
  // (submit, and scan → generate in the SAME turn as the just-registered files) where a render
  // hasn't committed yet, so a render-synced mirror would be stale — commit() updates the ref
  // synchronously, ahead of React, so those reads always see the latest map. Every writer routes
  // through commit(), and because it's synchronous (no await) concurrent batch-ingest tasks
  // compose without losing writes.
  const [files, setFiles] = useState<Map<string, File[]>>(() => initialFiles ?? new Map())
  const filesRef = useRef(files)

  function commit(update: (prev: Map<string, File[]>) => Map<string, File[]>) {
    const next = update(filesRef.current)
    filesRef.current = next
    setFiles(next)
  }

  function deleteFile(id: string) {
    commit((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }

  function handleRemoveLineItem(id: string, index: number, removeValue: (index: number) => void) {
    deleteFile(id)
    removeValue(index)
  }

  // Every picked file is an extra page of this row's invoice, so a pick appends rather than
  // replaces — the row input is also the „dodaj stronę" control inside the preview.
  async function handleFileChange(
    id: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<IngestResultT> {
    const picked = [...(e.target.files ?? [])]
    // Clear the control now that the files are captured: this input is also the „dodaj stronę"
    // control, and removing a page then picking the same file again is an ordinary move — with the
    // value still set the browser fires no change event and the pick is silently lost.
    e.target.value = ''
    if (picked.length === 0) return { blocked: [] }
    return registerFilesAt([id], picked, 'single-row')
  }

  // Register N batch-picked receipts in one call: 'per-row' pairs `picked[i]` with `ids[i]` (one
  // expense per photo), 'single-row' appends all of them to `ids[0]` (one multi-page invoice).
  // Pairing is by stable row id, never a positional shift, so a blocked file can't misalign later
  // rows. Blocked files are collected and returned so one bad file in a batch never discards the
  // others.
  //
  // Processing runs concurrently but the store is written ONCE at the end, in pick order:
  // committing per completion would interleave pages of the same row in whatever order their
  // HEIC/compress work happened to finish, and page order is the invoice's reading order.
  async function registerFilesAt(
    ids: string[],
    picked: File[],
    mode: 'per-row' | 'single-row' = 'per-row',
  ): Promise<IngestResultT> {
    const { processed, blocked } = await ingestFiles(picked)

    commit((prev) => {
      const next = new Map(prev)
      processed.forEach((file, offset) => {
        if (!file) return
        const id = mode === 'single-row' ? ids[0] : ids[offset]
        next.set(id, [...(next.get(id) ?? []), file])
      })
      return next
    })
    return { blocked }
  }

  function removeFileAt(id: string, index: number) {
    commit((prev) => {
      const existing = prev.get(id)
      if (!existing) return prev
      const remaining = existing.filter((_, i) => i !== index)
      const next = new Map(prev)
      if (remaining.length === 0) next.delete(id)
      else next.set(id, remaining)
      return next
    })
  }

  function getRowFiles(id: string): File[] | undefined {
    return filesRef.current.get(id)
  }

  function getFiles(): Map<string, File[]> {
    return new Map(filesRef.current)
  }

  // Swap a row's pages for same-bytes clones under the Opis-based receipt name so the FV label can
  // mirror it. Page order is preserved and only page 1 carries the bare name — later pages get a
  // „-2", „-3" suffix, since one invoice's pages would otherwise all upload under one filename.
  function renameFile(id: string, newName: string) {
    commit((prev) => {
      const existing = prev.get(id)
      if (!existing) return prev
      const renamed = existing.map(
        (file, index) => new File([file], pageFilename(newName, index), { type: file.type }),
      )
      return new Map(prev).set(id, renamed)
    })
  }

  function reset() {
    commit(() => new Map())
  }

  return {
    handleRemoveLineItem,
    handleFileChange,
    registerFilesAt,
    removeFileAt,
    getRowFiles,
    getFiles,
    renameFile,
    reset,
  }
}

function pageFilename(name: string, index: number): string {
  if (index === 0) return name
  const { base, ext } = splitExtension(name)
  return `${base}-${index + 1}${ext}`
}
