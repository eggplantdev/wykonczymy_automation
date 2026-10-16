import { roundToCents } from '@/lib/utils/round-to-cents'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'

// Both sides are netto — grossing the kosztorys side would false-fire by the whole VAT amount.

export type ReconT = {
  expected: number
  actual: number
  mismatch: boolean
}

export type KosztorysReconciliationT = {
  laborCosts: ReconT
  discount: ReconT
}

type InputT = {
  laborCostsNetFromKosztorys: number
  discountNetFromKosztorys: number
  laborCostsNetFromTransactions: number
  discountNetFromTransactions: number
}

// Exact grosz equality on rounded values, not a fuzzy epsilon: a hand-entered transfer can differ
// sub-grosz from the derived figure, and that must NOT fire — only a real ≥1-grosz gap is a mismatch.
function reconcile(expected: number, actual: number): ReconT {
  const mismatch = roundToCents(expected) !== roundToCents(actual)
  return { expected, actual, mismatch }
}

export function reconciliationTooltip(
  recon: ReconT,
  transactionSubject: string,
  format: (value: number) => string,
): string {
  return [
    `Kosztorys (netto, ceny dla inwestora): ${format(recon.expected)}`,
    `${transactionSubject} (netto): ${format(recon.actual)}`,
    `Różnica: ${format(recon.actual - recon.expected)}`,
    'Zweryfikuj przed oznaczeniem inwestycji jako rozliczonej.',
  ].join('\n')
}

export function buildKosztorysReconciliation({
  laborCostsNetFromKosztorys,
  discountNetFromKosztorys,
  laborCostsNetFromTransactions,
  discountNetFromTransactions,
}: InputT): KosztorysReconciliationT {
  const laborCosts = reconcile(laborCostsNetFromKosztorys, laborCostsNetFromTransactions)
  const discount = reconcile(discountNetFromKosztorys, discountNetFromTransactions)

  // Silenced per INVESTMENT, never per figure: a per-figure rule would mute „robocizna zaksięgowana,
  // rabat nie", which is precisely the gap `showDiscount` (settlement-summary.tsx) forces onto the screen.
  const nothingBooked = laborCostsNetFromTransactions === 0 && discountNetFromTransactions === 0
  if (nothingBooked) {
    return {
      laborCosts: { ...laborCosts, mismatch: false },
      discount: { ...discount, mismatch: false },
    }
  }

  return { laborCosts, discount }
}
