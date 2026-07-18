import { isDepositType } from '@/lib/constants/transfers'

// A deposit row as it reaches the aggregation: the cash amount plus its optional etap tag.
// `kosztorysStage` is the tagged stage id (null/undefined = not a zaliczka).
export type ZaliczkaRowT = {
  type: string
  amount: number
  kosztorysStage: number | null | undefined
}

// Sum tagged deposits per etap. Untagged deposits and non-deposit rows are excluded here
// (not in SQL), so the filter is testable in isolation. Returns stage id → summed cash.
export function sumZaliczkiByStage(rows: ZaliczkaRowT[]): Map<number, number> {
  const byStage = new Map<number, number>()
  for (const row of rows) {
    if (row.kosztorysStage == null || !isDepositType(row.type)) continue
    byStage.set(row.kosztorysStage, (byStage.get(row.kosztorysStage) ?? 0) + row.amount)
  }
  return byStage
}
