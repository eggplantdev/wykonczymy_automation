'use client'

import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { InvoiceUploadDialog } from '@/components/dialogs/invoice-upload-dialog'
import { useMediaUpload } from '@/hooks/use-media-upload'
import { addInvestmentAssetsAction } from '@/lib/actions/investment-assets'

/**
 * The investment row already exists here, so picking a file IS the save — the same semantics a
 * faktura has in the transfers table. „Anuluj" on the surrounding form therefore does not take the
 * file back; that is the accepted cost of not routing `assets` through the update action, which
 * strips the field precisely so an empty list can never wipe the gallery.
 */
export function InvestmentAssetsField({ investmentId }: { investmentId: number }) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const { isUploading, uploadFiles } = useMediaUpload({
    attach: (mediaIds) => addInvestmentAssetsAction(investmentId, mediaIds),
    successMessage: 'Pliki dodane',
  })

  return (
    <Field>
      <FieldLabel>Zdjęcia i pliki</FieldLabel>
      <Button
        type="button"
        variant="outline"
        disabled={isUploading}
        onClick={() => setUploadOpen(true)}
        className="justify-start"
      >
        {isUploading ? <Loader2 className="animate-spin" /> : <Plus />}
        {isUploading ? 'Przesyłanie...' : 'Dodaj zdjęcia lub pliki'}
      </Button>

      <InvoiceUploadDialog
        title="Dodaj zdjęcia lub pliki"
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onFiles={(picked) => void uploadFiles(picked)}
      />
    </Field>
  )
}
