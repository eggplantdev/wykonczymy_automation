import { toGross } from '@/lib/kosztorys/calc'
import type { DepositRowT } from '@/types/reference-data'

export type MoneyPairT = { net: number; gross: number }

// The investor's deposits split by plane: `sumNet`/`sumGross` are the flagged buckets; `legacySum`
// is the pre-flag (NULL) deposits, which the „Do zapłaty" model subtracts at face on both axes.
export type DepositBucketsT = { sumNet: number; sumGross: number; legacySum: number }

// Reduce raw deposit rows into the three buckets: vatPlane 'NET' → sumNet, 'GROSS' → sumGross,
// NULL → legacySum. Pure — the read supplies the rows, this classifies them.
export function reduceDepositBuckets(rows: DepositRowT[]): DepositBucketsT {
  const buckets: DepositBucketsT = { sumNet: 0, sumGross: 0, legacySum: 0 }
  for (const row of rows) {
    if (row.vatPlane === 'NET') buckets.sumNet += row.amount
    else if (row.vatPlane === 'GROSS') buckets.sumGross += row.amount
    else buckets.legacySum += row.amount
  }
  return buckets
}

// A net figure paired with its brutto at the investment's VAT rate — the shape behind a PRACE row's
// netto/brutto columns. VAT is a prace-only concept: use this only for robocizna / prace figures.
export function moneyPair(net: number, vatRate: number): MoneyPairT {
  return { net, gross: toGross(net, vatRate) }
}

// A no-VAT figure: brutto === netto. For everything off the prace plane — materiały, korekta, wpłaty
// (context/reference/kosztorys-editor-domain-notes.md, „VAT dotyczy wyłącznie prac"). Without this,
// grossing an expense would invent VAT that never existed on the ledger.
export function faceValue(net: number): MoneyPairT {
  return { net, gross: net }
}

export type SummaryLineT = MoneyPairT & {
  // Fraction of Łącznie netto (0..1); 0 when Łącznie is 0. Null-safe by construction.
  share: number
}

// A PRACE net figure as a summary row: its netto/brutto pair (VAT-grossed) plus its udział as a
// fraction of Łącznie. The one home for the udział-base math.
export function summaryLine(net: number, combinedNet: number, vatRate: number): SummaryLineT {
  return { ...moneyPair(net, vatRate), share: combinedNet > 0 ? net / combinedNet : 0 }
}

// A no-VAT summary row (brutto === netto) with its udział — for the materiały/korekta category rows,
// which carry no VAT but still take an udział of Łącznie.
export function summaryLineFace(net: number, combinedNet: number): SummaryLineT {
  return { ...faceValue(net), share: combinedNet > 0 ? net / combinedNet : 0 }
}

export type SummaryT = {
  laborCosts: SummaryLineT
  combined: SummaryLineT
}

// The Podsumowanie split (sheet Podsumowanie r06–08): Robocizna (kosztorys wartość netto) plus
// Materiały = Łącznie, each carrying its udział % of Łącznie. Materiały enters only via the
// Łącznie denominator here — the per-category materiały rows are built by the caller, which shares
// `combined.net` as their udział base. Robocizna reacts to unsaved editor edits; materiały is a
// server prop.
export function computeSummarySplit(
  laborCostsNetFromKosztorys: number,
  materialyNet: number,
  vatRate: number,
): SummaryT {
  const combinedNet = laborCostsNetFromKosztorys + materialyNet
  const laborCosts = summaryLine(laborCostsNetFromKosztorys, combinedNet, vatRate)
  // Łącznie brutto = robocizna grossed + materiały at face value. Only prace carries VAT, so this is
  // NOT toGross(combinedNet) — grossing the whole sum would invent VAT on the materiały component.
  const combined: SummaryLineT = {
    net: combinedNet,
    gross: laborCosts.gross + materialyNet,
    share: combinedNet > 0 ? 1 : 0,
  }
  return { laborCosts, combined }
}

// „Aktualnie do zapłaty R + M" (sheet footer r456–464): the headline still-owed figure — robocizna
// do zapłaty plus materiały, less the investor's deposits, split by plane. Sequential model:
//   baseLeft = robocizna − sumNet          (netto-flagged deposits reduce the base pre-VAT)
//   net      = baseLeft − legacySum + M
//   gross    = baseLeft×(1+VAT) − sumGross − legacySum + M
// Only baseLeft is grossed. A netto deposit reduces before VAT, so it shaves `sumNet×VAT` off the
// brutto owed; a brutto deposit is already gross, so it subtracts once from the gross axis; legacy
// (pre-flag) subtracts at face on BOTH axes — identical to the old `R − wplaty` / `toGross(R) − wplaty`,
// so an all-legacy investment is unchanged. Can go negative (overpaid) — not clamped.
export function computeDoZaplatyRM(
  laborCostsNetFromKosztorys: number,
  deposits: DepositBucketsT,
  materialyNet: number,
  vatRate: number,
): MoneyPairT {
  const { sumNet, sumGross, legacySum } = deposits
  const baseLeft = laborCostsNetFromKosztorys - sumNet
  const net = baseLeft - legacySum + materialyNet
  const gross = toGross(baseLeft, vatRate) - sumGross - legacySum + materialyNet
  return { net, gross }
}
