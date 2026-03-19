import type { HeaderFieldT } from '@/types/export'

export const BILANS_LABEL = 'Bilans'

// Marża (margin) = owner's total earnings from an investment.
// balance: investor's money left (income - costs)
// totalPayouts: money already paid out to the owner
// Sum of both = total value generated for the owner.
export const calculateMargin = (balance: number, totalPayouts: number) => balance + totalPayouts

// Bilans = sum of visible stat card amounts (excludes the Bilans label itself).
// Used by print/export to compute the balance from the current toggle state.
export function calculateBalance(
  fields: readonly HeaderFieldT[],
  visibility: Record<string, boolean>,
): number {
  return fields
    .filter(
      (f) => f.label !== BILANS_LABEL && f.amount !== undefined && visibility[f.label] !== false,
    )
    .reduce((sum, f) => sum + (f.amount ?? 0), 0)
}
