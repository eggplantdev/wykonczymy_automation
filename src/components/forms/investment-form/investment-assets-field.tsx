'use client'

import { useState } from 'react'
import { Field, FieldLabel } from '@/components/ui/field'
import { InvoiceUploadDialog } from '@/components/dialogs/invoice-upload-dialog'
import { UploadButton } from '@/components/ui/upload-button'
import {
  INVESTMENT_ASSETS_UPLOAD_TITLE,
  useInvestmentAssetsUpload,
} from '@/hooks/use-investment-assets-upload'

/**
 * The investment row already exists here, so picking a file IS the save. „Anuluj" on the surrounding
 * form therefore does not take the file back; that is the accepted cost of not routing `assets`
 * through the update action, which strips the field so an empty list can never wipe the gallery.
 */
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

      <InvoiceUploadDialog
        title={INVESTMENT_ASSETS_UPLOAD_TITLE}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onFiles={(picked) => void uploadFiles(picked)}
      />
    </Field>
  )
}
