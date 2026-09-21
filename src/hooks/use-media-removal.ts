'use client'

import { useState } from 'react'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'

export type MediaRemovalLabelsT = {
  /** Asked when other files stay behind. */
  confirmOne: string
  /** Asked when this is the last file, so the whole set disappears with it. */
  confirmLast: string
  confirmAll: string
  error: string
}

type MediaRemovalArgsT<FileT extends { id?: number }> = {
  files: FileT[]
  removeOne: (fileId: number) => Promise<ActionResultT>
  removeAll: () => Promise<ActionResultT>
  labels: MediaRemovalLabelsT
}

/**
 * Removal for any set shown behind the preview dialog — an expense's invoice pages, an investment's
 * photos. The optimistic set is what makes it a hook rather than a helper: the server row doesn't
 * refresh until the surface revalidates, so removing one of three has to hide that one locally, per id.
 *
 * `removalConfirm` is spread onto a `ConfirmDialog` by each consumer, so the question is asked in the
 * app's own window.
 */
export function useMediaRemoval<FileT extends { id?: number }>({
  files,
  removeOne,
  removeAll,
  labels,
}: MediaRemovalArgsT<FileT>) {
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set())
  const [staged, setStaged] = useState<{ title: string; run: () => Promise<void> } | null>(null)
  const [pending, setPending] = useState(false)

  const visibleFiles = files.filter((file) => file.id === undefined || !removedIds.has(file.id))

  // Takes the id-bearing shape rather than `FileT`: the preview hands back the page it has on
  // screen, typed as the dialog's own file type, and the id is all this needs.
  function handleRemove(file: { id?: number }, closePreview: () => void) {
    const fileId = file.id
    if (fileId === undefined) return

    const isLast = visibleFiles.length === 1

    setStaged({
      title: isLast ? labels.confirmLast : labels.confirmOne,
      run: async () => {
        const result = await removeOne(fileId)
        if (!result.success) {
          toastMessage(result.error ?? labels.error, 'error')
          return
        }

        setRemovedIds((previous) => new Set(previous).add(fileId))
        if (isLast) closePreview()
      },
    })
  }

  function handleRemoveAll(closePreview: () => void) {
    setStaged({
      title: labels.confirmAll,
      run: async () => {
        const result = await removeAll()
        if (!result.success) {
          toastMessage(result.error ?? labels.error, 'error')
          return
        }

        closePreview()
        setRemovedIds(new Set(files.map((file) => file.id).filter((id) => id !== undefined)))
      },
    })
  }

  return {
    visibleFiles,
    handleRemove,
    handleRemoveAll,
    // Spreadable onto ConfirmDialog. Empty title while closed — the dialog renders nothing then.
    removalConfirm: {
      open: staged !== null,
      title: staged?.title ?? '',
      confirmLabel: 'Usuń',
      pending,
      pendingLabel: 'Usuwanie…',
      onConfirm: () => {
        if (!staged) return
        setPending(true)
        // `run` toasts a REFUSED delete but not a rejected one, and `finally` closes the dialog
        // either way — leaving a file on screen the user was told nothing about.
        void staged
          .run()
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
