'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { FileText, ImageOff } from 'lucide-react'
import { FileInput } from '@/components/ui/file-input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { RemoveButton } from '@/components/ui/remove-button'
import { Spinner } from '@/components/ui/loader/spinner'
import {
  InvoicePreviewDialog,
  type PreviewLabelsT,
} from '@/components/dialogs/invoice-preview-dialog'
import { useMediaUpload } from '@/hooks/use-media-upload'
import { isImageMime } from '@/lib/invoices/mime'
import { addInvestmentAssetsAction, removeInvestmentAssetAction } from '@/lib/actions/investments'
import { toastMessage } from '@/lib/utils/toast'
import type { InvestmentAssetT } from '@/lib/queries/investment-assets'

type InvestmentAssetsPropsT = {
  investmentId: number
  assets: InvestmentAssetT[]
}

const PREVIEW_LABELS: PreviewLabelsT = {
  fallbackTitle: 'Plik',
  empty: 'Brak plików do wyświetlenia.',
  archivePrefix: 'pliki',
}

export function InvestmentAssets({ investmentId, assets }: InvestmentAssetsPropsT) {
  const router = useRouter()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<InvestmentAssetT | null>(null)
  const [isRemoving, startRemoval] = useTransition()

  const { isUploading, uploadFiles } = useMediaUpload({
    attach: (mediaIds) => addInvestmentAssetsAction(investmentId, mediaIds),
    successMessage: 'Pliki dodane',
  })

  function confirmRemoval(asset: InvestmentAssetT) {
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
        {isUploading && <Spinner className="size-4" />}
      </div>

      {assets.length === 0 ? (
        <p className="text-muted-foreground text-sm">Brak zdjęć i plików.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {assets.map((asset, index) => (
            <li key={asset.id} className="group relative">
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                // The filename is the only thing telling two site photos apart, so it is the label
                // rather than a generic „otwórz".
                aria-label={asset.filename ?? PREVIEW_LABELS.fallbackTitle}
                className="border-input bg-muted/40 hover:border-primary/50 relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border"
              >
                {isImageMime(asset.mimeType) ? (
                  asset.thumbnailUrl ? (
                    <Image
                      src={asset.thumbnailUrl}
                      alt={asset.filename ?? ''}
                      fill
                      sizes="(max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
                      className="object-cover"
                    />
                  ) : (
                    // An image uploaded before the thumbnail size existed has no rendition, and the
                    // full-size original is the wrong thing to pull into a strip of twenty.
                    <ImageOff className="text-muted-foreground size-6" />
                  )
                ) : (
                  <span className="text-muted-foreground flex flex-col items-center gap-1 p-2 text-center">
                    <FileText className="size-6" />
                    <span className="line-clamp-2 text-xs break-all">{asset.filename}</span>
                  </span>
                )}
              </button>

              <RemoveButton
                onClick={() => setPendingRemoval(asset)}
                disabled={isRemoving}
                aria-label={`Usuń ${asset.filename ?? 'plik'}`}
                className="bg-background/80 absolute top-1 right-1"
              />
            </li>
          ))}
        </ul>
      )}

      <FileInput
        label="Dodaj zdjęcia lub pliki"
        multiple
        disabled={isUploading}
        fieldClassName="sm:max-w-sm"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? [])
          // Allow re-picking the same file after a failed upload.
          event.target.value = ''
          void uploadFiles(picked)
        }}
      />

      {/* Mounted per click so the pager starts on the thumbnail that was clicked — the dialog seeds
          its page index once, at mount. */}
      {openIndex !== null && (
        <InvoicePreviewDialog
          key={openIndex}
          invoices={assets}
          initialIndex={openIndex}
          labels={PREVIEW_LABELS}
          open
          onOpenChange={(next) => !next && setOpenIndex(null)}
        />
      )}

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
