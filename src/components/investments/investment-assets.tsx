'use client'

import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { InvoicePreviewButton } from '@/components/dialogs/invoice-preview-button'
import { InvoiceUploadDialog } from '@/components/dialogs/invoice-upload-dialog'
import { ASSET_PREVIEW_LABELS } from '@/components/media/preview-labels'
import { useMediaRemoval, type MediaRemovalLabelsT } from '@/hooks/use-media-removal'
import { useMediaUpload } from '@/hooks/use-media-upload'
import {
  addInvestmentAssetsAction,
  removeAllInvestmentAssetsAction,
  removeInvestmentAssetAction,
} from '@/lib/actions/investment-assets'
import type { MediaFileT } from '@/types/media'

const ASSET_REMOVAL_LABELS: MediaRemovalLabelsT = {
  confirmOne: 'Czy na pewno chcesz usunąć ten plik?',
  confirmLast: 'Czy na pewno chcesz usunąć ostatni plik?',
  confirmAll: 'Czy na pewno chcesz usunąć wszystkie pliki?',
  error: 'Nie udało się usunąć pliku',
}

type InvestmentAssetsPropsT = {
  investmentId: number
  assets: MediaFileT[]
}

export function InvestmentAssets({ investmentId, assets }: InvestmentAssetsPropsT) {
  const [uploadOpen, setUploadOpen] = useState(false)

  const { isUploading, uploadFiles } = useMediaUpload({
    attach: (mediaIds) => addInvestmentAssetsAction(investmentId, mediaIds),
    successMessage: 'Pliki dodane',
  })

  const { visibleFiles, handleRemove, handleRemoveAll, removalConfirm } = useMediaRemoval({
    files: assets,
    removeOne: (mediaId) => removeInvestmentAssetAction(investmentId, mediaId),
    removeAll: () => removeAllInvestmentAssetsAction(investmentId),
    labels: ASSET_REMOVAL_LABELS,
  })

  // Cross-gated, not just self-gated: `setUploadField` is a read-modify-write, so a removal that
  // started before an upload finished writes back the pre-upload list — dropping the new file from
  // the investment and leaking its media row. While bytes are in flight the preview offers no
  // removal at all.
  const canRemove = !isUploading

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">Zdjęcia i pliki</h2>
        {isUploading && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
      </div>

      <div className="flex flex-col gap-2 sm:max-w-sm">
        {visibleFiles.length > 0 && (
          <InvoicePreviewButton
            invoices={visibleFiles}
            label={`Zdjęcia i pliki (${visibleFiles.length})`}
            ariaLabel={`Podgląd plików inwestycji (${visibleFiles.length})`}
            labels={ASSET_PREVIEW_LABELS}
            // The preview would sit on top of the upload dialog, so it steps aside before it opens.
            onAdd={(closePreview) => {
              closePreview()
              setUploadOpen(true)
            }}
            onRemove={canRemove ? handleRemove : undefined}
            onRemoveAll={canRemove && visibleFiles.length > 1 ? handleRemoveAll : undefined}
          />
        )}

        <Button
          variant="outline"
          disabled={isUploading}
          onClick={() => setUploadOpen(true)}
          className="justify-start"
        >
          <Plus />
          Dodaj pliki
        </Button>
      </div>

      <InvoiceUploadDialog
        title="Dodaj zdjęcia lub pliki"
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onFiles={(picked) => void uploadFiles(picked)}
      />

      <ConfirmDialog {...removalConfirm} />
    </section>
  )
}
