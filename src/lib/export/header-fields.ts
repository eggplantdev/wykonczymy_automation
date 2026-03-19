import type { HeaderFieldT } from '@/types/export'

export const BILANS_LABEL = 'Bilans'

// Bilans = sum of visible stat card amounts (excludes the Bilans label itself).
// Used by print/export to compute the balance from the current toggle state.
export function calculateBalance(
  fields: HeaderFieldT[],
  visibility: Record<string, boolean>,
): number {
  return fields
    .filter(
      (f) => f.label !== BILANS_LABEL && f.amount !== undefined && visibility[f.label] !== false,
    )
    .reduce((sum, f) => sum + (f.amount ?? 0), 0)
}
