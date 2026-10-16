import type { WorkerReportLineInputT } from '@/lib/db/worker-reports'
import type { KosztorysItemT, KosztorysTreeT } from '@/lib/kosztorys/types'
import { unitOptions } from '@/lib/kosztorys/unit-options'

export type TreeItemT = { item: KosztorysItemT; sectionName: string }

export const treeItems = (tree: Pick<KosztorysTreeT, 'sections'>): TreeItemT[] =>
  tree.sections.flatMap((section) =>
    section.items.map((item) => ({ item, sectionName: section.name })),
  )

export const reportUnits = (items: readonly TreeItemT[]): Set<string> =>
  new Set(
    unitOptions(
      items.map(({ item }) => item.unit ?? ''),
      '',
    ),
  )

export const rozpiskaLine = (
  { item, sectionName }: TreeItemT,
  reportedQty: number,
): WorkerReportLineInputT => ({
  kind: 'rozpiska',
  itemId: item.id,
  description: item.description ?? '',
  unit: item.unit ?? '',
  sectionName,
  reportedQty,
})
