'use client'

import { useState } from 'react'
import { Field } from '@/components/ui/field'
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
      <UploadButton
        label={INVESTMENT_ASSETS_UPLOAD_TITLE}
        isUploading={isUploading}
        className="w-fit!"
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
