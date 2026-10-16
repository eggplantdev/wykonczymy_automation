import { round6 } from '@/lib/utils/round'

// A blank rate means 0, NOT "inherit the default coeff": a `null` override would
// instead invent a section/global-coeff cost the sheet never has.
export function deriveOverride(
  rate: number,
  clientPrice: number,
  { tracksClientPrice, planeCoeff }: { tracksClientPrice: boolean; planeCoeff: number | null },
): number | null {
  if (rate <= 0) return 0
  if (tracksClientPrice && clientPrice > 0) {
    const coeff = round6(rate / clientPrice)
    if (coeff === planeCoeff) return null
  }
  return rate
}
