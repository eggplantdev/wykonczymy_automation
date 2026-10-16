import { useRef, useState } from 'react'

import { ingestFiles } from '@/lib/media/ingest-files'
import type { BlockedFileError } from '@/lib/utils/process-upload-file'
import { renamePages } from '@/lib/utils/receipt-filename'

export type IngestResultT = { blocked: BlockedFileError[] }

export function useInvoiceFiles(initialFiles?: Map<string, File[]>) {
  // getFiles()/getRowFiles() run inside async paths (submit, and scan → generate in the SAME turn as
  // the just-registered files) where a render hasn't committed yet, so a render-synced mirror would
  // be stale.
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

  async function handleFileChange(
    id: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<IngestResultT> {
    const picked = [...(e.target.files ?? [])]
    // with the value still set the browser fires no change event and the pick is silently lost.
    e.target.value = ''
    if (picked.length === 0) return { blocked: [] }
    return registerFilesAt([id], picked, 'single-row')
  }

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

  // One commit, so a merge or split never renders a row between losing its files and gaining them.
  function replaceRows(removeIds: string[], add: [id: string, files: File[]][]) {
    commit((prev) => {
      const next = new Map(prev)
      removeIds.forEach((id) => next.delete(id))
      add.forEach(([id, rowFiles]) => {
        if (rowFiles.length > 0) next.set(id, rowFiles)
      })
      return next
    })
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

  function renameFile(id: string, newName: string) {
    commit((prev) => {
      const existing = prev.get(id)
      if (!existing) return prev
      return new Map(prev).set(id, renamePages(existing, newName))
    })
  }

  function reset() {
    commit(() => new Map())
  }

  return {
    handleRemoveLineItem,
    handleFileChange,
    registerFilesAt,
    replaceRows,
    removeFileAt,
    getRowFiles,
    getFiles,
    renameFile,
    reset,
  }
}
