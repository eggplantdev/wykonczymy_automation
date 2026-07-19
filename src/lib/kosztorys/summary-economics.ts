import { toGross } from '@/lib/kosztorys/calc'

export type MoneyPairT = { net: number; gross: number }

// A net figure paired with its brutto at the investment's VAT rate — the shared shape behind every
// row's netto/brutto columns.
export function moneyPair(net: number, vatRate: number): MoneyPairT {
  return { net, gross: toGross(net, vatRate) }
}

export type SummaryLineT = MoneyPairT & {
  // Fraction of Łącznie netto (0..1); 0 when Łącznie is 0. Null-safe by construction.
  share: number
}

// A net figure as a summary row: its netto/brutto pair plus its udział as a fraction of Łącznie.
// The one home for the udział-base math — the per-category materiały rows share this denominator.
export function summaryLine(net: number, lacznieNet: number, vatRate: number): SummaryLineT {
  return { ...moneyPair(net, vatRate), share: lacznieNet > 0 ? net / lacznieNet : 0 }
}

export type PodsumowanieT = {
  robocizna: SummaryLineT
  lacznie: SummaryLineT
}

// The Podsumowanie split (sheet Podsumowanie r06–08): Robocizna (kosztorys wartość netto) plus
// Materiały = Łącznie, each carrying its udział % of Łącznie. Materiały enters only via the
// Łącznie denominator here — the per-category materiały rows are built by the caller, which shares
// `lacznie.net` as their udział base. Robocizna reacts to unsaved editor edits; materiały is a
// server prop.
export function computePodsumowanie(
  robociznaNet: number,
  materialyNet: number,
  vatRate: number,
): PodsumowanieT {
  const lacznieNet = robociznaNet + materialyNet
  return {
    robocizna: summaryLine(robociznaNet, lacznieNet, vatRate),
    lacznie: summaryLine(lacznieNet, lacznieNet, vatRate),
  }
}

// „Aktualnie do zapłaty R + M" (sheet footer r456–464): the headline still-owed figure —
// robocizna do zapłaty plus materiały, less the investor's wpłaty (every deposit attached to
// the investment — the same `totalIncome` that raises Bilans inwestora in calculate-balance.ts).
// So this equals −Bilans on the R+M base. Can go negative when wpłaty exceed R+M — a real
// overpaid state, not clamped here.
export function computeDoZaplatyRM(
  robociznaNet: number,
  wplatyNet: number,
  materialyNet: number,
  vatRate: number,
): MoneyPairT {
  return moneyPair(robociznaNet - wplatyNet + materialyNet, vatRate)
}
