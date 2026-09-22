'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { InvoicePreviewButton } from '@/components/dialogs/invoice-preview-button'
import { InvoiceUploadDialog } from '@/components/dialogs/invoice-upload-dialog'
import { ASSET_PREVIEW_LABELS } from '@/components/media/preview-labels'
import { MediaUploadButton } from '@/components/media/media-upload-button'
import {
  INVESTMENT_ASSETS_UPLOAD_TITLE,
  useInvestmentAssetsUpload,
} from '@/hooks/use-investment-assets-upload'
import { useMediaRemoval, type MediaRemovalLabelsT } from '@/hooks/use-media-removal'
import {
  removeAllInvestmentAssetsAction,
  removeInvestmentAssetAction,
} from '@/lib/actions/investment-assets'
import type { MediaFileT } from '@/types/media'

const ASSET_REMOVAL_LABELS: MediaRemovalLabelsT = {
  confirmOne: 'Usunąć plik?',
  confirmLast: 'Usunąć plik?',
  confirmAll: 'Usunąć wszystkie pliki?',
  description: 'Plik zostanie usunięty bezpowrotnie.',
  success: 'Plik usunięty',
  error: 'Nie udało się usunąć pliku',
}

type InvestmentAssetsControlPropsT = {
  investmentId: number
  assets: MediaFileT[]
}

// The whole gallery — trigger, preview, upload and confirm — in one portable piece, so the
// investment card and the kosztorys editor toolbar are the same implementation rather than twins.
export function InvestmentAssetsControl({ investmentId, assets }: InvestmentAssetsControlPropsT) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const { isUploading, uploadFiles } = useInvestmentAssetsUpload(investmentId)
  const { visibleFiles, handleRemove, handleRemoveAll, isRemoving, removalConfirm } =
    useMediaRemoval({
      files: assets,
      removeOne: (mediaId) => removeInvestmentAssetAction(investmentId, mediaId),
      removeAll: () => removeAllInvestmentAssetsAction(investmentId),
      labels: ASSET_REMOVAL_LABELS,
    })

  // `setUploadField` is a read-modify-write, so an upload and a removal that overlap write back each
  // other's pre-change list — dropping the new file from the investment and leaking its media row.
  // Each side therefore withholds the other's affordance for as long as its own work is in flight.
  const isBusy = isUploading || isRemoving

  // The preview would sit on top of the upload dialog, so it steps aside before it opens.
  function openUpload(closePreview: () => void) {
    closePreview()
    setUploadOpen(true)
  }

  const hasFiles = visibleFiles.length > 0

  return (
    <>
      <div className="flex w-fit items-center gap-2">
        {hasFiles ? (
          <>
            <InvoicePreviewButton
              invoices={visibleFiles}
              label={`Zdjęcia i pliki (${visibleFiles.length})`}
              ariaLabel={`Podgląd plików inwestycji (${visibleFiles.length})`}
              labels={ASSET_PREVIEW_LABELS}
              className="h-8 w-fit gap-1.5 text-xs"
              onAdd={isBusy ? undefined : openUpload}
              onRemove={isBusy ? undefined : handleRemove}
              onRemoveAll={!isBusy && visibleFiles.length > 1 ? handleRemoveAll : undefined}
            />
            {/* The trigger keeps its own label when files exist, so the spinner is the only sign
                that bytes are still moving. */}
            {isUploading && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
          </>
        ) : (
          <MediaUploadButton
            label={INVESTMENT_ASSETS_UPLOAD_TITLE}
            isUploading={isBusy}
            onClick={() => setUploadOpen(true)}
            size="sm"
            className="w-fit"
          />
        )}
      </div>

      <InvoiceUploadDialog
        title={INVESTMENT_ASSETS_UPLOAD_TITLE}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onFiles={(picked) => void uploadFiles(picked)}
      />

      <ConfirmDialog {...removalConfirm} />
    </>
  )
}
