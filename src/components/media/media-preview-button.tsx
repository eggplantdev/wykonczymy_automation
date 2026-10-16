'use client'

import { useState } from 'react'
import {
  MediaPreviewDialog,
  type MediaPreviewDialogPropsT,
} from '@/components/media/media-preview-dialog'
import {
  MediaPreviewTrigger,
  type MediaPreviewTriggerPropsT,
} from '@/components/media/media-preview-trigger'
import { usePreviewLabels } from '@/hooks/use-preview-labels'
import type { PreviewFileT, PreviewLabelsT } from '@/types/media'

type MediaPreviewButtonPropsT = {
  files: PreviewFileT[]
  label?: string
  labels: PreviewLabelsT
  onAdd?: (closePreview: () => void) => void
  onRemove?: (file: PreviewFileT, closePreview: () => void) => void
  onRemoveAll?: (closePreview: () => void) => void
  planMarker?: MediaPreviewDialogPropsT['planMarker']
  ariaLabel?: string
} & Pick<MediaPreviewTriggerPropsT, 'variant' | 'className'>

export function MediaPreviewButton({
  files,
  label,
  labels: callerLabels,
  onAdd,
  onRemove,
  onRemoveAll,
  planMarker,
  ariaLabel,
  variant,
  className,
}: MediaPreviewButtonPropsT) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const labels = usePreviewLabels(callerLabels)
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
