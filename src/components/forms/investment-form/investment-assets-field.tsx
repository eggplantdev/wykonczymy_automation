'use client'

import { useState } from 'react'
import { Field, FieldLabel } from '@/components/ui/field'
import { MediaUploadDialog } from '@/components/dialogs/media-upload-dialog'
import { UploadButton } from '@/components/ui/upload-button'
import {
  INVESTMENT_ASSETS_UPLOAD_TITLE,
  useInvestmentAssetsUpload,
} from '@/hooks/use-investment-assets-upload'

export function InvestmentAssetsField({ investmentId }: { investmentId: number }) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const { isUploading, uploadFiles } = useInvestmentAssetsUpload(investmentId)

  return (
    <Field>
      <FieldLabel>Zdjęcia i pliki</FieldLabel>
      <UploadButton
        label={INVESTMENT_ASSETS_UPLOAD_TITLE}
        isUploading={isUploading}
        onClick={() => setUploadOpen(true)}
      />

      <MediaUploadDialog
        title={INVESTMENT_ASSETS_UPLOAD_TITLE}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        allowPlanMarker
        onFiles={(picked, asPlan) => void uploadFiles(picked, asPlan)}
      />
    </Field>
  )
}
