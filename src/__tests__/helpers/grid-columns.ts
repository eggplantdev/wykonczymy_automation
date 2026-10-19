import { buildV2Grid } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { makeStage } from '@/__tests__/helpers/kosztorys-tree'

export const STAGES_7: KosztorysStageT[] = [makeStage({ id: 7, label: 'Etap 1', plane: null })]

export const STAGES_7_9: KosztorysStageT[] = [
  makeStage({ id: 7, label: 'Etap 1', plane: null }),
  makeStage({ id: 9, ordinal: 2, label: 'Etap 2', plane: null }),
]

export function gridColumnIds(opts: BuildV2ColumnsOptsT): string[] {
  return buildV2Grid(opts)
    .columns.map((column) => column.id)
    .filter((id): id is string => id != null)
}
