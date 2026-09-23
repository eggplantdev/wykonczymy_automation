import { toGross, toNet } from '@/lib/kosztorys/calc'

export type MoneyPairT = { net: number; gross: number }

// A net figure paired with its brutto at the investment's VAT rate — the shape behind a PRACE row's
// netto/brutto columns. VAT is a prace-only concept: use this only for robocizna / prace figures.
export function moneyPair(net: number, vatRate: number): MoneyPairT {
  return { net, gross: toGross(net, vatRate) }
}

// A no-VAT figure: brutto === netto. For everything off the prace plane — korekta, wpłaty
// (context/reference/kosztorys-editor-domain-notes.md, „VAT dotyczy wyłącznie prac"). Without this,
// grossing an expense would invent VAT that never existed on the ledger.
export function faceValue(net: number): MoneyPairT {
  return { net, gross: net }
}

// Materiały valuation switch, driven by the investment's persisted netto rate:
//   null → faceValue: netto = brutto, the raw receipt, no concession.
//   a rate → netto = brutto ÷ (1+rate), the price whose gross-up returns the receipt.
// Division, not `× (1 − rate)`: at 23% a 123 zł receipt is billed 100 zł, and 123 × 0,77 = 94,71 is a
// different (larger) concession than the server's `materialsNetDiscount` computes — the two figures
// would then disagree on screen, which is the defect this whole change exists to close.
export function billedMaterialsPair(gross: number, netRate: number | null): MoneyPairT {
  return netRate == null ? faceValue(gross) : { net: toNet(gross, netRate), gross }
}

// One „Wydatki inwestycyjne" row on both planes. A brutto row divides down through the rate. A netto
// row crosses nothing: its netto and its brutto are both on the invoice, so no stawka may move either
// (owner, 2026-09-23). With no rate the table shows one „Kwota" column, and every row shows what the
// investor is billed — for a netto row that is its netto.
export function breakdownRowPair(
  row: { net: number } & ({ origin: 'gross' } | { origin: 'netBilled'; recordedGross: number }),
  rate: number | null,
): MoneyPairT {
  if (row.origin === 'gross') return billedMaterialsPair(row.net, rate)
  return rate == null ? faceValue(row.net) : { net: row.net, gross: row.recordedGross }
}

// The concession in złotych — brutto receipt minus what the investor is billed. The netto-billed
// bucket is deliberately out of reach: it carries no VAT toward the investor, so cutting it here
// would deduct the same VAT twice. `deriveFinancials` calls THIS for the marża/bilans term, so the
// panel's „Obniżka materiałów" row and the figures it moves are one formula, not two that agree by
// convention. The settlement-mode gate stays server-side — it is about who owes VAT, not arithmetic.
export function materialsNetDiscount(grossBase: number, netRate: number | null): number {
  const { net, gross } = billedMaterialsPair(grossBase, netRate)
  return gross - net
}

/** The two materiały buckets, always passed together. An object rather than two positional
 *  numbers on purpose: the whole point of the split is that a caller can never feed the
 *  toggle a figure that already carries its own netto, and a positional pair invites exactly
 *  that mistake. `grossBase` is toggle-driven; `netBilled` is frozen. */
export type MaterialsT = { grossBase: number; netBilled: number }

/** What the investor owes for materiały as ONE figure — for the settlement steps, whose table has a
 *  single money column. The brutto base is billed at its netto price where a materiały rate is saved,
 *  at the raw receipt where none is (owner, 2026-08-07). The netto-billed bucket enters at face value
 *  either way: it IS the netto the investor is billed, so cutting it again would deduct the same VAT
 *  twice. */
export function billedMaterials(materials: MaterialsT, netRate: number | null): number {
  return billedMaterialsPair(materials.grossBase, netRate).net + materials.netBilled
}

/** „Łącznie" — the prace on their own two planes, plus materiały on theirs. `laborCostsNet` is
 *  already post-rabat, which is what lets the Rabat row sit above this and still reconcile. */
export function combinedPair(
  laborCostsNet: number,
  materials: MoneyPairT,
  vatRate: number,
): MoneyPairT {
  const labor = moneyPair(laborCostsNet, vatRate)
  return { net: labor.net + materials.net, gross: labor.gross + materials.gross }
}

// „Robocizna" is shown PRE-rabat, with the rabat as its own deduction row below it — the same figure
// the investment page's „z kosztorysu" block labels Robocizna, so one label never means two numbers.
// Łącznie is unaffected: `laborCostsNet` is already post-rabat, so the row pair adds
// back and deducts the same amount.
export function laborCostsNetPreDiscount(laborCostsNet: number, discountAmount: number): number {
  return laborCostsNet + discountAmount
}

// „Pozostało do zapłaty" (sheet footer r456–464): the headline still-owed figure — Łącznie less the
// investor's wpłaty (Σ INVESTOR_DEPOSIT), read top-down on each plane in EVERY tryb. `paid` carries a
// figure per plane rather than one for both, because each plane deducts only the kwoty its wpłaty
// actually carry — a wpłata gotówką has no brutto kwota at all, and inventing one at VAT credits the
// client money he never paid (owner, 2026-08-23). Can go negative when wpłaty exceed Łącznie: a real
// overpaid state, not clamped here.
//
// `loss` (strata) comes off both axes at FACE VALUE, unlike a wpłata and unlike a rabat. A rabat is a
// concession on the price, so a discounted złoty was never billed and never carried VAT — it grosses.
// A strata is a cost the company swallowed after the fact: the client simply stops owing the amount
// entered, the same amount on both planes. Grossing it would forgive 1230 zł of debt for 1000 zł
// absorbed.
export function computeAmountDue(
  laborCostsNet: number,
  paid: MoneyPairT,
  materials: MaterialsT,
  vatRate: number,
  materialsNetRate: number | null,
  loss = 0,
): MoneyPairT {
  // Materiały stand at FACE VALUE on both planes, in every tryb: VAT never touches them (owner,
  // 2026-08-20). The only rate that prices materiały is the investment's own stawka materiałów, and
  // it has already been applied by `billedMaterials`. De-grossing here would cut a second time —
  // including the netto-billed bucket, which carries no VAT toward the investor at all.
  const combined = combinedPair(
    laborCostsNet,
    faceValue(billedMaterials(materials, materialsNetRate)),
    vatRate,
  )
  return { net: combined.net - paid.net - loss, gross: combined.gross - paid.gross - loss }
}
