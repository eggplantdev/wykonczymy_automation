import { toGross } from '@/lib/kosztorys/calc'

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
): SummaryLineT {
  const pair = grossPair(gross, vatRate)
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
): SummaryT {
  const materialy = grossPair(materialsGross, vatRate)
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
): MoneyPairT {
  const materialy = grossPair(materialsGross, vatRate)
  // Robocizna is netto native (grossed up); materiały is brutto native (netto derived by removing
  // VAT); wpłaty carry no VAT (face value). Each figure enters each axis at its own native amount.
  const net = laborCostsNetFromKosztorys - wplatyNet + materialy.net
  const gross = toGross(laborCostsNetFromKosztorys, vatRate) - wplatyNet + materialy.gross
  return { net, gross }
}

export type CashSettlementT = { cash: number; remainderGross: number; total: number }

// Tryb mieszany: the client pays part of „Do zapłaty" in cash (VAT-free by agreement) and the
// remainder with VAT re-added. `cashAmount` is settled as-is; the rest `(D − C)` is grossed up.
// No clamping — the caller allows `C > D`, which yields a negative remainder by design.
export function computeCashSettlement(
  doZaplatyNet: number,
  cashAmount: number,
  vatRate: number,
): CashSettlementT {
  const remainderGross = toGross(doZaplatyNet - cashAmount, vatRate)
  return { cash: cashAmount, remainderGross, total: cashAmount + remainderGross }
}
