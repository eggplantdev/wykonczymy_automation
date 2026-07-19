import { toGross } from '@/lib/kosztorys/calc'

// One figure's reconciliation verdict: the kosztorys client-view gross vs the transaction-sourced
// figure, and whether they disagree. Shared contract — the editor Podsumowanie and the investment
// page both render off this shape.
export type ReconT = {
  // Kosztorys side: the client-view net grossed at the investment's VAT rate.
  expectedGross: number
  // Transaction side: Σ LABOR_COST / Σ RABAT (raw amount, treated as gross — the schema has no VAT).
  actualGross: number
  mismatch: boolean
}

export type KosztorysReconciliationT = {
  robocizna: ReconT
  rabat: ReconT
}

type InputT = {
  // „Suma prac wykonanych" at client prices, pre-rabat (net) — lines up with Σ LABOR_COST.
  sumaPracNet: number
  // The client-view rabat (net) — global discount when active, else Σ per-item rabat.
  rabatClientNet: number
  vatRate: number
  // Transaction-sourced robocizna: Σ LABOR_COST on the investment (raw, gross).
  investmentRobocizna: number
  // Transaction-sourced rabat: Σ RABAT on the investment (raw, gross).
  investmentRabat: number
}

// Exact grosz equality on rounded values, not a fuzzy epsilon: `toGross` can differ sub-grosz from a
// hand-entered transfer, and that must NOT fire — only a real ≥1-grosz gap is a mismatch.
function reconcile(expectedGross: number, actualGross: number): ReconT {
  const mismatch = Math.round(expectedGross * 100) !== Math.round(actualGross * 100)
  return { expectedGross, actualGross, mismatch }
}

/**
 * Compare the kosztorys client-view figures (grossed) against the investment's transaction sums, for
 * both robocizna and rabat. The verification instrument the owner reads before flipping an investment
 * to "populated" — read-only, no writes.
 *
 * A real lib function (not a colocated closure) so the parity test exercises the exact code the
 * surfaces render (`context/foundation/lessons.md`).
 */
/**
 * The scream's tooltip copy, shared by both surfaces (the editor Podsumowanie and the investment page)
 * so the wording can't drift. Format-agnostic: the caller passes its own money formatter — the editor
 * shows kosztorys nets via `formatNet`, the investment page złoty via `formatPLN`.
 */
export function reconciliationTooltip(
  recon: ReconT,
  transactionSubject: string,
  format: (value: number) => string,
): string {
  return [
    `Kosztorys (brutto, ceny klienta): ${format(recon.expectedGross)}`,
    `${transactionSubject}: ${format(recon.actualGross)}`,
    `Różnica: ${format(recon.actualGross - recon.expectedGross)}`,
    'Zweryfikuj przed oznaczeniem inwestycji jako rozliczonej.',
  ].join('\n')
}

export function buildKosztorysReconciliation({
  sumaPracNet,
  rabatClientNet,
  vatRate,
  investmentRobocizna,
  investmentRabat,
}: InputT): KosztorysReconciliationT {
  return {
    robocizna: reconcile(toGross(sumaPracNet, vatRate), investmentRobocizna),
    rabat: reconcile(toGross(rabatClientNet, vatRate), investmentRabat),
  }
}
