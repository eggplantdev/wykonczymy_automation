'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileInput } from '@/components/ui/file-input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Loader2 } from 'lucide-react'
import { MediaStrip } from '@/components/media/media-strip'
import { ASSET_PREVIEW_LABELS } from '@/components/media/preview-labels'
import { useMediaUpload } from '@/hooks/use-media-upload'
import { addInvestmentAssetsAction, removeInvestmentAssetAction } from '@/lib/actions/investment-assets'
import { toastMessage } from '@/lib/utils/toast'
import type { MediaFileT } from '@/types/media'

type InvestmentAssetsPropsT = {
  investmentId: number
  assets: MediaFileT[]
}

export function InvestmentAssets({ investmentId, assets }: InvestmentAssetsPropsT) {
  const router = useRouter()
  const [pendingRemoval, setPendingRemoval] = useState<MediaFileT | null>(null)
  const [isRemoving, startRemoval] = useTransition()

  const { isUploading, uploadFiles } = useMediaUpload({
    attach: (mediaIds) => addInvestmentAssetsAction(investmentId, mediaIds),
    successMessage: 'Pliki dodane',
  })

  function confirmRemoval(asset: MediaFileT) {
    startRemoval(async () => {
      const result = await removeInvestmentAssetAction(investmentId, asset.id)
      setPendingRemoval(null)
      if (!result.success) {
        toastMessage(result.error, 'error')
        return
      }
      toastMessage('Plik usunięty', 'success')
      router.refresh()
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">Zdjęcia i pliki</h2>
        {isUploading && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
      </div>

      <MediaStrip
        files={assets}
        labels={ASSET_PREVIEW_LABELS}
        sizes="(max-width: 767.98px) 33vw, (max-width: 1023.98px) 25vw, 265px"
        emptyText="Brak zdjęć i plików."
        onRemove={setPendingRemoval}
        // Cross-gated, not just self-gated: `setInvestmentAssets` is a read-modify-write, so a
        // removal that started before an upload finished writes back the pre-upload list — dropping
        // the new file from the investment and leaking its media row.
        removeDisabled={isRemoving || isUploading}
      />

      <FileInput
        label="Dodaj zdjęcia lub pliki"
        multiple
        disabled={isUploading || isRemoving}
        fieldClassName="sm:max-w-sm"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? [])
          // Allow re-picking the same file after a failed upload.
          event.target.value = ''
          void uploadFiles(picked)
        }}
      />

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Usunąć plik?"
        description={
          pendingRemoval?.filename
            ? `„${pendingRemoval.filename}" zostanie usunięty bezpowrotnie.`
            : 'Plik zostanie usunięty bezpowrotnie.'
        }
        confirmLabel="Usuń"
        pending={isRemoving}
        pendingLabel="Usuwanie..."
        onConfirm={() => pendingRemoval && confirmRemoval(pendingRemoval)}
        onCancel={() => setPendingRemoval(null)}
      />
    </section>
  )
}
