'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-value'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { PriceViewT } from '@/lib/kosztorys/calc'

// Active price view, persisted per investment in localStorage so the editor reopens on the last-used
// view for that kosztorys — hence the per-investment key (unlike the globally-keyed axis/layer hooks).
const DEFAULT_VIEW: PriceViewT = 'client'
const VALID_VIEWS: readonly PriceViewT[] = ['client', ...TOOL_PLANES]

export function usePriceView(
  investmentId: number,
  isTemplate = false,
): [PriceViewT, (view: PriceViewT) => void] {
  // A szablon id and a kosztorys id share one number space.
  const key = isTemplate ? `szablon-view:${investmentId}` : `kosztorys-view:${investmentId}`
  return usePersistedEnum(key, VALID_VIEWS, DEFAULT_VIEW)
}
