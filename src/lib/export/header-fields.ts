import type { HeaderFieldT } from '@/types/export'

export const BILANS_LABEL = 'Bilans'

export function calculateBilans(
  fields: readonly HeaderFieldT[],
  visibility: Record<string, boolean>,
): number {
  return fields
    .filter(
      (f) => f.label !== BILANS_LABEL && f.amount !== undefined && visibility[f.label] !== false,
    )
    .reduce((sum, f) => sum + (f.amount ?? 0), 0)
}
