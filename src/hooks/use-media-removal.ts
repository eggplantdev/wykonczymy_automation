'use client'

import { useRef, useState } from 'react'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'

export type MediaRemovalLabelsT = {
  confirmOne: string
  confirmLast: string
  /** Omitted alongside `removeAll` — a surface without the affordance never asks the question. */
  confirmAll?: string
  /** Every removal reclaims the file from Blob, which has no undelete — say so under the question. */
  description: string
  /** Omitted where the surface already shows the file vanishing and a toast would just be noise. */
  success?: string
  error: string
}

type MediaRemovalArgsT<FileT extends { id?: number }> = {
  files: FileT[]
  removeOne: (fileId: number) => Promise<ActionResultT>
  /** Omitted by a surface that has no remove-all affordance, such as promoting a zgłoszenie. */
  removeAll?: () => Promise<ActionResultT>
  labels: MediaRemovalLabelsT
}

/** `fileId: undefined` is the remove-all intent. */
type StagedRemovalT = { title: string; fileId?: number; closePreview: () => void }

/**
 * The optimistic set is what makes this a hook rather than a helper: the server row doesn't refresh
 * until the surface revalidates, so removing one of three has to hide that one locally, per id.
 *
 * `isRemoving` is returned separately from `removalConfirm.pending` because Radix closes the alert
 * dialog on the confirm click — the dialog is gone while the action is still in flight, so the
 * surface, not the dialog, is what has to withhold a second removal and the upload picker.
 */
export function useMediaRemoval<FileT extends { id?: number }>({
  files,
  removeOne,
  removeAll,
  labels,
}: MediaRemovalArgsT<FileT>) {
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set())
  // Mirrors the state so a removal that resolves can read what is left RIGHT NOW: a surface that
  // doesn't gate on `isRemoving` (the transfers cell) lets a second removal start while the first
  // is in flight, and the render both of them read is already stale by then.
  const removedIdsRef = useRef(removedIds)
  const [staged, setStaged] = useState<StagedRemovalT | null>(null)
  const [pending, setPending] = useState(false)

  const visibleFiles = files.filter((file) => file.id === undefined || !removedIds.has(file.id))

  function markRemoved(ids: number[]) {
    removedIdsRef.current = new Set(removedIdsRef.current)
    for (const id of ids) removedIdsRef.current.add(id)
    setRemovedIds(removedIdsRef.current)
  }

  // Takes the id-bearing shape rather than `FileT`: the preview hands back the page it has on
  // screen, typed as the dialog's own file type, and the id is all this needs.
  function handleRemove(file: { id?: number }, closePreview: () => void) {
    if (file.id === undefined) return
    setStaged({
      title: visibleFiles.length === 1 ? labels.confirmLast : labels.confirmOne,
      fileId: file.id,
      closePreview,
    })
  }

  function handleRemoveAll(closePreview: () => void) {
    setStaged({ title: labels.confirmAll ?? '', closePreview })
  }

  async function runStaged({ fileId, closePreview }: StagedRemovalT) {
    const runner = fileId === undefined ? removeAll : () => removeOne(fileId)
    if (!runner) return

    const result = await runner()
    if (!result.success) {
      toastMessage(result.error ?? labels.error, 'error')
      return
    }

    if (labels.success) toastMessage(labels.success, 'success')

    if (fileId === undefined) {
      closePreview()
      markRemoved(files.map((file) => file.id).filter((id) => id !== undefined))
      return
    }

    markRemoved([fileId])
    const isEmpty = files.every(
      (file) => file.id !== undefined && removedIdsRef.current.has(file.id),
    )
    if (isEmpty) closePreview()
  }

  return {
    visibleFiles,
    handleRemove,
    handleRemoveAll,
    isRemoving: pending,
    removalConfirm: {
      open: staged !== null,
      title: staged?.title ?? '',
      description: labels.description,
      confirmLabel: 'Usuń',
      pending,
      pendingLabel: 'Usuwanie…',
      onConfirm: () => {
        if (!staged) return
        setPending(true)
        // `runStaged` toasts a REFUSED delete but not a rejected one, and `finally` closes the
        // dialog either way — leaving a file on screen the user was told nothing about.
        void runStaged(staged)
          .catch(() => toastMessage(labels.error, 'error'))
          .finally(() => {
            setPending(false)
            setStaged(null)
          })
      },
      onCancel: () => setStaged(null),
    },
  }
}
