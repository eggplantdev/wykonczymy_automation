import { toGross } from '@/lib/kosztorys/calc'
import type { VatPlaneT } from '@/lib/constants/transfers'

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

// A gross-native figure — materiały, recorded as brutto transactions (VAT already inside). The
// counterpart to `moneyPair`: there netto is native and brutto is grossed up; here brutto is native
// and netto is derived by REMOVING VAT (`net = gross / (1+vat)`), the inverse direction. `vat = 0`
// degenerates to `net === gross`.
export function grossPair(gross: number, vatRate: number): MoneyPairT {
  return { net: gross / (1 + vatRate), gross }
}

// Materiały valuation switch. Recorded brutto either way; `deriveNet` decides the netto axis:
//   false → faceValue: netto = brutto, the raw expense amount, no reduction.
//   true, `reduction` given → netto = brutto × (1 − reduction), the owner-set brutto discount
//     (client-side experiment: the reduction % is a panel control, default = VAT rate).
//   true, no `reduction` → grossPair: netto = brutto ÷ (1+VAT), the VAT-stripped netto.
// Brutto is `gross` in every branch, so this only moves the netto figures.
export function materialyPair(
  gross: number,
  vatRate: number,
  deriveNet: boolean,
  reduction?: number,
): MoneyPairT {
  if (!deriveNet) return faceValue(gross)
  if (reduction != null) return { net: gross * (1 - reduction), gross }
  return grossPair(gross, vatRate)
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

// A no-VAT summary row (brutto === netto) with its udział — for the korekta category rows,
// which carry no VAT but still take an udział of Łącznie.
export function summaryLineFace(net: number, combinedNet: number): SummaryLineT {
  return { ...faceValue(net), share: combinedNet > 0 ? net / combinedNet : 0 }
}

// A gross-native summary row (netto derived by removing VAT) with its udział — for the materiały
// category rows, whose amount is a brutto transaction sum. Udział is off the DERIVED netto so the
// per-category shares sum to the materiały share of Łącznie (which is also netto-based).
export function summaryLineGross(
  gross: number,
  combinedNet: number,
  vatRate: number,
  reduction?: number,
): SummaryLineT {
  const pair =
    reduction != null ? { net: gross * (1 - reduction), gross } : grossPair(gross, vatRate)
  return { ...pair, share: combinedNet > 0 ? pair.net / combinedNet : 0 }
}

export type SummaryT = {
  laborCosts: SummaryLineT
  combined: SummaryLineT
}

// The Podsumowanie split (sheet Podsumowanie r06–08): Robocizna (kosztorys wartość netto) plus
// Materiały = Łącznie, each carrying its udział % of Łącznie. Materiały enters only via the
// Łącznie denominator here — the per-category materiały rows are built by the caller, which shares
// `combined.net` as their udział base. Robocizna reacts to unsaved editor edits; materiały is a
// server prop, passed as BRUTTO (its netto is derived by removing VAT).
export function computeSummarySplit(
  laborCostsNetFromKosztorys: number,
  materialsGross: number,
  vatRate: number,
  deriveMaterialsNet = true,
  materialsReduction?: number,
): SummaryT {
  const materialy = materialyPair(materialsGross, vatRate, deriveMaterialsNet, materialsReduction)
  const combinedNet = laborCostsNetFromKosztorys + materialy.net
  const laborCosts = summaryLine(laborCostsNetFromKosztorys, combinedNet, vatRate)
  // Łącznie = robocizna (netto native, grossed up) + materiały (brutto native, netto derived). Each
  // side carries VAT in its own direction; combining the two native planes keeps both correct.
  const combined: SummaryLineT = {
    net: combinedNet,
    gross: laborCosts.gross + materialy.gross,
    share: combinedNet > 0 ? 1 : 0,
  }
  return { laborCosts, combined }
}

// „Aktualnie do zapłaty R + M" (sheet footer r456–464): the headline still-owed figure —
// robocizna do zapłaty plus materiały, less the investor's wpłaty (every deposit attached to
// the investment — the same `totalIncome` that raises Bilans inwestora in calculate-balance.ts).
// So this equals −Bilans on the R+M base. Can go negative when wpłaty exceed R+M — a real
// overpaid state, not clamped here.
export function computeDoZaplatyRM(
  laborCostsNetFromKosztorys: number,
  wplatyNet: number,
  materialsGross: number,
  vatRate: number,
  deriveMaterialsNet = true,
  materialsReduction?: number,
): MoneyPairT {
  const materialy = materialyPair(materialsGross, vatRate, deriveMaterialsNet, materialsReduction)
  // Robocizna is netto native (grossed up); materiały is brutto native (netto derived by removing
  // VAT); wpłaty carry no VAT (face value). Each figure enters each axis at its own native amount.
  const net = laborCostsNetFromKosztorys - wplatyNet + materialy.net
  const gross = toGross(laborCostsNetFromKosztorys, vatRate) - wplatyNet + materialy.gross
  return { net, gross }
}

export type CashSettlementT = {
  cash: number
  // Łącznie netto (robocizna + materiały) — the VATable base the split starts from.
  combinedNet: number
  // Łącznie netto − gotówka: the part still to be invoiced, before VAT.
  remainderNet: number
  // remainderNet grossed up — the invoiced part WITH VAT, before wpłaty.
  remainderGross: number
  // remainderGross − wpłaty: what the client still owes ON THE INVOICE (this is the figure the old
  // opaque „Reszta z VAT" row actually showed).
  invoice: number
  // cash + invoice: total the client pays now.
  total: number
}

// Tryb mieszany: the client pays part of the work in cash (no invoice → no VAT) and the rest is
// invoiced WITH VAT. A transparent waterfall the reader can reconstruct row by row:
//   Wartość netto (Łącznie) → − gotówka → Pozostałe netto → + VAT → Pozostałe z VAT
//   → − wpłaty → Do zapłaty fakturą → + gotówka → Razem.
// Anchored on Łącznie netto (not net·(1+VAT) of „Do zapłaty"): wpłaty carry no VAT, so they're
// subtracted AFTER grossing, never grossed — otherwise VAT is invented on the deposits. Algebraically
// total = combinedGross − wpłaty − C·VAT = doZaplatyGross − C·VAT, so C = 0 → total = the Brutto axis
// „Do zapłaty". No clamping — the caller allows C beyond the base.
export function computeCashSettlement(
  combinedNet: number,
  wplatyNet: number,
  cashAmount: number,
  vatRate: number,
): CashSettlementT {
  const remainderNet = combinedNet - cashAmount
  const remainderGross = toGross(remainderNet, vatRate)
  const invoice = remainderGross - wplatyNet
  return {
    cash: cashAmount,
    combinedNet,
    remainderNet,
    remainderGross,
    invoice,
    total: cashAmount + invoice,
  }
}

export type DepositPlaneSumsT = { paidNet: number; paidGross: number }

// Bucket deposits by VAT plane for the tryb-mieszany reconciliation. A deposit marked GROSS goes to
// the invoiced part; everything else — NET *and* legacy/unmarked null — pays down the gotówka
// (no-VAT) part, the owner's „brak wartości = netto" ruling (flipped 2026-07-22 from the earlier
// null→brutto default).
export function bucketDepositsByPlane(
  rows: { amount: number; vatPlane: VatPlaneT | null }[],
): DepositPlaneSumsT {
  const paidGross = rows.reduce(
    (sum, row) => (row.vatPlane === 'GROSS' ? sum + row.amount : sum),
    0,
  )
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  return { paidNet: total - paidGross, paidGross }
}
