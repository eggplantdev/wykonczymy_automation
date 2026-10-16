'use client'

import { useMediaRemoval, type MediaRemovalLabelsT } from '@/hooks/use-media-removal'
import { removeInvestmentAssetAction } from '@/lib/actions/investment-assets'
import type { MediaFileT } from '@/types/media'

const ASSET_REMOVAL_LABELS: MediaRemovalLabelsT = {
  confirmOne: 'Usunąć plik?',
  confirmLast: 'Usunąć plik?',
  description: 'Plik zostanie usunięty bezpowrotnie.',
  success: 'Plik usunięty',
  error: 'Nie udało się usunąć pliku',
}

// No `removeAll` until the file trash lands (EX-862, kosz-plikow Faza 1): one click wiping a whole
// gallery out of Blob, which has no undelete, is too much while nothing can bring it back.
export function useInvestmentAssetsRemoval(investmentId: number, assets: MediaFileT[]) {
  return useMediaRemoval({
    files: assets,
    removeOne: (mediaId) => removeInvestmentAssetAction(investmentId, mediaId),
    labels: ASSET_REMOVAL_LABELS,
  })
}
