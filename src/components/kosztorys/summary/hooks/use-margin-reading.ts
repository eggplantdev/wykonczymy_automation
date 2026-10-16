'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-value'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { OptionT } from '@/components/ui/toggle-group'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

export type MarginFigureT = 'forecast' | 'actual'

export const FIGURE_OPTIONS: OptionT<MarginFigureT>[] = [
  { value: 'forecast', label: 'Prognoza' },
  { value: 'actual', label: 'Marża rzeczywista' },
]

const FIGURE_KEY = 'table-columns:kosztorys-margin-figure'
const PLANE_KEY = 'table-columns:kosztorys-margin-plane'

const FIGURES: readonly MarginFigureT[] = FIGURE_OPTIONS.map((option) => option.value)

export function useMarginFigure(): [MarginFigureT, (figure: MarginFigureT) => void] {
  return usePersistedEnum(FIGURE_KEY, FIGURES, 'forecast')
}

export function useMarginPlane(): [ToolPlaneT, (plane: ToolPlaneT) => void] {
  return usePersistedEnum(PLANE_KEY, TOOL_PLANES, 'w_tools')
}
