'use server'

import { columnTotalsForRows } from '@/lib/kosztorys/columns/column-totals'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { getKosztorysTree } from '@/lib/queries/kosztorys'

export async function getContractPlannedNet(investmentId: number): Promise<number> {
  const tree = await getKosztorysTree(investmentId)
  const totals = columnTotalsForRows(treeToRows(tree), tree.stages, 'client', tree.vatRate)
  return totals.get('plannedNet') ?? 0
}
