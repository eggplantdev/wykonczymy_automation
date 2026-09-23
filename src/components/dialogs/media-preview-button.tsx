'use client'

import { useState } from 'react'
import {
  MediaPreviewDialog,
  type MediaPreviewDialogPropsT,
} from '@/components/dialogs/media-preview-dialog'
import {
  MediaPreviewTrigger,
  type MediaPreviewTriggerPropsT,
} from '@/components/dialogs/media-preview-trigger'
import type { PreviewFileT, PreviewLabelsT } from '@/types/media'

type MediaPreviewButtonPropsT = {
  files: PreviewFileT[]
  label?: string
  labels: PreviewLabelsT
  // The open state lives here, so a caller that needs the preview gone (to make room for an upload
  // modal) gets `closePreview` rather than having it forced — a caller may want it to stay open
  // behind a `confirm()`, after a failed delete, or while the previewed file swaps in place.
  onAdd?: (closePreview: () => void) => void
  onRemove?: (file: PreviewFileT, closePreview: () => void) => void
  onRemoveAll?: (closePreview: () => void) => void
  planMarker?: MediaPreviewDialogPropsT['planMarker']
  // Optional here, required on the trigger: the button can name the set from `labels`, a bare
  // trigger cannot.
  ariaLabel?: string
} & Pick<MediaPreviewTriggerPropsT, 'variant' | 'className'>

export function MediaPreviewButton({
  files,
  label,
  labels,
  onAdd,
  onRemove,
  onRemoveAll,
  planMarker,
  ariaLabel,
  variant,
  className,
}: MediaPreviewButtonPropsT) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const closePreview = () => setPreviewOpen(false)
  const triggerLabel = label ?? files[0]?.filename ?? labels.fallbackTitle

  return (
    <>
      <MediaPreviewTrigger
        label={triggerLabel}
        ariaLabel={ariaLabel ?? `${labels.previewAria}: ${triggerLabel}`}
        onClick={() => setPreviewOpen(true)}
        variant={variant}
        className={className}
      />

      {previewOpen && (
        <MediaPreviewDialog
          files={files}
          labels={labels}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          onAdd={onAdd && (() => onAdd(closePreview))}
          onRemove={onRemove && ((file) => onRemove(file, closePreview))}
          onRemoveAll={onRemoveAll && (() => onRemoveAll(closePreview))}
          planMarker={planMarker}
          // Stored file is already ingest-compressed to one of the upload profiles — skip the Next
          // optimizer and its cold-start round-trip; serve straight from the Blob CDN.
          unoptimized
        />
      )}
    </>
  )
}
