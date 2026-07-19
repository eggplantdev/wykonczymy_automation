import { toGross } from '@/lib/kosztorys/calc'

export type MoneyPairT = { net: number; gross: number }

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
export function summaryLine(net: number, lacznieNet: number, vatRate: number): SummaryLineT {
  return { ...moneyPair(net, vatRate), share: lacznieNet > 0 ? net / lacznieNet : 0 }
}

// A no-VAT summary row (brutto === netto) with its udział — for the materiały/korekta category rows,
// which carry no VAT but still take an udział of Łącznie.
export function summaryLineFace(net: number, lacznieNet: number): SummaryLineT {
  return { ...faceValue(net), share: lacznieNet > 0 ? net / lacznieNet : 0 }
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
  const robocizna = summaryLine(robociznaNet, lacznieNet, vatRate)
  // Łącznie brutto = robocizna grossed + materiały at face value. Only prace carries VAT, so this is
  // NOT toGross(lacznieNet) — grossing the whole sum would invent VAT on the materiały component.
  const lacznie: SummaryLineT = {
    net: lacznieNet,
    gross: robocizna.gross + materialyNet,
    share: lacznieNet > 0 ? 1 : 0,
  }
  return { robocizna, lacznie }
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
  const net = robociznaNet - wplatyNet + materialyNet
  // Only robocizna (prace) carries VAT; wpłaty and materiały enter at face value. Grossing the whole
  // net would invent VAT on the deposits and the expenses.
  const gross = toGross(robociznaNet, vatRate) - wplatyNet + materialyNet
  return { net, gross }
}
