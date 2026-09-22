'use client'

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

export function useInvestmentAssetsRemoval(investmentId: number, assets: MediaFileT[]) {
  return useMediaRemoval({
    files: assets,
    removeOne: (mediaId) => removeInvestmentAssetAction(investmentId, mediaId),
    removeAll: () => removeAllInvestmentAssetsAction(investmentId),
    labels: ASSET_REMOVAL_LABELS,
  })
}
