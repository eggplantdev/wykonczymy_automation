'use client'

import { useState } from 'react'

import { CheckboxRow } from '@/components/ui/checkbox-row'
import { Description } from '@/components/ui/description'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { FileInput } from '@/components/ui/file-input'
import { useTranslation } from '@/hooks/use-translation'

type MediaUploadDialogPropsT = {
  title?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onFiles: (files: File[], asPlan: boolean) => void
  allowPlanMarker?: boolean
}

export function MediaUploadDialog({
  title,
  open,
  onOpenChange,
  onFiles,
  allowPlanMarker = false,
}: MediaUploadDialogPropsT) {
  const { t } = useTranslation('media')
  const [asPlan, setAsPlan] = useState(true)

  // The dialog stays mounted when Radix unmounts its content, so an untick left behind by a
  // cancelled pick would silently hide the NEXT upload from the AI.
  function handleOpenChange(next: boolean) {
    if (!next) setAsPlan(true)
    onOpenChange(next)
  }

  function handlePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = [...(e.target.files ?? [])]
    if (picked.length === 0) return

    handleOpenChange(false)
    onFiles(picked, asPlan)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-dialog-sm" aria-describedby={undefined}>
        <DialogHeader title={title ?? t('addInvoice')} />
        {allowPlanMarker && (
          <div>
            <CheckboxRow checked={asPlan} onCheckedChange={setAsPlan}>
              {t('isPlan')}
            </CheckboxRow>
            <Description size="xs" withIcon={false} className="px-2">
              {t('planHint')}
            </Description>
          </div>
        )}
        <FileInput multiple onChange={handlePicked} className="h-28 flex-col" />
      </DialogContent>
    </Dialog>
  )
}
