import type { CategoryCostT } from '@/lib/db/sum-transfers'
import type { HeaderFieldT } from '@/types/export'
import { formatPLN } from '@/lib/format-currency'

/** Map per-category cost breakdown to header fields for display. */
export function mapCategoryCostsToFields(
  categoryCosts: readonly CategoryCostT[],
  expenseCategories: readonly { readonly id: number; readonly name: string }[],
): HeaderFieldT[] {
  const nameMap = new Map(expenseCategories.map((c) => [c.id, c.name]))

  return categoryCosts.map((cc) => ({
    label: nameMap.get(cc.categoryId) ?? `Kategoria #${cc.categoryId}`,
    value: formatPLN(cc.total),
    amount: -cc.total,
  }))
}
