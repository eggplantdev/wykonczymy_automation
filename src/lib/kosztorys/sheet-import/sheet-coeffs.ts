import { round6 } from '@/lib/utils/round'

export type SheetCoeffsT = { wTools: number | null; ownTools: number | null }

export type RateSampleT = { rate: number; clientPrice: number; tracksClientPrice: boolean }

function mode(ratios: readonly number[]): number | null {
  const counts = new Map<number, number>()
  for (const ratio of ratios) counts.set(ratio, (counts.get(ratio) ?? 0) + 1)

  let best: number | null = null
  let bestCount = 0
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}

/**
 * Rows with a hand-typed stawka are excluded on purpose: those are decisions about one praca and
 * would drag the global figure toward whatever the owner happened to type most often.
 */
export function sheetCoeffs(
  wToolsSamples: readonly RateSampleT[],
  ownToolsSamples: readonly RateSampleT[],
): SheetCoeffsT {
  const ratios = (samples: readonly RateSampleT[]): number[] =>
    samples
      .filter((sample) => sample.tracksClientPrice && sample.rate > 0 && sample.clientPrice > 0)
      .map((sample) => round6(sample.rate / sample.clientPrice))

  return { wTools: mode(ratios(wToolsSamples)), ownTools: mode(ratios(ownToolsSamples)) }
}
