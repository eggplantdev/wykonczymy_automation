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
import { MAX_DRAFT_PAGES } from '@/lib/constants/worker-expense-drafts'
import { toastMessage } from '@/lib/utils/toast'
import { INVOICE_PREVIEW_LABELS } from '@/lib/media/wording'
import { uploadMediaBySize } from '@/lib/media/upload-media'
import type { ActionResultT } from '@/types/action'
import { useTranslation } from '@/hooks/use-translation'

type PropsT = {
  draftId: number
  media: ExpenseDraftMediaT[]
  isEditable: boolean
  variant?: 'field' | 'compact'
}

export function ExpenseDraftPagesCell({ draftId, media, isEditable, variant = 'compact' }: PropsT) {
  const router = useRouter()
  const { t } = useTranslation('expenseDrafts')
  const [uploadOpen, setUploadOpen] = useState(false)

  // The draft actions revalidate no cache tag (the list is read uncached), so the refresh is ours.
  async function refreshOnSuccess(action: () => Promise<ActionResultT>) {
    const result = await action()
    if (result.success) router.refresh()
    return result
  }

  const { isUploading, uploadFiles } = useMediaUpload({
    attach: (mediaIds) => refreshOnSuccess(() => addExpenseDraftPagesAction(draftId, mediaIds)),
    successMessage: t('photosAdded'),
    upload: uploadMediaBySize,
  })
  const { visibleFiles, handleRemove, removalConfirm } = useMediaRemoval({
    files: media,
    removeOne: (mediaId) => refreshOnSuccess(() => removeExpenseDraftPageAction(draftId, mediaId)),
    labels: {
      confirmOne: t('removePhotoConfirm'),
      confirmLast: t('removePhotoConfirm'),
      description: t('removePhotoDescription'),
      error: t('removePhotoError'),
    },
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
        aria-label={t('uploadingPhotos')}
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
        title={t('addPhotos')}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onFiles={(picked) => {
          // The server refuses the same count, but only after every photo went up.
          if (media.length + picked.length > MAX_DRAFT_PAGES) {
            return toastMessage(t('tooManyPhotos', { max: MAX_DRAFT_PAGES }), 'error')
          }
          void uploadFiles(picked)
        }}
      />
      <ConfirmDialog {...removalConfirm} />
    </>
  )
}
