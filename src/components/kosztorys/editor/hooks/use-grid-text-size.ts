'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-value'
import type { TableTextSizeT } from '@/components/tables/data-table/table-text-size'

// No „Duża”: rows and the line are fixed at the default's 20px, so a larger font would clip.
export type GridTextSizeT = Extract<TableTextSizeT, '2xs' | 'xs' | 'sm'>

export const GRID_TEXT_SIZES: readonly GridTextSizeT[] = ['2xs', 'xs', 'sm']

// Global, like the crew axis: a reading preference belongs to the person, not to one kosztorys.
const STORAGE_KEY = 'kosztorys-text-size'

export function useGridTextSize(): [GridTextSizeT, (size: GridTextSizeT) => void] {
  return usePersistedEnum(STORAGE_KEY, GRID_TEXT_SIZES, 'sm')
}
