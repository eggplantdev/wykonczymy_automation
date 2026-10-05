'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MediaPreviewButton } from '@/components/dialogs/media-preview-button'
import { MediaUploadDialog } from '@/components/dialogs/media-upload-dialog'
import { useMediaRemoval } from '@/hooks/use-media-removal'
import { useMediaUpload } from '@/hooks/use-media-upload'
import {
  addExpenseDraftPagesAction,
  removeExpenseDraftPageAction,
} from '@/lib/actions/worker-expense-drafts'
import type { ExpenseDraftMediaT } from '@/lib/db/worker-expense-drafts'
import { INVOICE_PREVIEW_LABELS } from '@/lib/media/wording'
import type { ActionResultT } from '@/types/action'

type PropsT = {
  draftId: number
  media: ExpenseDraftMediaT[]
  /** Only the sender, and only while the draft waits — a decided one is a record. */
  isEditable: boolean
  variant?: 'field' | 'compact'
}

const PAGE_REMOVAL_LABELS = {
  confirmOne: 'Czy na pewno chcesz usunąć to zdjęcie?',
  confirmLast: 'Czy na pewno chcesz usunąć to zdjęcie?',
  description: 'Operacji nie da się cofnąć — plik znika bezpowrotnie.',
  error: 'Nie udało się usunąć zdjęcia',
}

export function ExpenseDraftPagesCell({ draftId, media, isEditable, variant = 'compact' }: PropsT) {
  const router = useRouter()
  const [uploadOpen, setUploadOpen] = useState(false)

  // The draft actions revalidate no cache tag (the list is read uncached), so the refresh is ours.
  async function refreshOnSuccess(action: () => Promise<ActionResultT>) {
    const result = await action()
    if (result.success) router.refresh()
    return result
  }

  const { isUploading, uploadFiles } = useMediaUpload({
    attach: (mediaIds) => refreshOnSuccess(() => addExpenseDraftPagesAction(draftId, mediaIds)),
    successMessage: 'Zdjęcia dodane',
  })
  const { visibleFiles, handleRemove, removalConfirm } = useMediaRemoval({
    files: media,
    removeOne: (mediaId) => refreshOnSuccess(() => removeExpenseDraftPageAction(draftId, mediaId)),
    labels: PAGE_REMOVAL_LABELS,
  })

  if (!isEditable) {
    return <MediaPreviewButton labels={INVOICE_PREVIEW_LABELS} files={media} variant={variant} />
  }

  if (isUploading) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        className="text-muted-foreground"
        aria-label="Przesyłanie zdjęć"
      >
        <Loader2 className="animate-spin" />
      </Button>
    )
  }

  return (
    <>
      <MediaPreviewButton
        labels={INVOICE_PREVIEW_LABELS}
        files={visibleFiles}
        variant={variant}
        // The preview would sit on top of the upload dialog, so it steps aside before it opens.
        onAdd={(closePreview) => {
          closePreview()
          setUploadOpen(true)
        }}
        // The last photo stays: a draft without one is deleted whole, from the row.
        onRemove={visibleFiles.length > 1 ? handleRemove : undefined}
      />
      <MediaUploadDialog
        title="Dodaj zdjęcia"
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onFiles={(picked) => void uploadFiles(picked)}
      />
      <ConfirmDialog {...removalConfirm} />
    </>
  )
}
