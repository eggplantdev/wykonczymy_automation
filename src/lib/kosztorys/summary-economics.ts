import { toGross } from '@/lib/kosztorys/calc'

export type SummaryLineT = {
  net: number
  gross: number
  // Fraction of Łącznie netto (0..1); 0 when Łącznie is 0. Null-safe by construction.
  share: number
}

export type PodsumowanieT = {
  robocizna: SummaryLineT
  materialy: SummaryLineT
  lacznie: SummaryLineT
}

// The Podsumowanie split (sheet Podsumowanie r06–08): Robocizna (kosztorys wartość netto) +
// Materiały (live sum of the investment's unsettled transactions) = Łącznie, each with brutto
// and udział % of Łącznie. Robocizna reacts to unsaved editor edits; materiały is a server prop.
export function computePodsumowanie(
  robociznaNet: number,
  materialyNet: number,
  vatRate: number,
): PodsumowanieT {
  const lacznieNet = robociznaNet + materialyNet
  const line = (net: number): SummaryLineT => ({
    net,
    gross: toGross(net, vatRate),
    share: lacznieNet > 0 ? net / lacznieNet : 0,
  })
  return {
    robocizna: line(robociznaNet),
    materialy: line(materialyNet),
    lacznie: line(lacznieNet),
  }
}

export type MoneyPairT = { net: number; gross: number }

// „Aktualnie do zapłaty R + M" (sheet footer r456–464): the headline still-owed figure —
// robocizna do zapłaty, less advances already paid (zaliczki), plus materiały. Zaliczki net
// against the R portion before materiały is added, per the owner's netting order. Can dip below
// materiały (even negative) when advances exceed robocizna — that is a real overpaid state, not
// clamped here.
export function computeDoZaplatyRM(
  robociznaNet: number,
  zaliczkiNet: number,
  materialyNet: number,
  vatRate: number,
): MoneyPairT {
  const net = robociznaNet - zaliczkiNet + materialyNet
  return { net, gross: toGross(net, vatRate) }
}
