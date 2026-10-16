import { toGross, toNet } from '@/lib/kosztorys/calc'

export type MoneyPairT = { net: number; gross: number }

// VAT is a prace-only concept: use this only for robocizna / prace figures.
export function moneyPair(net: number, vatRate: number): MoneyPairT {
  return { net, gross: toGross(net, vatRate) }
}

// Without this, grossing an expense would invent VAT that never existed on the ledger.
export function faceValue(net: number): MoneyPairT {
  return { net, gross: net }
}

// Division, not `× (1 − rate)`: at 23% a 123 zł receipt is billed 100 zł.
export function billedMaterialsPair(gross: number, netRate: number | null): MoneyPairT {
  return netRate == null ? faceValue(gross) : { net: toNet(gross, netRate), gross }
}

// The netto-billed bucket is deliberately out of reach: it carries no VAT toward the investor, so
// cutting it here would deduct the same VAT twice.
export function materialsNetDiscount(grossBase: number, netRate: number | null): number {
  const { net, gross } = billedMaterialsPair(grossBase, netRate)
  return gross - net
}

export type MaterialsT = { grossBase: number; netBilled: number }

export function billedMaterials(materials: MaterialsT, netRate: number | null): number {
  return billedMaterialsPair(materials.grossBase, netRate).net + materials.netBilled
}

export function combinedPair(
  laborCostsNet: number,
  materials: MoneyPairT,
  vatRate: number,
): MoneyPairT {
  const labor = moneyPair(laborCostsNet, vatRate)
  return { net: labor.net + materials.net, gross: labor.gross + materials.gross }
}

export function laborCostsNetPreDiscount(laborCostsNet: number, discountAmount: number): number {
  return laborCostsNet + discountAmount
}

// `paid` carries a figure per plane, because each plane deducts only the kwoty its wpłaty
// actually carry — a wpłata gotówką has no brutto kwota at all.
export function computeAmountDue(
  laborCostsNet: number,
  paid: MoneyPairT,
  materials: MaterialsT,
  vatRate: number,
  materialsNetRate: number | null,
  loss = 0,
): MoneyPairT {
  const combined = combinedPair(
    laborCostsNet,
    faceValue(billedMaterials(materials, materialsNetRate)),
    vatRate,
  )
  return { net: combined.net - paid.net - loss, gross: combined.gross - paid.gross - loss }
}
