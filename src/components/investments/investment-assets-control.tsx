'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MediaPreviewButton } from '@/components/dialogs/media-preview-button'
import { MediaUploadDialog } from '@/components/dialogs/media-upload-dialog'
import { MediaPreviewTrigger } from '@/components/dialogs/media-preview-trigger'
import { ASSET_PREVIEW_LABELS } from '@/lib/media/wording'
import { useInvestmentAssetsRemoval } from '@/hooks/use-investment-assets-removal'
import { usePlanMarker } from '@/hooks/use-plan-marker'
import {
  INVESTMENT_ASSETS_UPLOAD_TITLE,
  useInvestmentAssetsUpload,
} from '@/hooks/use-investment-assets-upload'
import type { MediaFileT } from '@/types/media'

type InvestmentAssetsControlPropsT = {
  investmentId: number
  assets: MediaFileT[]
}

export function InvestmentAssetsControl({ investmentId, assets }: InvestmentAssetsControlPropsT) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const { isUploading, uploadFiles } = useInvestmentAssetsUpload(investmentId)
  const { visibleFiles, handleRemove, handleRemoveAll, isRemoving, removalConfirm } =
    useInvestmentAssetsRemoval(investmentId, assets)
  const planMarker = usePlanMarker(visibleFiles)

  // `setUploadField` is a read-modify-write, so an upload and a removal that overlap write back each
  // other's pre-change list — dropping the new file from the investment and leaking its media row.
  // Each side therefore withholds the other's affordance for as long as its own work is in flight.
  const isBusy = isUploading || isRemoving

  // The preview would sit on top of the upload dialog, so it steps aside before it opens.
  function openUpload(closePreview: () => void) {
    closePreview()
    setUploadOpen(true)
  }

  const label = visibleFiles.length > 0 ? `Dokumentacja (${visibleFiles.length})` : 'Dokumentacja'

  return (
    <>
      <div className="flex w-fit items-center gap-2">
        {/* One button in both states: with files it opens the preview (which offers „Dodaj"), with
            none it goes straight to the upload — an empty preview would be a dead end. */}
        {visibleFiles.length > 0 ? (
          <MediaPreviewButton
            files={visibleFiles}
            label={label}
            ariaLabel={`Dokumentacja inwestycji (${visibleFiles.length})`}
            labels={ASSET_PREVIEW_LABELS}
            className="text-foreground h-8 w-fit gap-1.5 text-xs"
            onAdd={isBusy ? undefined : openUpload}
            onRemove={isBusy ? undefined : handleRemove}
            onRemoveAll={!isBusy && visibleFiles.length > 1 ? handleRemoveAll : undefined}
            planMarker={planMarker}
          />
        ) : (
          <MediaPreviewTrigger
            label={label}
            ariaLabel="Dokumentacja inwestycji (brak plików)"
            onClick={() => setUploadOpen(true)}
            className="text-foreground h-8 w-fit gap-1.5 text-xs"
          />
        )}
        {isUploading && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
      </div>

      <MediaUploadDialog
        title={INVESTMENT_ASSETS_UPLOAD_TITLE}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        allowPlanMarker
        onFiles={(picked, asPlan) => void uploadFiles(picked, asPlan)}
      />

      <ConfirmDialog {...removalConfirm} />
    </>
  )
}
