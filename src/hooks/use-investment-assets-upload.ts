'use client'

import { addInvestmentAssetsAction } from '@/lib/actions/investment-assets'
import { useMediaUpload } from '@/hooks/use-media-upload'

/** Shared by the investment section and the edit dialog's field, so the picker is titled the same. */
export const INVESTMENT_ASSETS_UPLOAD_TITLE = 'Dodaj zdjęcia lub pliki'

export function useInvestmentAssetsUpload(investmentId: number) {
  return useMediaUpload({
    attach: (mediaIds) => addInvestmentAssetsAction(investmentId, mediaIds),
    successMessage: 'Pliki dodane',
  })
}
