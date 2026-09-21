'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { InvoicePreviewButton } from '@/components/dialogs/invoice-preview-button'
import { InvoiceUploadDialog } from '@/components/dialogs/invoice-upload-dialog'
import { ASSET_PREVIEW_LABELS } from '@/components/media/preview-labels'
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

type InvestmentAssetsPropsT = {
  investmentId: number
  assets: MediaFileT[]
}

export function InvestmentAssets({ investmentId, assets }: InvestmentAssetsPropsT) {
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

  // With no files the whole section is a heading over empty space: there is no preview, and adding
  // starts in the „Edytuj inwestycję" dialog anyway. `isBusy` keeps it mounted while removing the
  // last file or uploading — otherwise the upload dialog would vanish mid-upload.
  if (visibleFiles.length === 0 && !isBusy) return null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">Zdjęcia i pliki</h2>
        {isUploading && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
      </div>

      {/* Dodawanie zaczyna się w podglądzie albo w dialogu „Edytuj inwestycję" — sekcja nie dubluje
          go własnym przyciskiem. */}
      {visibleFiles.length > 0 && (
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
      )}

      <InvoiceUploadDialog
        title={INVESTMENT_ASSETS_UPLOAD_TITLE}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onFiles={(picked) => void uploadFiles(picked)}
      />

      <ConfirmDialog {...removalConfirm} />
    </section>
  )
}
